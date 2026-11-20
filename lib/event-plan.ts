/**
 * lib/event-plan.ts
 *
 * イベント（ロト型）計画の純粋関数群。React フック不使用。UI 層が hook 経由でデータを注入する。
 *
 * ボックス層（決定論）: calcBoxLayer
 * ソルバーアダプタ: buildEventDrops / runEventSolver
 * 逆算（欲しいアイテム数 → 最小箱数）: reverseCalcBoxes
 * 育成インパクト（実効不足を引数で受け取る）: computeRosterImpact
 *
 * ボックス計画は箱の確定報酬と周回だけで計算し、交換所の品目は扱わない（交換所の計算は交換所の画面で行う）。
 */

import type { EventPlannerEvent } from './master-data/types'
import type { Drops } from './get-drops'
import type { Params, Result } from '../interfaces/api'
import { solve } from './solver'
import type { EffectiveShortfall } from './effective-shortfall'

// ─────────────────────────────────────────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────────────────────────────────────────

/** サーヴァント/礼装/コマンドコード として扱う objType 値。 */
const NON_MATERIAL_OBJ_TYPES = new Set(['servant', 'svt', 'equip', 'commandCode', 'cc'])

/** objType が素材（充当計算に含める）かどうかを返す。 */
const isMaterialObjType = (objType: string): boolean =>
  !NON_MATERIAL_OBJ_TYPES.has(objType)

/**
 * Map<atlasId, num> に { itemId, num } を加算する。
 */
const addToMap = (
  acc: Map<number, number>,
  items: { itemId: number; num: number }[],
): void => {
  for (const { itemId, num } of items) {
    acc.set(itemId, (acc.get(itemId) ?? 0) + num)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ボックス層
// ─────────────────────────────────────────────────────────────────────────────

/**
 * N 箱分のロト報酬を集計する（決定論的計算）。
 *
 * @param event       EventPlannerEvent
 * @param targetBoxes 目標箱数（0 起点、lotteries.length までの整数）
 * @param ownedCurrency 所持イベント通貨数（US-4）
 * @param openedBoxes  既に開封済みの箱数（会期途中。コスト/報酬は [openedBoxes, targetBoxes) の範囲で集計）
 */
export type BoxLayerResult = {
  /** 目標箱数（ゴール） */
  targetBoxes: number
  /** これから開ける残り箱数（targetBoxes − openedBoxes、上限クランプ後） */
  boxesToOpen: number
  /** 残り箱（openedBoxes..targetBoxes）の総通貨コスト（所持通貨差し引き前） */
  totalCurrencyNeeded: number
  /** 所持通貨を差し引いた残り必要通貨（≥0） */
  remainingCurrency: number
  /** 各ボックスの累計確定素材報酬（atlasId → 個数）。rareRewards のうち素材のみ含む */
  confirmedMaterials: Map<number, number>
  /**
   * レア報酬のうちサーヴァント/礼装/CC（非素材）。
   * boxIndex ごとの配列として保持（表示用）。
   */
  rareNonMaterials: { boxIndex: number; itemId: number; num: number; objType: string }[]
}

export const calcBoxLayer = (
  event: EventPlannerEvent,
  targetBoxes: number,
  ownedCurrency = 0,
  openedBoxes = 0,
): BoxLayerResult => {
  const distinctCount = event.lotteries.length
  // unlimitedBoxes（最終箱が無限ループ）のとき箱種類数を超えて指定でき、
  // 超過分は最終箱を繰り返す。limited のときは箱種類数で頭打ち。
  const requested = Math.max(0, Math.floor(targetBoxes))
  const cap = event.unlimitedBoxes
    ? requested
    : Math.min(requested, distinctCount)
  // 既開封分は通貨を払い済みなので集計の開始位置にする（[start, cap) を計算）。
  const start = Math.max(0, Math.min(Math.floor(openedBoxes), cap))

  let totalCurrencyNeeded = 0
  const confirmedMaterials = new Map<number, number>()
  const rareNonMaterials: BoxLayerResult['rareNonMaterials'] = []

  for (let i = start; i < cap; i++) {
    // 箱種類数を超えた分は最終箱（boxIndex 最大）を繰り返す。
    const box = event.lotteries[Math.min(i, distinctCount - 1)]
    if (!box) break
    totalCurrencyNeeded += box.costPerBox
    addToMap(confirmedMaterials, box.contents)

    // rareRewards: 素材 → 充当計算に含める、非素材 → 別リストへ
    for (const rr of box.rareRewards) {
      if (isMaterialObjType(rr.objType)) {
        confirmedMaterials.set(rr.itemId, (confirmedMaterials.get(rr.itemId) ?? 0) + rr.num)
      } else {
        rareNonMaterials.push({ boxIndex: box.boxIndex, itemId: rr.itemId, num: rr.num, objType: rr.objType })
      }
    }
  }

  const remainingCurrency = Math.max(0, totalCurrencyNeeded - ownedCurrency)

  return {
    targetBoxes: requested,
    boxesToOpen: Math.max(0, cap - start),
    totalCurrencyNeeded,
    remainingCurrency,
    confirmedMaterials,
    rareNonMaterials,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ソルバーアダプタ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * イベント通貨・素材・周回ノードから Drops 互換オブジェクトを合成する。
 *
 * ID 方針（CRITICAL）: 生成する Drops は自己完結（all_drops_json とは混合しない）。
 * item_id / quest_id はすべて Atlas 数値 ID の文字列表現を使用する。
 * 短縮 ID への変換は行わない。
 *
 * @param event          EventPlannerEvent
 * @param currencyDemand 必要イベント通貨数（周回で集める量）
 * @param extraItemDemand atlasId → 追加で直接欲しい素材数（任意）
 */
export const buildEventDrops = (
  event: EventPlannerEvent,
  currencyDemand: number,
  extraItemDemand: Map<number, number> = new Map(),
): { drops: Drops; params: Params } => {
  const currencyAtlasId = event.currency.id
  const currencyIdStr = String(currencyAtlasId)

  // ── items ──────────────────────────────────────────────────────────────────
  // イベント通貨 + ドロップに登場する全素材 ID を収集
  const itemIdSet = new Set<string>([currencyIdStr])
  for (const node of event.farmingNodes) {
    for (const drop of node.drops) {
      itemIdSet.add(String(drop.itemId))
    }
  }
  for (const id of extraItemDemand.keys()) {
    itemIdSet.add(String(id))
  }

  // atlasId → アイテム名のマップをイベントデータ（取込時に Atlas nice_item で解決済み）
  // から構築する。これがないとソルバー結果（周回ドロップ見込み等）で生 ID 表示になる。
  const itemNameMap = new Map<number, string>()
  itemNameMap.set(currencyAtlasId, event.currency.name)
  for (const node of event.farmingNodes) {
    for (const drop of node.drops) {
      if (drop.name) itemNameMap.set(drop.itemId, drop.name)
    }
  }
  for (const item of event.shop) {
    if (item.kind === 'svt') continue
    if (item.name) itemNameMap.set(item.itemId, item.name)
  }
  for (const box of event.lotteries) {
    for (const c of box.contents) {
      if (c.name) itemNameMap.set(c.itemId, c.name)
    }
    for (const r of box.rareRewards) {
      if (r.name) itemNameMap.set(r.itemId, r.name)
    }
  }

  const items: Drops['items'] = Array.from(itemIdSet).map((id) => {
    const name = itemNameMap.get(Number(id)) ?? `item_${id}`
    return {
      id,
      category: 'イベント',
      name,
      largeCategory: 'イベント',
      shortName: name,
      atlasId: Number(id),
    }
  })

  // ── quests ─────────────────────────────────────────────────────────────────
  const quests: Drops['quests'] = event.farmingNodes
    .filter((node) => node.drops.length > 0)
    .map((node) => ({
      id: String(node.questId),
      section: 'イベント',
      area: event.name,
      name: node.name,
      ap: node.ap,
      aaQuestId: node.questId,
    }))

  // ── drop_rates ─────────────────────────────────────────────────────────────
  const drop_rates: Drops['drop_rates'] = []
  for (const node of event.farmingNodes) {
    if (node.drops.length === 0) continue
    const questIdStr = String(node.questId)
    for (const drop of node.drops) {
      if (drop.perRun > 0) {
        drop_rates.push({
          quest_id: questIdStr,
          item_id: String(drop.itemId),
          drop_rate: drop.perRun,
        })
      }
    }
  }

  const drops: Drops = { items, quests, drop_rates, campaigns: [] }

  // ── params ─────────────────────────────────────────────────────────────────
  const itemsDemand: Record<string, number> = {}
  if (currencyDemand > 0) {
    itemsDemand[currencyIdStr] = currencyDemand
  }
  for (const [atlasId, qty] of extraItemDemand) {
    const id = String(atlasId)
    if (qty > 0) itemsDemand[id] = (itemsDemand[id] ?? 0) + qty
  }

  const params: Params = {
    objective: 'ap',
    items: itemsDemand,
    quests: quests.map((q) => q.id),
  }

  return { drops, params }
}

export type EventSolverResult = {
  result: Result
  /** 使用したドロップデータのソース（'atlas' / 'manual' / 'none'）。 */
  dropSource: 'atlas' | 'manual' | 'none'
}

/**
 * イベント通貨需要に対してソルバーを実行し、最小AP/周回計画を返す。
 * solve() を直接呼び出す薄いアダプタ。ソルバー本体は無改修。
 *
 * @param event           EventPlannerEvent
 * @param currencyDemand  必要イベント通貨総量（所持分差し引き済み）
 * @param extraItemDemand 直接欲しい素材（atlasId → 個数）
 * @param objective       'ap'（消費AP最小）or 'lap'（周回数最小）
 */
export const runEventSolver = (
  event: EventPlannerEvent,
  currencyDemand: number,
  extraItemDemand: Map<number, number> = new Map(),
  objective: 'ap' | 'lap' = 'ap',
): EventSolverResult => {
  const nodesWithDrops = event.farmingNodes.filter((n) => n.drops.length > 0)
  const dropSource: EventSolverResult['dropSource'] =
    nodesWithDrops.length > 0 ? 'atlas' : 'none'

  const { drops, params } = buildEventDrops(event, currencyDemand, extraItemDemand)
  const result = solve(drops, { ...params, objective })

  return { result, dropSource }
}

export type ShopCurrencyPlan =
  /** 必要量のある通貨が無い（周回は不要）。 */
  | { status: 'none' }
  /** 周回クエストにドロップの統計が無い。 */
  | { status: 'no-drops' }
  /**
   * `result` は周回で集められる通貨だけを満たす周回の内訳。`unfarmable` は周回では集められない通貨の
   * atlasId。すべて集められないときは `result` が null。
   */
  | { status: 'planned'; result: Result | null; unfarmable: number[] }

/**
 * 通貨の必要量（atlasId → 個数）を1つの LP で同時に満たす周回を求める。
 * 1周で複数の通貨が落ちるクエストは、それぞれの通貨の制約に同時に効く。
 */
export const planShopCurrencies = (
  event: EventPlannerEvent,
  currencyNeed: Map<number, number>,
): ShopCurrencyPlan => {
  const demand = new Map([...currencyNeed].filter(([, qty]) => qty > 0))
  if (demand.size === 0) return { status: 'none' }
  if (!event.farmingNodes.some((n) => n.drops.length > 0)) return { status: 'no-drops' }
  return splitUnfarmable(runEventSolver(event, 0, demand).result)
}

/** ソルバーの結果から、周回では集められない通貨（`skipped_items`）を周回の内訳と分ける。 */
export const splitUnfarmable = (
  result: Result,
): Extract<ShopCurrencyPlan, { status: 'planned' }> => {
  const skipped = new Set(result.skipped_items ?? [])
  const unfarmable = [...skipped].map(Number)
  const items = result.items.filter((item) => !skipped.has(item.id))
  if (items.length === 0) return { status: 'planned', result: null, unfarmable }
  return { status: 'planned', result: { ...result, items }, unfarmable }
}

export type DropBonusResult = {
  /** ドロップごとの1周の獲得量をボーナス込みにしたイベント。 */
  event: EventPlannerEvent
  /** ボーナスが入っているが、1周あたりのドロップ回数を持たないドロップがある品目の atlasId。 */
  unapplied: number[]
}

/**
 * ドロップ増加のボーナス（atlasId → 1ドロップにつき +N）を、各ドロップの1周の獲得量
 * `perRun + countPerRun × N` に反映する。同じクエストに同じ品目のドロップが複数あれば、それぞれに足す。
 * 回数を持たないドロップは素の値のまま。ボーナスが空か全部0なら入ったイベントをそのまま返す。
 */
export const applyDropBonus = (
  event: EventPlannerEvent,
  bonus: Map<number, number>,
): DropBonusResult => {
  const active = new Map([...bonus].filter(([, n]) => n > 0))
  if (active.size === 0) return { event, unapplied: [] }
  const unapplied = new Set<number>()
  const farmingNodes = event.farmingNodes.map((node) => ({
    ...node,
    drops: node.drops.map((drop) => {
      const n = active.get(drop.itemId)
      if (n === undefined) return drop
      if (drop.countPerRun === undefined) {
        unapplied.add(drop.itemId)
        return drop
      }
      return { ...drop, perRun: drop.perRun + drop.countPerRun * n }
    }),
  }))
  return { event: { ...event, farmingNodes }, unapplied: [...unapplied] }
}

export type BonusRarity = 3 | 4 | 5

/** ボーナス礼装の ☆ ごとの入力（礼装1枚あたりの +N と所持枚数）と、その ☆ に対応する通貨。 */
export type BonusRarityInput = {
  rarity: BonusRarity
  /** その ☆ の礼装が増やす通貨の atlasId。 */
  itemId: number
  /** 凸の礼装1枚あたりの「1ドロップにつき +N」。 */
  maxBonus: number
  /** 無凸の礼装1枚あたりの「1ドロップにつき +N」。 */
  baseBonus: number
  /** 凸の所持枚数。 */
  maxOwned: number
  /** 無凸の所持枚数。 */
  baseOwned: number
}

/** ボーナス礼装の合計枚数ごとの最良の組み合わせ。 */
export type BonusCraftEssenceRow = {
  /** フレンドの1枠を含む合計枚数。 */
  total: number
  /** ☆ ごとの枚数（フレンドの1枠を含む）。 */
  counts: Record<BonusRarity, number>
  laps: number
  ap: number
  /** 1枚少ない行からの AP の減り。最初の行は undefined。 */
  apDrop?: number
  /** この行の各品目の「1ドロップにつき +N」（☆ と対応する通貨は編成から、ほかは通貨ごとの値）。 */
  bonus: Map<number, number>
}

export type BonusCraftEssenceComparison = {
  rows: BonusCraftEssenceRow[]
  /** 周回では集められない通貨の atlasId。 */
  unfarmable: number[]
}

/** フレンドの1枠を含めた合計枚数の上限。 */
export const MAX_BONUS_CRAFT_ESSENCES = 6

const AP_EPSILON = 1e-6

/**
 * ☆ ごとの枚数の組み合わせのうち、合計枚数ごとに AP が最も少ないものを求める。
 *
 * - フレンドの ☆ を選んだときは、その ☆ の1枚を凸の値で必ず含める。
 * - 自分の礼装は ☆ ごとに凸と無凸の所持枚数の和まで、凸を先に数える。
 * - ☆ と対応する通貨の +N は「1枚あたりの +N × 枚数」の和、ほかの品目は `otherBonus` の値で解く。
 * - 同じ AP なら周回の少ない、次に ☆5、次に ☆4 の少ない組み合わせを選ぶ。
 * - 通貨の必要量が無い・ドロップの統計が無い・集められる通貨が無いときは行を返さない。
 */
export const compareBonusCraftEssences = (
  event: EventPlannerEvent,
  currencyNeed: Map<number, number>,
  otherBonus: ReadonlyMap<number, number>,
  inputs: BonusRarityInput[],
  friendRarity: BonusRarity | null,
): BonusCraftEssenceComparison => {
  const friend = inputs.find((input) => input.rarity === friendRarity)
  const solve = memoizedBonusSolver(event, currencyNeed, inputs)
  const zero = solve(bonusFor(inputs, friend, otherBonus, inputs.map(() => 0)))
  if (!zero.outcome) return { rows: [], unfarmable: zero.unfarmable }

  const best = new Map<number, BonusCraftEssenceRow>()
  const limit = MAX_BONUS_CRAFT_ESSENCES - (friend ? 1 : 0)
  for (const own of ownCombinations(inputs, limit)) {
    const bonus = bonusFor(inputs, friend, otherBonus, own)
    const { outcome } = solve(bonus)
    if (!outcome) continue
    const countOf = (rarity: BonusRarity) => {
      const k = inputs.findIndex((input) => input.rarity === rarity)
      if (k < 0) return 0
      return (own.at(k) ?? 0) + (friend?.rarity === rarity ? 1 : 0)
    }
    const row: BonusCraftEssenceRow = {
      total: own.reduce((a, b) => a + b, 0) + (friend ? 1 : 0),
      counts: { 3: countOf(3), 4: countOf(4), 5: countOf(5) },
      laps: outcome.laps,
      ap: outcome.ap,
      bonus,
    }
    const current = best.get(row.total)
    if (!current || isBetterRow(row, current)) best.set(row.total, row)
  }

  const rows = [...best.values()].sort((a, b) => a.total - b.total)
  let prev: BonusCraftEssenceRow | undefined
  for (const row of rows) {
    if (prev && prev.total === row.total - 1) row.apDrop = prev.ap - row.ap
    prev = row
  }
  return { rows, unfarmable: zero.unfarmable }
}

/** ☆ ごとの自分の枚数の組み合わせ（各 ☆ の所持枚数まで、合計 limit 枚まで）。 */
const ownCombinations = (inputs: BonusRarityInput[], limit: number): number[][] =>
  inputs.reduce<number[][]>(
    (combos, input) =>
      combos.flatMap((prefix) => {
        const used = prefix.reduce((a, b) => a + b, 0)
        const room = Math.min(input.maxOwned + input.baseOwned, limit - used)
        return Array.from({ length: room + 1 }, (_, n) => [...prefix, n])
      }),
    [[]],
  )

/** 組み合わせの各品目の +N。☆ と対応する通貨は編成から（凸を先に数える）、ほかは otherBonus。 */
const bonusFor = (
  inputs: BonusRarityInput[],
  friend: BonusRarityInput | undefined,
  otherBonus: ReadonlyMap<number, number>,
  own: number[],
): Map<number, number> => {
  const bonus = new Map(otherBonus)
  inputs.forEach((input, i) => {
    const n = own.at(i) ?? 0
    const max = Math.min(n, input.maxOwned)
    const fromFriend = friend === input ? input.maxBonus : 0
    bonus.set(input.itemId, fromFriend + max * input.maxBonus + (n - max) * input.baseBonus)
  })
  return bonus
}

type BonusOutcome = { outcome: { laps: number; ap: number } | null; unfarmable: number[] }

/** ☆ と対応する通貨の +N が同じ組み合わせは1回だけ解く。 */
const memoizedBonusSolver = (
  event: EventPlannerEvent,
  currencyNeed: Map<number, number>,
  inputs: BonusRarityInput[],
) => {
  const solved = new Map<string, BonusOutcome>()
  return (bonus: Map<number, number>): BonusOutcome => {
    const key = inputs.map((input) => bonus.get(input.itemId) ?? 0).join(',')
    const cached = solved.get(key)
    if (cached) return cached
    const plan = planShopCurrencies(applyDropBonus(event, bonus).event, currencyNeed)
    const result: BonusOutcome =
      plan.status === 'planned'
        ? {
            outcome: plan.result ? { laps: plan.result.total_lap, ap: plan.result.total_ap } : null,
            unfarmable: plan.unfarmable,
          }
        : { outcome: null, unfarmable: [] }
    solved.set(key, result)
    return result
  }
}

/** 行の ☆ ごとの枚数。 */
export const bonusRarityCount = (row: Pick<BonusCraftEssenceRow, 'counts'>, rarity: BonusRarity): number => {
  switch (rarity) {
    case 5:
      return row.counts[5]
    case 4:
      return row.counts[4]
    default:
      return row.counts[3]
  }
}

/**
 * 行の ☆ の枚数を、凸・無凸・フレンドの1枚に分ける（表示用）。
 * 計算と同じく、フレンドの1枠を除いた枚数を凸の所持枚数まで凸、残りを無凸として数える。
 */
export const bonusRaritySlots = (
  row: Pick<BonusCraftEssenceRow, 'counts'>,
  rarity: BonusRarity,
  maxOwned: number,
  friendRarity: BonusRarity | null,
): { max: number; base: number; friend: number } => {
  const friend = friendRarity === rarity ? 1 : 0
  const own = Math.max(0, bonusRarityCount(row, rarity) - friend)
  const max = Math.min(own, Math.max(0, maxOwned))
  return { max, base: own - max, friend }
}

const isBetterRow = (a: BonusCraftEssenceRow, b: BonusCraftEssenceRow): boolean => {
  if (Math.abs(a.ap - b.ap) > AP_EPSILON) return a.ap < b.ap
  if (a.laps !== b.laps) return a.laps < b.laps
  if (a.counts[5] !== b.counts[5]) return a.counts[5] < b.counts[5]
  return a.counts[4] < b.counts[4]
}

/**
 * 使う行を決める。選んだ合計枚数の行があればそれ、未選択か無くなっていれば
 * AP が最も少ない行（同じ AP なら合計枚数の少ない行）。行が無ければ undefined。
 */
export const selectBonusCraftEssenceRow = (
  rows: BonusCraftEssenceRow[],
  selectedTotal: number | undefined,
): BonusCraftEssenceRow | undefined => {
  const selected = selectedTotal === undefined ? undefined : rows.find((row) => row.total === selectedTotal)
  if (selected) return selected
  return rows.reduce<BonusCraftEssenceRow | undefined>((min, row) => {
    if (!min) return row
    if (row.ap < min.ap - AP_EPSILON) return row
    if (Math.abs(row.ap - min.ap) <= AP_EPSILON && row.total < min.total) return row
    return min
  }, undefined)
}

// ─────────────────────────────────────────────────────────────────────────────
// 逆算（欲しいアイテム数 → 最小箱数）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 欲しい素材の個数（atlas ID キー）から、箱の確定報酬でそれを満たす最小箱数を逆算する。
 *
 * @param event       EventPlannerEvent
 * @param itemDemand  atlasId → 欲しい個数
 * @param ownedCurrency 所持イベント通貨数
 */
export type ReverseCalcResult = {
  /** 必要最小箱数 */
  minBoxes: number
  /** その箱数でのボックス層結果 */
  boxLayer: BoxLayerResult
  /**
   * ボックス確定報酬では満たせなかった残余需要（atlasId → 個数）。
   * これが > 0 の場合は周回ドロップが必要。
   */
  residualDemand: Map<number, number>
}

/** 箱の確定報酬で充当しきれない残り（atlasId → 個数。0 のものは持たない）。 */
const residualAfterBoxes = (
  demand: ReadonlyMap<number, number>,
  confirmedMaterials: ReadonlyMap<number, number>,
): Map<number, number> => {
  const residual = new Map<number, number>()
  for (const [atlasId, qty] of demand) {
    const remaining = Math.max(0, qty - (confirmedMaterials.get(atlasId) ?? 0))
    if (remaining > 0) residual.set(atlasId, remaining)
  }
  return residual
}

/**
 * 指定したボックス数におけるボックス確定報酬充当後の残余需要を評価する。
 */
export const evaluateBoxes = (
  event: EventPlannerEvent,
  boxCount: number,
  ownedCurrency: number,
  itemDemand: Map<number, number>,
): Omit<ReverseCalcResult, 'minBoxes'> => {
  const boxLayer = calcBoxLayer(event, boxCount, ownedCurrency)
  return { boxLayer, residualDemand: residualAfterBoxes(itemDemand, boxLayer.confirmedMaterials) }
}

export const reverseCalcBoxes = (
  event: EventPlannerEvent,
  itemDemand: Map<number, number>,
  ownedCurrency = 0,
): ReverseCalcResult => {
  const maxBoxes = event.lotteries.length

  // 最小箱数を線形探索（ロト箱は最大でも 10〜20 程度なので O(N)で十分）
  for (let n = 0; n <= maxBoxes; n++) {
    const evaluation = evaluateBoxes(event, n, ownedCurrency, itemDemand)
    if (evaluation.residualDemand.size === 0) {
      return { minBoxes: n, ...evaluation }
    }
  }

  // 最大箱数でも満たせない場合は最大箱数を返す
  return {
    minBoxes: maxBoxes,
    ...evaluateBoxes(event, maxBoxes, ownedCurrency, itemDemand),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 育成インパクト
// ─────────────────────────────────────────────────────────────────────────────

/** 不足素材（atlasId → 個数）。 */
export type ShortfallMap = Map<number, number>

/** 周回目的で求めた実効不足から、不足のある素材だけを取り出す。 */
export const computeShortfall = (effective: Pick<EffectiveShortfall, 'shortfall'>): ShortfallMap =>
  new Map([...effective.shortfall].filter(([, deficit]) => deficit > 0))

export type RosterImpactResult = {
  /** 総不足素材（atlasId → 個数）*/
  shortfall: ShortfallMap
  /**
   * ボックス確定報酬が不足をどれだけ充当するか（atlasId → 充当数）。
   * 充当 = min(不足数, ボックス報酬数)。
   */
  coverage: Map<number, number>
  /**
   * 充当後の残余不足（atlasId → 個数）。
   * これが > 0 → フリクエ等での別途収集が必要。
   */
  residualShortfall: Map<number, number>
  /** 充当率（0〜1）: Σ充当 / Σ不足。不足 0 なら 1.0。 */
  coverageRate: number
  /** ソルバーに渡す残余需要（atlasId → 個数）。= residualShortfall。 */
  solverDemand: Map<number, number>
}

/**
 * 育成インパクトを計算する（純粋関数）。充当は箱の確定報酬だけで、交換所の品目は含めない。
 *
 * @param effective 周回目的で求めた実効不足（`computeEffectiveShortfall`）
 * @param boxLayer  calcBoxLayer の結果（N 箱分の確定報酬）
 */
export const computeRosterImpact = (
  effective: Pick<EffectiveShortfall, 'shortfall'>,
  boxLayer: BoxLayerResult,
): RosterImpactResult => {
  const shortfall = computeShortfall(effective)

  let totalShortfall = 0
  let totalCovered = 0
  const coverage = new Map<number, number>()
  const residualShortfall = new Map<number, number>()

  for (const [atlasId, deficit] of shortfall) {
    const supply = boxLayer.confirmedMaterials.get(atlasId) ?? 0
    const covered = Math.min(deficit, supply)
    const residual = deficit - covered

    totalShortfall += deficit
    totalCovered += covered

    if (covered > 0) coverage.set(atlasId, covered)
    if (residual > 0) residualShortfall.set(atlasId, residual)
  }

  const coverageRate = totalShortfall > 0 ? totalCovered / totalShortfall : 1.0

  return {
    shortfall,
    coverage,
    residualShortfall,
    coverageRate,
    solverDemand: residualShortfall,
  }
}

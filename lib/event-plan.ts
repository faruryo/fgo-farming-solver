/**
 * lib/event-plan.ts
 *
 * イベント（ロト型）計画の純粋関数群。React フック不使用。UI 層が hook 経由でデータを注入する。
 *
 * Task 9  — ボックス層（決定論）: calcBoxLayer
 * Task 10 — 交換所配分（limitNum 上限付き貪欲法）: allocateShop
 * Task 11 — ソルバーアダプタ: buildEventDrops / runEventSolver
 * Task 12 — 逆算（欲しいアイテム数 → 最小箱数）: reverseCalcBoxes
 * Task 13 — ロスター育成インパクト（純粋、ChaldeaState を引数で受け取る）: computeRosterImpact
 */

import type {
  EventPlannerEvent,
  EventShopItem,
} from './master-data/types'
import type { Drops } from './get-drops'
import type { Params, Result } from '../interfaces/api'
import { solve } from './solver'
import type { ChaldeaState } from '../hooks/create-chaldea-state'
import type { MaterialsForServants } from './get-materials'

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
// Task 9 — ボックス層
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
// Task 10 — 交換所配分
// ─────────────────────────────────────────────────────────────────────────────

export type ShopAllocationItem = {
  shopItem: EventShopItem
  /** 実際に購入する回数（limitNum で打ち切り済み）。 */
  allocated: number
  /** 取得できる素材総数（= allocated × shopItem.qty）。 */
  totalQty: number
  /** 要求が limitNum を超えたかどうか（警告フラグ）。 */
  cappedByLimit: boolean
  /** limitNum を超えた要求数（cappedByLimit=true のとき > 0）。 */
  overflow: number
}

export type ShopAllocationResult = {
  allocations: ShopAllocationItem[]
  /** 交換に必要な通貨総量（各アイテムの costAmount × allocated の和）。 */
  totalCurrencyUsed: number
  /** 1 件以上の上限超過警告がある */
  hasOverflow: boolean
}

/**
 * 交換所アイテムを指定個数まで配分する。
 * limitNum で上限打ち切り + 超過分は overflow に記録（US-6）。
 *
 * @param shop       EventShopItem[]
 * @param demand     atlasId → 欲しい素材個数（0 以下は無視）
 */
export const allocateShop = (
  shop: EventShopItem[],
  demand: Map<number, number>,
): ShopAllocationResult => {
  const allocations: ShopAllocationItem[] = []
  let totalCurrencyUsed = 0
  let hasOverflow = false

  for (const shopItem of shop) {
    const wanted = demand.get(shopItem.itemId) ?? 0
    if (wanted <= 0) {
      allocations.push({
        shopItem,
        allocated: 0,
        totalQty: 0,
        cappedByLimit: false,
        overflow: 0,
      })
      continue
    }

    // 欲しい個数から必要購入回数（ceil）を求め limitNum で打ち切り
    const wantedPurchases = Math.ceil(wanted / shopItem.qty)
    const cappedPurchases = Math.min(wantedPurchases, shopItem.limitNum)
    const cappedByLimit = wantedPurchases > shopItem.limitNum
    const overflow = cappedByLimit ? (wantedPurchases - shopItem.limitNum) * shopItem.qty : 0

    if (cappedByLimit) hasOverflow = true

    const totalQty = cappedPurchases * shopItem.qty
    totalCurrencyUsed += cappedPurchases * shopItem.costAmount

    allocations.push({
      shopItem,
      allocated: cappedPurchases,
      totalQty,
      cappedByLimit,
      overflow,
    })
  }

  return { allocations, totalCurrencyUsed, hasOverflow }
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 11 — ソルバーアダプタ
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

// ─────────────────────────────────────────────────────────────────────────────
// Task 12 — 逆算（欲しいアイテム数 → 最小箱数）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 欲しい素材の個数（atlas ID キー）から、それを満たす最小箱数を逆算する。
 * 交換所の limitNum も考慮する。
 *
 * @param event       EventPlannerEvent
 * @param itemDemand  atlasId → 欲しい個数（ボックス確定報酬 or 交換所で得たい）
 * @param ownedCurrency 所持イベント通貨数
 */
export type ReverseCalcResult = {
  /** 必要最小箱数 */
  minBoxes: number
  /** その箱数でのボックス層結果 */
  boxLayer: BoxLayerResult
  /** 交換所配分結果 */
  shopAllocation: ShopAllocationResult
  /**
   * ボックス確定報酬 + 交換所では満たせなかった残余需要（atlasId → 個数）。
   * これが > 0 の場合は周回ドロップが必要。
   */
  residualDemand: Map<number, number>
}

export const reverseCalcBoxes = (
  event: EventPlannerEvent,
  itemDemand: Map<number, number>,
  ownedCurrency = 0,
): ReverseCalcResult => {
  const maxBoxes = event.lotteries.length

  // 最小箱数を線形探索（ロト箱は最大でも 10〜20 程度なので O(N)で十分）
  for (let n = 0; n <= maxBoxes; n++) {
    const boxLayer = calcBoxLayer(event, n, ownedCurrency)

    // 交換所配分: itemDemand から ボックス確定報酬で充当済みの分を引いた残りを交換所に
    const residualAfterBoxes = new Map<number, number>()
    for (const [atlasId, qty] of itemDemand) {
      const fromBoxes = boxLayer.confirmedMaterials.get(atlasId) ?? 0
      const remaining = Math.max(0, qty - fromBoxes)
      if (remaining > 0) residualAfterBoxes.set(atlasId, remaining)
    }

    const shopAllocation = allocateShop(event.shop, residualAfterBoxes)

    // 交換所配分後の残余需要
    const residualDemand = new Map<number, number>()
    for (const [atlasId, qty] of residualAfterBoxes) {
      const shopItem = event.shop.find((s) => s.itemId === atlasId)
      const fromShop = shopAllocation.allocations.find(
        (a) => a.shopItem.itemId === atlasId,
      )?.totalQty ?? 0
      const remaining = Math.max(0, qty - fromShop)
      if (remaining > 0) residualDemand.set(atlasId, remaining)
      // 溢れ（limitNum 超過）が出た場合も residualDemand に含まれている
      if (shopItem && fromShop < qty) {
        residualDemand.set(atlasId, remaining)
      }
    }

    // このボックス数で全需要が（ボックス + 交換所で）充足できるか判定
    const allSatisfied = Array.from(itemDemand.keys()).every((atlasId) => {
      return (residualDemand.get(atlasId) ?? 0) === 0
    })

    if (allSatisfied) {
      return { minBoxes: n, boxLayer, shopAllocation, residualDemand }
    }
  }

  // 最大箱数でも満たせない場合は最大箱数を返す
  const boxLayer = calcBoxLayer(event, maxBoxes, ownedCurrency)
  const residualAfterBoxes = new Map<number, number>()
  for (const [atlasId, qty] of itemDemand) {
    const fromBoxes = boxLayer.confirmedMaterials.get(atlasId) ?? 0
    const remaining = Math.max(0, qty - fromBoxes)
    if (remaining > 0) residualAfterBoxes.set(atlasId, remaining)
  }
  const shopAllocation = allocateShop(event.shop, residualAfterBoxes)
  const residualDemand = new Map<number, number>()
  for (const [atlasId, qty] of residualAfterBoxes) {
    const fromShop = shopAllocation.allocations.find(
      (a) => a.shopItem.itemId === atlasId,
    )?.totalQty ?? 0
    const remaining = Math.max(0, qty - fromShop)
    if (remaining > 0) residualDemand.set(atlasId, remaining)
  }

  return { minBoxes: maxBoxes, boxLayer, shopAllocation, residualDemand }
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 13 — ロスター育成インパクト
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 指定サーヴァント・目標・所持から不足素材マップを構築する（atlasId キー）。
 * get-materials.ts の MaterialsForServants 構造を消費する。
 *
 * @param chaldeaState  useChaldeaState で得た育成目標（read-only）
 * @param materialsForServants  getMaterialsForServantIds の結果（事前に取得してインジェクト）
 * @param possessionCounts  localStorage 'items' の atlasId → 所持数
 */
export type ShortfallMap = Map<number, number>

export const computeShortfall = (
  chaldeaState: ChaldeaState,
  materialsForServants: MaterialsForServants,
  possessionCounts: Record<string, number>,
): ShortfallMap => {
  // 全育成目標の必要素材合計を atlasId キーで集計する
  const totalNeed = new Map<number, number>()

  for (const [servantIdStr, servantState] of Object.entries(chaldeaState)) {
    if (servantState.disabled) continue
    if (servantIdStr === 'all') continue

    const servantMaterials = materialsForServants[servantIdStr]
    if (!servantMaterials) continue

    // ascension / skill / appendSkill それぞれの目標を合算
    for (const [targetKey, targetState] of Object.entries(servantState.targets) as [string, { disabled: boolean; ranges: { start: number; end: number }[] }][]) {
      if (targetState.disabled) continue

      const materialKey = targetKey === 'appendSkill'
        ? 'appendSkillMaterials'
        : targetKey === 'skill'
        ? 'skillMaterials'
        : 'ascensionMaterials'

      const materials = servantMaterials[materialKey as keyof typeof servantMaterials]
      if (!materials) continue

      for (const range of targetState.ranges) {
        const { start, end } = range
        if (start >= end) continue

        for (let lv = start; lv < end; lv++) {
          const step = materials[lv.toString()]
          if (!step) continue
          for (const { item, amount } of step.items) {
            const atlasId = item.id
            totalNeed.set(atlasId, (totalNeed.get(atlasId) ?? 0) + amount)
          }
          // QP (atlasId=1) も加算
          if (step.qp) {
            totalNeed.set(1, (totalNeed.get(1) ?? 0) + step.qp)
          }
        }
      }
    }
  }

  // 所持数を差し引いて不足マップを生成
  const shortfall: ShortfallMap = new Map()
  for (const [atlasId, needed] of totalNeed) {
    const owned = possessionCounts[String(atlasId)] ?? 0
    const deficit = Math.max(0, needed - owned)
    if (deficit > 0) shortfall.set(atlasId, deficit)
  }

  return shortfall
}

export type RosterImpactResult = {
  /** 総不足素材（atlasId → 個数）*/
  shortfall: ShortfallMap
  /**
   * ボックス確定報酬 + 交換所が不足をどれだけ充当するか（atlasId → 充当数）。
   * 充当 = min(不足数, ボックス報酬数 + 交換所取得数)。
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
 * ロスターの育成インパクトを計算する（純粋関数）。
 *
 * 非同期データ（getMaterialsForServantIds）は呼び出し側で await して注入する。
 * この関数自体は同期で完結し、テスタビリティを最大化する。
 *
 * @param chaldeaState          育成目標（read-only, useChaldeaState から）
 * @param materialsForServants  getMaterialsForServantIds の結果
 * @param possessionCounts      atlasId → 所持数（localStorage 'items' から）
 * @param boxLayer              calcBoxLayer の結果（N 箱分の確定報酬）
 * @param shopAllocation        allocateShop の結果
 */
export const computeRosterImpact = (
  chaldeaState: ChaldeaState,
  materialsForServants: MaterialsForServants,
  possessionCounts: Record<string, number>,
  boxLayer: BoxLayerResult,
  shopAllocation: ShopAllocationResult,
): RosterImpactResult => {
  const shortfall = computeShortfall(chaldeaState, materialsForServants, possessionCounts)

  // ボックス + 交換所の素材マップを合算（atlasId → 総取得数）
  const eventSupply = new Map<number, number>(boxLayer.confirmedMaterials)
  for (const alloc of shopAllocation.allocations) {
    if (alloc.totalQty > 0) {
      const id = alloc.shopItem.itemId
      eventSupply.set(id, (eventSupply.get(id) ?? 0) + alloc.totalQty)
    }
  }

  let totalShortfall = 0
  let totalCovered = 0
  const coverage = new Map<number, number>()
  const residualShortfall = new Map<number, number>()

  for (const [atlasId, deficit] of shortfall) {
    const supply = eventSupply.get(atlasId) ?? 0
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

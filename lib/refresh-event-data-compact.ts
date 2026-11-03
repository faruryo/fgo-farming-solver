/**
 * scripts/refresh-event-data.ts の純粋ロジック（副作用なし・テスト対象）。
 *
 * - 交換所のコンパクト化（対価の通貨の表示名・アイコンを itemMap から付与）。
 * - イベントを取り込むか（ロト型 / ロトの無い交換所イベント / スキップ）の判定。
 * - ポイント報酬・ミッション・イベントポイントの品目の整形と、イベントごとの KV キーの bulk put 行。
 */
import type {
  EventBonusCraftEssence,
  EventBonusRarity,
  EventCurrency,
  EventFarmingNode,
  EventGift,
  EventMission,
  EventPlannerEvent,
  EventPointReward,
  EventRewards,
  EventShopItem,
} from './master-data/types'

/**
 * Atlas nice_item の id → 表示名・アイコン・品目の種類（Atlas の type。eventPoint 等）・
 * individuality の id（ボーナス礼装の対象との突き合わせに使う）。
 */
export type ItemMap = Map<number, { name: string; icon: string; type: string; individuality?: number[] }>

/** Atlas basic_svt の id → 表示名・レア度・アイコン（face の URL）。 */
export type SvtMap = Map<number, { name: string; rarity: number; face: string }>

export interface AtlasShopItem {
  purchaseType: string
  payType: string
  targetIds: number[]
  setNum: number
  limitNum: number
  /** 交換所の見出し。svt の情報が取れないときの名前に使う。 */
  name?: string
  cost: {
    item: { id: number }
    amount: number
  }
  gifts?: unknown[]
  /** ゲーム内の交換所の並び順（小さいほど前）。 */
  priority?: number
  /** ゲーム内の交換所の区分（タブ）。 */
  slot?: number
}

/** 取り込む交換所データか（アイテム・サーヴァント扱いの交換で、対価がイベントアイテム、獲得物がある）。 */
const isImportedShopEntry = (s: AtlasShopItem): boolean =>
  (s.purchaseType === 'item' || s.purchaseType === 'servant') &&
  s.payType === 'eventItem' &&
  Array.isArray(s.targetIds) &&
  s.targetIds.length > 0

/**
 * 取り込む交換所データを、ゲーム内の交換所の順に安定に並べる。
 * 区分（slot。無いものは同じ1つの区分）ごとにまとめ、区分どうしはその区分の最小の priority の順、
 * 区分の中は priority の順にする。区分の違うものを交互に並べないため。
 * 取り込む交換所データのどれかに数の priority が無いときは、並べ替えずに元の順で返す。
 */
export function sortShopByPriority(shop: AtlasShopItem[]): AtlasShopItem[] {
  const targets = shop.filter(isImportedShopEntry)
  if (!targets.every(s => typeof s.priority === 'number' && Number.isFinite(s.priority))) return targets
  const slotMin = new Map<number | undefined, number>()
  for (const s of targets) {
    const p = s.priority as number
    const current = slotMin.get(s.slot)
    if (current === undefined || p < current) slotMin.set(s.slot, p)
  }
  const slotOrder = [...slotMin].sort((a, b) => a[1] - b[1]).map(([slot]) => slot)
  const slotRank = new Map(slotOrder.map((slot, i) => [slot, i]))
  return targets
    .map((s, index) => ({ s, index }))
    .sort(
      (a, b) =>
        (slotRank.get(a.s.slot) as number) - (slotRank.get(b.s.slot) as number) ||
        (a.s.priority as number) - (b.s.priority as number) ||
        a.index - b.index,
    )
    .map(({ s }) => s)
}

/**
 * AtlasShopItem[] → EventShopItem[] の変換（渡された順のまま）。
 * purchaseType が item（アイテム）と servant（種火・フォウくん・礼装など）で、対価がイベントアイテムのものを取る。
 * servant は kind='svt' にし、名前・レア度・アイコンを svtMap から付ける（無ければ見出しを名前にする）。
 */
export function compactShop(shop: AtlasShopItem[], itemMap: ItemMap, svtMap?: SvtMap): EventShopItem[] {
  return shop
    .filter(isImportedShopEntry)
    .flatMap(s => {
      // gifts が空のときは targetIds × setNum で報酬を決定（Phase 0 確認済み）
      const costMeta = itemMap.get(s.cost.item.id)
      const base = (itemId: number) => ({
        itemId,
        qty: s.setNum ?? 1,
        costItemId: s.cost.item.id,
        costAmount: s.cost.amount,
        limitNum: s.limitNum ?? 0,
      })
      const costFields = {
        ...(costMeta ? { costName: costMeta.name } : {}),
        ...(costMeta?.icon ? { costIcon: costMeta.icon } : {}),
      }
      if (s.purchaseType === 'servant') {
        return s.targetIds.map((itemId): EventShopItem => {
          const meta = svtMap?.get(itemId)
          return {
            ...base(itemId),
            kind: 'svt',
            name: meta?.name ?? s.name ?? '',
            ...(meta?.face ? { icon: meta.face } : {}),
            ...(meta ? { rarity: meta.rarity } : {}),
            ...costFields,
          }
        })
      }
      return s.targetIds.map(itemId => {
        const meta = itemMap.get(itemId)
        return {
          ...base(itemId),
          name: meta?.name ?? '',
          ...(meta?.icon ? { icon: meta.icon } : {}),
          ...costFields,
        }
      })
    })
}

export interface AtlasDrop {
  objectId: number
  num: number
  runs: number
  dropCount: number
}

const round4 = (v: number): number => Math.round(v * 10000) / 10000

/**
 * Atlas のクエストのドロップ → EventFarmingNode['drops']。
 * runs 0 のものと 1周あたり期待値がほぼ 0 のものは除く。
 */
export function compactDrops(drops: AtlasDrop[], itemMap: ItemMap): EventFarmingNode['drops'] {
  return drops
    .filter(d => d.runs > 0)
    .map(d => {
      const meta = itemMap.get(d.objectId)
      return {
        itemId: d.objectId,
        perRun: round4((d.dropCount / d.runs) * d.num),
        countPerRun: round4(d.dropCount / d.runs),
        name: meta?.name ?? '',
        ...(meta?.icon ? { icon: meta.icon } : {}),
      }
    })
    .filter(d => d.perRun > 0.0001)
}

export type EventImportDecision =
  | { kind: 'skip'; reason: string }
  | { kind: 'lottery' }
  | {
      kind: 'shop'
      currency: EventCurrency
      unlimitedBoxes: false
      lotteries: []
    }

/**
 * Atlas のロト件数・検証に通ったロト件数・交換所（compactShop の結果）から取り込み方を決める。
 *
 * - ロトが1件以上あって検証が全滅したら skip（交換所イベントとして入れると既存の箱データを空のロトで上書きするため）。
 * - ロトが無く交換所も空なら skip。
 * - ロトが無く交換所があれば、最初のアイテムの品目（無ければ最初のサーヴァント扱いの品目）の
 *   対価の通貨を currency にする。サーヴァント扱いの品目が先に並んでも既存の通貨を変えないため。
 */
export function decideEventImport(
  atlasLotteryCount: number,
  validLotteryCount: number,
  shop: EventShopItem[],
  itemMap: ItemMap,
): EventImportDecision {
  if (atlasLotteryCount > 0) {
    return validLotteryCount > 0
      ? { kind: 'lottery' }
      : { kind: 'skip', reason: 'all lotteries failed validation' }
  }
  const first = shop.find(s => s.kind !== 'svt') ?? shop[0]
  if (!first) return { kind: 'skip', reason: 'no lotteries and no shop items' }
  const meta = itemMap.get(first.costItemId)
  return {
    kind: 'shop',
    currency: { id: first.costItemId, name: meta?.name ?? '', icon: meta?.icon ?? '' },
    unlimitedBoxes: false,
    lotteries: [],
  }
}

// ── ポイント報酬・ミッション ─────────────────────────────────────────

export interface AtlasRewardGift {
  type: string
  objectId: number
  num: number
}

export interface AtlasPointReward {
  groupId?: number
  point: number
  gifts: AtlasRewardGift[]
}

export interface AtlasMissionCond {
  missionProgressType: string
  condType: string
  targetIds: number[]
  targetNum: number
  details?: { missionCondType: number; targetIds: number[] }[]
}

export interface AtlasMission {
  id: number
  dispNo: number
  type: string
  name: string
  gifts: AtlasRewardGift[]
  conds: AtlasMissionCond[]
}

/** Atlas gift → EventGift。アイテムには交換所と同じく名前とアイコンを付ける。 */
function compactGift(g: AtlasRewardGift, itemMap: ItemMap): EventGift {
  const base = { objType: g.type, itemId: g.objectId, num: g.num }
  if (g.type !== 'item') return base
  const meta = itemMap.get(g.objectId)
  return {
    ...base,
    name: meta?.name ?? '',
    ...(meta?.icon ? { icon: meta.icon } : {}),
  }
}

/** Atlas rewards → 累計ポイントの昇順の EventPointReward[]。 */
export function compactPointRewards(rewards: AtlasPointReward[], itemMap: ItemMap): EventPointReward[] {
  return rewards
    .map(r => ({ point: r.point, gifts: r.gifts.map(g => compactGift(g, itemMap)) }))
    .sort((a, b) => a.point - b.point)
}

/**
 * Atlas missions → 表示順の EventMission[]。
 * 条件は達成の条件（missionProgressType が clear）だけを残し、開放・開始の条件は落とす。
 */
export function compactMissions(missions: AtlasMission[], itemMap: ItemMap): EventMission[] {
  return [...missions]
    .sort((a, b) => a.dispNo - b.dispNo || a.id - b.id)
    .map(m => ({
      id: m.id,
      dispNo: m.dispNo,
      type: m.type,
      name: m.name,
      gifts: m.gifts.map(g => compactGift(g, itemMap)),
      conds: m.conds
        .filter(c => c.missionProgressType === 'clear')
        .map(c => ({
          condType: c.condType,
          targetIds: c.targetIds,
          targetNum: c.targetNum,
          ...(c.details && c.details.length > 0
            ? {
                details: c.details.map(d => ({
                  missionCondType: d.missionCondType,
                  targetIds: d.targetIds,
                })),
              }
            : {}),
        })),
    }))
}

/**
 * 周回クエストのドロップのうち、種類が eventPoint の品目で1周あたりの見込みの合計が
 * 最大のもの（同じなら ID の小さいもの）を返す。無ければ undefined。
 */
export function findPointItemId(farmingNodes: EventFarmingNode[], itemMap: ItemMap): number | undefined {
  const totals = new Map<number, number>()
  for (const node of farmingNodes) {
    for (const d of node.drops) {
      if (itemMap.get(d.itemId)?.type !== 'eventPoint') continue
      totals.set(d.itemId, (totals.get(d.itemId) ?? 0) + d.perRun)
    }
  }
  let best: { id: number; total: number } | undefined
  for (const [id, total] of totals) {
    if (!best || total > best.total || (total === best.total && id < best.id)) {
      best = { id, total }
    }
  }
  return best?.id
}

/**
 * 整形を試み、入力のフィールドが無い（undefined / null）か整形が例外を投げたら
 * undefined（取れなかった）を返す。取れなかったイベントは KV の前の値を残すために書かない。
 */
export function tryCompact<T, R>(raw: T | undefined | null, compact: (raw: T) => R): R | undefined {
  if (raw === undefined || raw === null) return undefined
  try {
    return compact(raw)
  } catch {
    return undefined
  }
}

export interface EventRewardsEntry {
  eventId: number
  pointRewards: EventPointReward[] | undefined
  missions: EventMission[] | undefined
  pointItemId: number | undefined
}

export interface EventRewardsBulkRow {
  key: string
  value: string
}

/** イベントごとの KV キー。 */
export const eventRewardsKey = (eventId: number): string => `event_rewards:${eventId}`

/**
 * 取り込んだイベントから `wrangler kv bulk put` 用の行を作る。
 * ポイント報酬かミッションが取れなかった（undefined）イベントは入れない（空配列は入れる）。
 * bulk put の value は文字列なので JSON を文字列化して入れる。
 */
export function buildEventRewardsRows(entries: EventRewardsEntry[], updatedAt: number): EventRewardsBulkRow[] {
  return entries.flatMap(e => {
    if (e.pointRewards === undefined || e.missions === undefined) return []
    const value: EventRewards = {
      pointRewards: e.pointRewards,
      missions: e.missions,
      ...(e.pointItemId !== undefined ? { pointItemId: e.pointItemId } : {}),
      updatedAt,
    }
    return [{ key: eventRewardsKey(e.eventId), value: JSON.stringify(value) }]
  })
}

// ── ボーナス礼装の ☆ と通貨の対応 ─────────────────────────────────────

export interface AtlasEquipSval {
  EventId?: number
  Individuality?: number
  /** ドロップ1つあたりの加算数（+N）。 */
  AddCount?: number
}

export interface AtlasEquipFunction {
  funcType: string
  svals?: AtlasEquipSval[]
}

export interface AtlasEquipSkill {
  condLimitCount?: number
  functions?: AtlasEquipFunction[]
}

/** Atlas nice_equip の1件（使う項目だけ）。face は extraAssets.faces.equip[id]。 */
export interface AtlasEquip {
  id: number
  name: string
  rarity: number
  skills?: AtlasEquipSkill[]
  extraAssets?: { faces?: { equip?: Record<string, string> } }
}

const isBonusRarity = (r: number): r is EventBonusRarity['rarity'] => r === 3 || r === 4 || r === 5

/**
 * 礼装のうち、そのイベントのドロップを増やす効果（eventDropUp）が指す individuality の集合。
 * 凸と無凸のスキルで同じものを指すときは1つとして数える。
 */
function dropUpTargets(equip: AtlasEquip, eventId: number): Set<number> {
  const targets = new Set<number>()
  for (const skill of equip.skills ?? []) {
    for (const fn of skill.functions ?? []) {
      if (fn.funcType !== 'eventDropUp') continue
      for (const sv of fn.svals ?? []) {
        if (sv.EventId === eventId && typeof sv.Individuality === 'number') targets.add(sv.Individuality)
      }
    }
  }
  return targets
}

/**
 * 礼装の、そのイベントの eventDropUp の AddCount（+N）。
 * condLimitCount 0（無凸、未指定も 0）が base、4（凸）が max。同じ礼装が持つ別イベントのスキルは見ない。
 * スキルごとに EventId が一致する最初の sval の値を使う。
 */
function dropUpBonus(equip: AtlasEquip, eventId: number): { base?: number; max?: number } {
  const addCountAt = (cond: number): number | undefined => {
    for (const skill of equip.skills ?? []) {
      if ((skill.condLimitCount ?? 0) !== cond) continue
      for (const fn of skill.functions ?? []) {
        if (fn.funcType !== 'eventDropUp') continue
        const add = fn.svals?.find(sv => sv.EventId === eventId)?.AddCount
        if (typeof add === 'number') return add
      }
    }
    return undefined
  }
  return { base: addCountAt(0), max: addCountAt(4) }
}

/** その ☆ の数えた礼装すべてで base・max がそろい、礼装間で同じ値のときだけ { base, max }。 */
function commonBonus(equips: AtlasEquip[], eventId: number): EventBonusRarity['bonus'] {
  const [first, ...rest] = equips.map(e => dropUpBonus(e, eventId))
  if (first?.base === undefined || first.max === undefined) return undefined
  const { base, max } = first
  return rest.every(b => b.base === base && b.max === max) ? { base, max } : undefined
}

const toCraftEssence = (e: AtlasEquip): EventBonusCraftEssence => {
  const face = e.extraAssets?.faces?.equip?.[String(e.id)]
  return { id: e.id, name: e.name, ...(face ? { face } : {}) }
}

/** 交換所の通貨の individuality → 通貨の id。 */
function currencyIndividualities(shop: EventShopItem[], itemMap: ItemMap): Map<number, number> {
  const byIndividuality = new Map<number, number>()
  for (const currencyId of new Set(shop.map(s => s.costItemId))) {
    for (const ind of itemMap.get(currencyId)?.individuality ?? []) {
      if (!byIndividuality.has(ind)) byIndividuality.set(ind, currencyId)
    }
  }
  return byIndividuality
}

/**
 * ☆ ごとの「対象が1つだけでそれが交換所の通貨である礼装」の通貨の集合とその礼装（入力順）、
 * 対象が2つ以上の礼装が対象にする交換所の通貨の集合。
 */
function collectDropUpCurrencies(
  equips: AtlasEquip[],
  eventId: number,
  currencyByIndividuality: Map<number, number>,
): {
  singles: Map<EventBonusRarity['rarity'], { currencies: Set<number>; equips: AtlasEquip[] }>
  multiTargeted: Set<number>
} {
  const singles = new Map<EventBonusRarity['rarity'], { currencies: Set<number>; equips: AtlasEquip[] }>()
  const multiTargeted = new Set<number>()
  for (const equip of equips) {
    if (!isBonusRarity(equip.rarity)) continue
    const currencies = [...dropUpTargets(equip, eventId)].map(ind => currencyByIndividuality.get(ind))
    const targeted = currencies.filter((id): id is number => id !== undefined)
    if (currencies.length > 1) {
      for (const id of targeted) multiTargeted.add(id)
    } else if (targeted.length === 1) {
      const entry = singles.get(equip.rarity) ?? { currencies: new Set<number>(), equips: [] }
      entry.currencies.add(targeted[0])
      entry.equips.push(equip)
      singles.set(equip.rarity, entry)
    }
  }
  return { singles, multiTargeted }
}

/**
 * ロトの無い交換所イベントの、ボーナス礼装の ☆ と交換所の通貨の対応を決める（☆ の降順）。
 *
 * - ☆ ごとに、対象が1つだけでそれが交換所の通貨である礼装を集め、それらがすべて同じ通貨を対象にし、
 *   その通貨をほかの ☆ の礼装が対象にしないときだけ対応させる。
 * - 対象が1つでも交換所の通貨でない礼装は数えない。
 * - 対象が2つ以上の礼装が対象にする通貨は対応させない。ポイントを増やす効果（eventPointUp）は見ない。
 *
 * 各対応には、数えた礼装（craftEssences。入力順、name と face）と、礼装1枚あたりの +N（bonus）を付ける。
 * bonus は数えた礼装すべてで無凸・凸の AddCount が取れて同じ値のときだけ付ける（食い違えば付けない）。
 */
export function decideBonusRarities(
  equips: AtlasEquip[],
  eventId: number,
  shop: EventShopItem[],
  itemMap: ItemMap,
): EventBonusRarity[] {
  const { singles, multiTargeted } = collectDropUpCurrencies(equips, eventId, currencyIndividualities(shop, itemMap))
  const result: EventBonusRarity[] = []
  for (const rarity of [5, 4, 3] as const) {
    const entry = singles.get(rarity)
    if (!entry || entry.currencies.size !== 1) continue
    const [itemId] = entry.currencies
    if (multiTargeted.has(itemId)) continue
    const usedByOther = [...singles].some(([r, other]) => r !== rarity && other.currencies.has(itemId))
    if (usedByOther) continue
    const bonus = commonBonus(entry.equips, eventId)
    result.push({ rarity, itemId, craftEssences: entry.equips.map(toCraftEssence), ...(bonus ? { bonus } : {}) })
  }
  return result
}

/**
 * 取り込んだ交換所イベントに ☆ と通貨の対応を付ける。
 * 対応は atlasOrderShop（並べ替える前の Atlas の順の品目。省略時は event.shop）から決める。
 * 交換所の並べ替えで対応が変わらないようにするため。
 * 礼装のデータが取れなかった（equips が undefined）ときは、既存のデータの同じ id のイベントが
 * 対応を持っていればそれを引き継ぎ、無ければ項目を付けない。
 */
export function attachBonusRarities(
  event: EventPlannerEvent,
  equips: AtlasEquip[] | undefined,
  itemMap: ItemMap,
  existingEvents: EventPlannerEvent[],
  atlasOrderShop: EventShopItem[] = event.shop,
): EventPlannerEvent {
  if (equips) {
    return { ...event, bonusRarities: decideBonusRarities(equips, event.id, atlasOrderShop, itemMap) }
  }
  const previous = existingEvents.find(e => e.id === event.id)?.bonusRarities
  return previous ? { ...event, bonusRarities: previous } : event
}

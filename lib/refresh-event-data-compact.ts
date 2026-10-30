/**
 * scripts/refresh-event-data.ts の純粋ロジック（副作用なし・テスト対象）。
 *
 * - 交換所のコンパクト化（対価の通貨の表示名・アイコンを itemMap から付与）。
 * - イベントを取り込むか（ロト型 / ロトの無い交換所イベント / スキップ）の判定。
 * - ポイント報酬・ミッション・イベントポイントの品目の整形と、イベントごとの KV キーの bulk put 行。
 */
import type {
  EventCurrency,
  EventFarmingNode,
  EventGift,
  EventMission,
  EventPointReward,
  EventRewards,
  EventShopItem,
} from './master-data/types'

/** Atlas nice_item の id → 表示名・アイコン・品目の種類（Atlas の type。eventPoint 等）。 */
export type ItemMap = Map<number, { name: string; icon: string; type: string }>

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
}

/**
 * AtlasShopItem[] → EventShopItem[] の変換。
 * purchaseType が item（アイテム）と servant（種火・フォウくん・礼装など）で、対価がイベントアイテムのものを取る。
 * servant は kind='svt' にし、名前・レア度・アイコンを svtMap から付ける（無ければ見出しを名前にする）。
 */
export function compactShop(shop: AtlasShopItem[], itemMap: ItemMap, svtMap?: SvtMap): EventShopItem[] {
  return shop
    .filter(s => (s.purchaseType === 'item' || s.purchaseType === 'servant') && s.payType === 'eventItem')
    .flatMap(s => {
      // gifts が空のときは targetIds × setNum で報酬を決定（Phase 0 確認済み）
      if (!s.targetIds || s.targetIds.length === 0) return []
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

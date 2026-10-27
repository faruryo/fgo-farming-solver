/**
 * 交換所のエントリーを対価の通貨ごとにまとめ、通貨ごとの全交換に要る合計を出す純粋関数。
 */
import type { EventShopItem } from './master-data/types'

export interface ShopCurrencyGroup {
  costItemId: number
  /** 対価の通貨の表示名。どのエントリーにも無ければ undefined（旧 KV データ）。 */
  costName?: string
  costIcon?: string
  /** 在庫上限のある品目をすべて交換するのに要る通貨の合計（`costAmount × limitNum` の和）。 */
  totalCost: number
  /** 在庫上限の無い（`limitNum` が 0 の）品目の数。合計には含めない。 */
  unlimitedCount: number
  items: EventShopItem[]
}

/** 通貨は最初に現れた順、品目は元の順で返す。 */
export const groupShopByCurrency = (shop: EventShopItem[]): ShopCurrencyGroup[] => {
  const groups = new Map<number, ShopCurrencyGroup>()
  for (const item of shop) {
    let group = groups.get(item.costItemId)
    if (!group) {
      group = { costItemId: item.costItemId, totalCost: 0, unlimitedCount: 0, items: [] }
      groups.set(item.costItemId, group)
    }
    group.costName ??= item.costName
    group.costIcon ??= item.costIcon
    if (item.limitNum > 0) group.totalCost += item.costAmount * item.limitNum
    else group.unlimitedCount += 1
    group.items.push(item)
  }
  return [...groups.values()]
}

/** 品目ごとの交換回数。キーは交換所の配列の添字。 */
export type ShopExchangeCounts = ReadonlyMap<number, number>

/** 入れた回数を0以上の整数にし、在庫上限のある品目は上限で頭打ちにする。 */
export const clampExchangeCount = (item: EventShopItem, count: number): number => {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return item.limitNum > 0 ? Math.min(n, item.limitNum) : n
}

export interface ShopCurrencyNeed {
  costItemId: number
  /** 選んだ交換の対価の合計。 */
  selectedCost: number
  /** 対価の合計から所持数を引いた量（0未満は0）。 */
  need: number
}

/** 通貨ごとに選んだ交換の対価の合計と必要量を出す。通貨は交換所に最初に現れた順。 */
export const computeShopCurrencyNeeds = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
  owned: ReadonlyMap<number, number>,
): ShopCurrencyNeed[] => {
  const costs = new Map<number, number>()
  shop.forEach((item, index) => {
    const count = clampExchangeCount(item, counts.get(index) ?? 0)
    costs.set(item.costItemId, (costs.get(item.costItemId) ?? 0) + item.costAmount * count)
  })
  return [...costs].map(([costItemId, selectedCost]) => ({
    costItemId,
    selectedCost,
    need: Math.max(0, selectedCost - Math.max(0, owned.get(costItemId) ?? 0)),
  }))
}

/** その通貨で在庫上限のある品目をすべて上限の回数にした回数を返す。上限の無い品目は変えない。 */
export const selectAllUpToLimit = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
  costItemId: number,
): Map<number, number> => {
  const next = new Map(counts)
  shop.forEach((item, index) => {
    if (item.costItemId === costItemId && item.limitNum > 0) next.set(index, item.limitNum)
  })
  return next
}

/** 交換所のすべての通貨で、在庫上限のある品目をすべて上限の回数にした回数を返す。上限の無い品目は変えない。 */
export const selectAllCurrenciesUpToLimit = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
): Map<number, number> => {
  let next = new Map(counts)
  for (const costItemId of new Set(shop.map(item => item.costItemId))) {
    next = selectAllUpToLimit(shop, next, costItemId)
  }
  return next
}

export interface RankedShopItem {
  item: EventShopItem
  /** 1からの順位。 */
  rank: number
  /** 通貨1個あたりの AP 換算値（`qty × AP 換算値 ÷ costAmount`）。 */
  efficiency: number
}

export interface ShopEfficiencyOrder {
  /** AP 換算値の無い品目（元の順）。 */
  unpriced: EventShopItem[]
  /** AP 換算値のある品目（効率の高い順、同じ効率は元の順）。 */
  ranked: RankedShopItem[]
}

/**
 * 通貨のグループの品目を、AP 換算値の無い品目（元の順）と効率順の品目に分ける。
 * `apPrices` は atlasId → 素材1個の AP 換算値。
 */
export const orderShopByEfficiency = (
  group: Pick<ShopCurrencyGroup, 'items'>,
  apPrices: Readonly<Record<number, number>>,
): ShopEfficiencyOrder => {
  const prices = new Map(Object.entries(apPrices).map(([id, price]) => [Number(id), price]))
  const unpriced: EventShopItem[] = []
  const priced: { item: EventShopItem; efficiency: number }[] = []
  for (const item of group.items) {
    const price = prices.get(item.itemId)
    if (price === undefined || price <= 0 || item.costAmount <= 0) unpriced.push(item)
    else priced.push({ item, efficiency: (item.qty * price) / item.costAmount })
  }
  // Array.prototype.sort は安定ソートなので、同じ効率の品目は元の順のまま。
  priced.sort((a, b) => b.efficiency - a.efficiency)
  const ranked = priced.map((entry, i) => ({ ...entry, rank: i + 1 }))
  return { unpriced, ranked }
}

/** 効率の表示。小数2桁までにし、末尾の0は出さない。 */
export const formatEfficiency = (value: number): string => String(Math.round(value * 100) / 100)

/** QP の atlasId。交換所の QP で育成計画の QP を埋める使い方は想定しないので、要る・要らないの対象から外す。 */
export const QP_ITEM_ID = 1

/** 素材ごとの不足（総必要数 − 所持数、0 未満は 0）。所持数は atlasId の文字列 → 個数。 */
export const computeShopShortfall = (
  totalNeed: ReadonlyMap<number, number>,
  possession: Readonly<Record<string, number | undefined>>,
): Map<number, number> =>
  new Map(
    [...totalNeed].map(([id, need]) => [id, Math.max(0, need - (Number(possession[String(id)]) || 0))]),
  )

/** 育成計画から見た品目の状態。 */
export type ShopItemStatus =
  | { kind: 'enough' }
  | { kind: 'short'; shortfall: number }
  /** 育成計画で扱う素材だが、今の必要数は 0。 */
  | { kind: 'unused' }
  /** 育成計画で扱っていない品目。 */
  | { kind: 'outside' }

/**
 * 品目の状態を決める。QP は状態なし。必要数のある素材は `planItemIds` を見ない。
 * `planItemIds`（育成計画で扱う素材の集合）が undefined なら、必要数 0 の品目は見分けられないので状態なし。
 */
export const shopItemStatus = (
  itemId: number,
  totalNeed: ReadonlyMap<number, number>,
  shortfall: ReadonlyMap<number, number>,
  planItemIds: ReadonlySet<number> | undefined,
): ShopItemStatus | undefined => {
  if (itemId === QP_ITEM_ID) return undefined
  if ((totalNeed.get(itemId) ?? 0) > 0) {
    const n = shortfall.get(itemId) ?? 0
    return n > 0 ? { kind: 'short', shortfall: n } : { kind: 'enough' }
  }
  if (!planItemIds) return undefined
  return planItemIds.has(itemId) ? { kind: 'unused' } : { kind: 'outside' }
}

export interface ShortfallAllocation {
  /** 品目ごとの交換回数。キーは交換所の配列の添字で、すべての品目を持つ。 */
  counts: Map<number, number>
  /** 交換所に品目のある不足の素材ごとの、交換所で埋まらない残り（埋まるなら 0）。 */
  remaining: Map<number, number>
  /** 残りのある素材の、交換所の元の順で最後の品目の添字 → 残り。 */
  remainders: Map<number, number>
  /** 在庫上限が無くて回数を入れなかった「要る」の品目の添字。 */
  unlimitedWanted: Set<number>
}

/**
 * 不足の分と「要る」の計画の対象外の品目だけを交換する回数を出す。
 * 不足は交換所の元の順に品目へ割り当て、在庫上限で打ち切る。1回の個数が 0 以下の品目は割り当てない。
 * `wanted` は保存した「要る」の atlasId で、状態が「計画の対象外」の品目にだけ使う。
 */
export const allocateShortfallOnly = (
  shop: EventShopItem[],
  shortfall: ReadonlyMap<number, number>,
  statusOf: (itemId: number) => ShopItemStatus | undefined,
  wanted: ReadonlySet<number>,
): ShortfallAllocation => {
  const counts = new Map<number, number>()
  const remaining = new Map<number, number>()
  const lastIndex = new Map<number, number>()
  const unlimitedWanted = new Set<number>()
  shop.forEach((item, index) => {
    counts.set(index, 0)
    const status = statusOf(item.itemId)
    if (status?.kind === 'short') {
      lastIndex.set(item.itemId, index)
      const left = remaining.get(item.itemId) ?? shortfall.get(item.itemId) ?? 0
      if (item.qty <= 0 || left <= 0) {
        remaining.set(item.itemId, left)
        return
      }
      const needed = Math.ceil(left / item.qty)
      const count = item.limitNum > 0 ? Math.min(needed, item.limitNum) : needed
      counts.set(index, count)
      remaining.set(item.itemId, Math.max(0, left - count * item.qty))
    } else if (status?.kind === 'outside' && wanted.has(item.itemId) && item.qty > 0) {
      if (item.limitNum > 0) counts.set(index, item.limitNum)
      else unlimitedWanted.add(index)
    }
  })
  const remainders = new Map<number, number>()
  for (const [itemId, left] of remaining) {
    const index = lastIndex.get(itemId)
    if (left > 0 && index !== undefined) remainders.set(index, left)
  }
  return { counts, remaining, remainders, unlimitedWanted }
}

export interface ShortfallSummary {
  /** 交換所に品目のある不足の素材（QP を除く）の数。 */
  shortMaterials: number
  /** そのうち交換所で埋まる素材の数。 */
  filledMaterials: number
}

export const summarizeShortfall = (allocation: Pick<ShortfallAllocation, 'remaining'>): ShortfallSummary => {
  const lefts = [...allocation.remaining.values()]
  return { shortMaterials: lefts.length, filledMaterials: lefts.filter(left => left === 0).length }
}

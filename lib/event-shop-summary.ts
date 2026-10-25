/**
 * 交換所のエントリーを対価の通貨ごとにまとめ、通貨ごとの全交換に要る合計を出す純粋関数。
 */
import type { EventFarmingNode, EventShopItem } from './master-data/types'

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
  /** `ranked` のうち区切りより上にある品目の数。区切りを出さないときは undefined。 */
  cutoff?: number
}

/**
 * 通貨のグループの品目を、AP 換算値の無い品目（元の順）と効率順の品目に分け、基準による区切りの位置を出す。
 * `apPrices` は atlasId → 素材1個の AP 換算値。基準以上の効率の品目を区切りの上に置く。
 */
export const orderShopByEfficiency = (
  group: Pick<ShopCurrencyGroup, 'items'>,
  apPrices: Readonly<Record<number, number>>,
  threshold?: number,
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
  const cutoff =
    threshold === undefined || ranked.length === 0
      ? undefined
      : ranked.filter(r => r.efficiency >= threshold).length
  return { unpriced, ranked, cutoff }
}

/**
 * 通貨ごとの区切りの基準（その通貨1個を周回で集めるのに要る最小の AP）。
 * AP とドロップ数がどちらも正の周回クエストの `ap ÷ perRun` の最小。1周の AP は通貨ごとに分けない。
 */
export const currencyApThresholds = (farmingNodes: EventFarmingNode[]): Map<number, number> => {
  const thresholds = new Map<number, number>()
  for (const node of farmingNodes) {
    if (node.ap <= 0) continue
    for (const drop of node.drops) {
      if (drop.perRun <= 0) continue
      const apPerCurrency = node.ap / drop.perRun
      const current = thresholds.get(drop.itemId)
      if (current === undefined || apPerCurrency < current) thresholds.set(drop.itemId, apPerCurrency)
    }
  }
  return thresholds
}

/**
 * すべての通貨で、区切りより上（効率が基準以上）の品目を在庫上限の回数にした回数を返す。
 * AP 換算値の無い品目・在庫上限の無い品目・区切りの下の品目、基準の無い通貨の品目は変えない。
 */
export const selectEfficientUpToLimit = (
  shop: EventShopItem[],
  counts: ShopExchangeCounts,
  apPrices: Readonly<Record<number, number>>,
  thresholds: ReadonlyMap<number, number>,
): Map<number, number> => {
  const next = new Map(counts)
  for (const group of groupShopByCurrency(shop)) {
    const { ranked, cutoff } = orderShopByEfficiency(group, apPrices, thresholds.get(group.costItemId))
    for (const { item } of ranked.slice(0, cutoff ?? 0)) {
      if (item.limitNum > 0) next.set(shop.indexOf(item), item.limitNum)
    }
  }
  return next
}

/** 効率と基準の表示。小数2桁までにし、末尾の0は出さない。 */
export const formatEfficiency = (value: number): string => String(Math.round(value * 100) / 100)

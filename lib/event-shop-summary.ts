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

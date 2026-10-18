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

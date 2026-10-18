/**
 * scripts/refresh-event-data.ts の純粋ロジック（副作用なし・テスト対象）。
 *
 * - 交換所のコンパクト化（対価の通貨の表示名・アイコンを itemMap から付与）。
 * - イベントを取り込むか（ロト型 / ロトの無い交換所イベント / スキップ）の判定。
 */
import type { EventCurrency, EventShopItem } from './master-data/types'

export type ItemMap = Map<number, { name: string; icon: string }>

export interface AtlasShopItem {
  purchaseType: string
  payType: string
  targetIds: number[]
  setNum: number
  limitNum: number
  cost: {
    item: { id: number }
    amount: number
  }
  gifts?: unknown[]
}

/** AtlasShopItem[] → EventShopItem[] の変換 */
export function compactShop(shop: AtlasShopItem[], itemMap: ItemMap): EventShopItem[] {
  return shop
    .filter(s => s.purchaseType === 'item' && s.payType === 'eventItem')
    .flatMap(s => {
      // gifts が空のときは targetIds × setNum で報酬を決定（Phase 0 確認済み）
      if (!s.targetIds || s.targetIds.length === 0) return []
      const costMeta = itemMap.get(s.cost.item.id)
      return s.targetIds.map(itemId => {
        const meta = itemMap.get(itemId)
        return {
          itemId,
          qty: s.setNum ?? 1,
          costItemId: s.cost.item.id,
          costAmount: s.cost.amount,
          limitNum: s.limitNum ?? 0,
          name: meta?.name ?? '',
          ...(meta?.icon ? { icon: meta.icon } : {}),
          ...(costMeta ? { costName: costMeta.name } : {}),
          ...(costMeta?.icon ? { costIcon: costMeta.icon } : {}),
        }
      })
    })
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
 * - ロトが無く交換所があれば、交換所の最初のエントリーの対価の通貨を currency にする。
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
  const first = shop[0]
  if (!first) return { kind: 'skip', reason: 'no lotteries and no shop items' }
  const meta = itemMap.get(first.costItemId)
  return {
    kind: 'shop',
    currency: { id: first.costItemId, name: meta?.name ?? '', icon: meta?.icon ?? '' },
    unlimitedBoxes: false,
    lotteries: [],
  }
}

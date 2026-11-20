/**
 * lib/effective-shortfall.ts
 *
 * 育成計画の総必要数・実所持数・周回目的から、素材ごとの実効必要数と実効不足を求める純関数。
 * 料理作成（`buildNeedByApiItemId`・`positiveNeedAtlasIds`）と同じ規則で、
 * 「新規サーヴァントに備える」では必要数と在庫基準の大きい方を目標にし、所持数を入れていない素材は数えない。
 */

import type { FarmingPurpose } from './farming-purpose'
import { computeFiniteTarget, type StockBuffer } from './quest-efficiency'
import { toStockItemLike } from './farming/build-solve-params'

/** 在庫基準を決めるための素材の分類（Atlas ID と、カテゴリ・大分類）。 */
export type StockItemInfo = {
  id: number
  category?: string
  largeCategory?: string
}

export type EffectiveShortfall = {
  /** 実際に使う周回目的（「素材全体の効率を見る」は「今の育成を進める」で求める）。 */
  purpose: 'training' | 'reserve'
  /** atlasId → 実効必要数（1 以上のものだけ）。所持数を入れていない素材は育成の必要数のまま。 */
  required: Map<number, number>
  /** atlasId → 実効不足（1 以上のものだけ）。 */
  shortfall: Map<number, number>
  /** 「新規サーヴァントに備える」で所持数を入れていないため不足に数えない素材の atlasId。 */
  unentered: Set<number>
}

export const finitePurposeOf = (purpose: FarmingPurpose): 'training' | 'reserve' =>
  purpose === 'reserve' ? 'reserve' : 'training'

const toCount = (value: number | undefined): number => (Number.isFinite(value) ? (value as number) : 0)

/**
 * 実効必要数と実効不足を求める。
 * - training（と all）: 不足 = max(0, 必要数 − 所持数)
 * - reserve: 所持数を入れた素材は 不足 = max(0, max(必要数, 在庫基準) − 所持数)、入れていない素材は数えない
 */
export const computeEffectiveShortfall = (
  totalNeed: ReadonlyMap<number, number>,
  possession: Readonly<Record<string, number | undefined>>,
  items: readonly StockItemInfo[] | undefined,
  stockBuffer: StockBuffer,
  farmingPurpose: FarmingPurpose,
): EffectiveShortfall => {
  const purpose = finitePurposeOf(farmingPurpose)
  const itemById = new Map((items ?? []).map(item => [item.id, item]))
  const ids = new Set<number>(totalNeed.keys())
  if (purpose === 'reserve') for (const id of itemById.keys()) ids.add(id)

  const required = new Map<number, number>()
  const shortfall = new Map<number, number>()
  const unentered = new Set<number>()
  const targetOf = (id: number, need: number): number => {
    const item = itemById.get(id)
    return item ? computeFiniteTarget(toStockItemLike(item), need, stockBuffer, purpose) : need
  }
  for (const id of ids) {
    const need = totalNeed.get(id) ?? 0
    const entered = String(id) in possession
    if (purpose === 'reserve' && !entered) unentered.add(id)
    // 所持数を入れていない素材（reserve）は在庫基準を足さず、不足にも数えない。
    const target = unentered.has(id) ? need : targetOf(id, need)
    if (target > 0) required.set(id, target)
    const deficit = unentered.has(id) ? 0 : target - toCount(possession[String(id)])
    if (deficit > 0) shortfall.set(id, deficit)
  }
  return { purpose, required, shortfall, unentered }
}

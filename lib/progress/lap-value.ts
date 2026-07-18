import type { Drops } from '../get-drops'
import { effectiveRequired, type StockBuffer } from '../quest-efficiency'

// 「周回換算」の中核。LP再ソルブ(compute-reduction.ts)を廃し、素材ごとの
// 独立単価(1個あたり推定周回数/AP)で前進・労力・AP相当を合算する(design.md D1/D3)。
//
//   単価_i(周回) = 1 / (選択クエスト内の最高drop_rate_i)  ※無ければ全クエスト中の最高率
//   単価_i(AP)   = 選択クエスト内の最小 AP/drop_rate_i     ※無ければ全クエスト中の最小値
//
// 単価を選択クエスト内で解くことで、クエスト解放状況の差(=進捗度)を吸収する。
// 選択クエストにドロップが無い素材は全クエスト率にフォールバックし、0扱いにしない。

// QP(atlasId '1')は所持が桁違いで周回換算を破綻させるため除外する(throughput.ts と同じ集合)。
const EXCLUDED_ATLAS_IDS = new Set<string>(['1'])

type CountMap = Record<string, number | string | undefined>

const toNum = (v: number | string | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? (n as number) : 0
}

export type UnitPrice = {
  /** 1個あたり推定周回数(労力・前進の周回換算に使う)。 */
  lapPrice: number
  /** 1個あたり推定AP(AP相当の独立換算に使う)。 */
  apPrice: number
}

/**
 * 素材ごとの単価(atlasId キー)を解決する。選択クエスト内のドロップを優先し、
 * 選択内に無い素材は全クエスト中の値にフォールバックする。
 * drop_rate<=0 や ap 不明のクエストは無視する。
 */
export const resolveUnitPrices = (
  drops: Drops,
  selectedQuestIds: string[]
): Map<string, UnitPrice> => {
  const selected = new Set(selectedQuestIds)
  const apByQuest = new Map(drops.quests.map((q) => [q.id, q.ap]))

  type Agg = {
    bestRateSelected: number
    bestRateAll: number
    minApPerDropSelected: number
    minApPerDropAll: number
  }
  const aggByItemId = new Map<string, Agg>()
  const aggFor = (itemId: string): Agg => {
    const cached = aggByItemId.get(itemId)
    if (cached) return cached
    const created: Agg = {
      bestRateSelected: 0,
      bestRateAll: 0,
      minApPerDropSelected: Infinity,
      minApPerDropAll: Infinity,
    }
    aggByItemId.set(itemId, created)
    return created
  }

  for (const dr of drops.drop_rates) {
    if (dr.drop_rate <= 0) continue
    const ap = apByQuest.get(dr.quest_id)
    if (ap == null || ap <= 0) continue
    const agg = aggFor(dr.item_id)
    const apPerDrop = ap / dr.drop_rate
    if (dr.drop_rate > agg.bestRateAll) agg.bestRateAll = dr.drop_rate
    if (apPerDrop < agg.minApPerDropAll) agg.minApPerDropAll = apPerDrop
    if (selected.has(dr.quest_id)) {
      if (dr.drop_rate > agg.bestRateSelected) agg.bestRateSelected = dr.drop_rate
      if (apPerDrop < agg.minApPerDropSelected) agg.minApPerDropSelected = apPerDrop
    }
  }

  const byAtlasId = new Map<string, UnitPrice>()
  for (const item of drops.items) {
    const atlasId = (item as { atlasId?: number }).atlasId
    if (atlasId == null) continue
    const agg = aggByItemId.get(item.id)
    if (!agg) continue
    const bestRate = agg.bestRateSelected > 0 ? agg.bestRateSelected : agg.bestRateAll
    if (bestRate <= 0) continue
    const minApPerDrop =
      agg.minApPerDropSelected < Infinity ? agg.minApPerDropSelected : agg.minApPerDropAll
    byAtlasId.set(String(atlasId), { lapPrice: 1 / bestRate, apPrice: minApPerDrop })
  }
  return byAtlasId
}

export type ForwardProgressInput = {
  drops: Drops
  selectedQuestIds: string[]
  /** 育成計算機の必要数(material/result、atlasId キー)。 */
  targets: CountMap
  currentPosession: CountMap
  pastPosession: CountMap | null | undefined
  stockBuffer: StockBuffer
  stockEnabled: boolean
  /**
   * 呼び出し側で resolveUnitPrices 済みなら渡す(省略時は内部で計算する)。
   * drops/selectedQuestIds が同じなら pastPosession が異なっても単価表は不変なため、
   * 複数窓(d30/d60/d90)分をまとめて算出する際に使い回して二重計算を避けられる。
   */
  unitPrices?: Map<string, UnitPrice>
}

export type ForwardProgress = {
  /** 前進周回: バッファ込み実効不足の解消ぶんの周回換算。 */
  forwardLaps: number
  /** AP相当: 同じ解消ぶんの独立AP換算(内訳表示用)。 */
  forwardApEquivalent: number
}

/**
 * 前進周回・AP相当(design.md D1)。
 *   実効目標_i   = effectiveRequired(item_i, 育成必要数_i, stockBuffer, stockEnabled)
 *   adjustedNow_i = max(現在所持_i, 過去所持_i)  ※消費クランプ(継承)
 *   前進周回     = Σ_i (max(0,実効目標_i−過去所持_i) − max(0,実効目標_i−adjustedNow_i)) × 単価_i(周回)
 * 過去所持が無い(比較スナップショット無し)場合は算出不能として null。
 */
export const computeForwardProgress = (
  input: ForwardProgressInput
): ForwardProgress | null => {
  const {
    drops,
    selectedQuestIds,
    targets,
    currentPosession,
    pastPosession,
    stockBuffer,
    stockEnabled,
    unitPrices: precomputedUnitPrices,
  } = input
  if (pastPosession == null) return null

  const unitPrices = precomputedUnitPrices ?? resolveUnitPrices(drops, selectedQuestIds)
  let forwardLaps = 0
  let forwardApEquivalent = 0

  for (const item of drops.items) {
    const atlasId = (item as { atlasId?: number }).atlasId
    if (atlasId == null) continue
    const key = String(atlasId)
    if (EXCLUDED_ATLAS_IDS.has(key)) continue

    const required = toNum(targets[key])
    const effectiveTarget = effectiveRequired(item, required, stockBuffer, stockEnabled)
    if (effectiveTarget <= 0) continue

    const past = toNum(pastPosession[key])
    const now = toNum(currentPosession[key])
    const adjustedNow = Math.max(now, past)
    const resolved = Math.max(0, effectiveTarget - past) - Math.max(0, effectiveTarget - adjustedNow)
    if (resolved <= 0) continue

    const price = unitPrices.get(key)
    if (!price) continue
    forwardLaps += resolved * price.lapPrice
    forwardApEquivalent += resolved * price.apPrice
  }

  return { forwardLaps, forwardApEquivalent }
}

/**
 * 労力周回(design.md D3): 全獲得素材(純増のみ・余剰込み・QP除外)の周回換算。
 * 育成投入(純減)は含めない。過去所持が無ければ算出不能として 0。
 */
export const computeEffortLaps = (
  drops: Drops,
  selectedQuestIds: string[],
  pastPosession: CountMap | null | undefined,
  currentPosession: CountMap,
  /** 呼び出し側で resolveUnitPrices 済みなら渡す(省略時は内部で計算する)。 */
  precomputedUnitPrices?: Map<string, UnitPrice>
): number => {
  if (pastPosession == null) return 0
  const unitPrices = precomputedUnitPrices ?? resolveUnitPrices(drops, selectedQuestIds)
  let effortLaps = 0

  for (const item of drops.items) {
    const atlasId = (item as { atlasId?: number }).atlasId
    if (atlasId == null) continue
    const key = String(atlasId)
    if (EXCLUDED_ATLAS_IDS.has(key)) continue

    const gained = toNum(currentPosession[key]) - toNum(pastPosession[key])
    if (gained <= 0) continue

    const price = unitPrices.get(key)
    if (!price) continue
    effortLaps += gained * price.lapPrice
  }

  return effortLaps
}

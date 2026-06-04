import solver from 'javascript-lp-solver'
import { Drops } from './get-drops'

// 素材選択アドバイザーの最適化ロジック(純粋関数群)。
//
// 「複数候補からN個もらえる(配布・交換券)」状況で、各候補を交換でもらうことが
// 実際に周回数(または AP)をどれだけ減らすかを評価し、最も削減が大きくなる配分を
// 貪欲法で求める。
//
// 重要: 各候補の価値は「単独で最効率クエストを回すコスト」ではなく、ユーザーの
// 全不足を周回ソルバー(LP)で最適に回したときの『限界削減量(シャドウプライス)』で
// 評価する。これにより、他素材集めのついでに恒常ドロップする素材(=非拘束制約)は
// 交換でもらっても周回が減らないため、正しく価値 0 と判定される。
// farming ソルバーの 'lap' 目的(=総周回数最小化)と完全に整合する。

export type DenominatorMode = 'ap' | 'turn'

/**
 * 与えた必要数 need(短縮 apiItemId キー)を許可クエストで解いたときの最適総量を返す。
 * - mode='turn' : 総周回数(= LP の totalRuns、連続解。farming の 'lap' 目的と同じ)
 * - mode='ap'   : 総AP(= LP の totalAp、連続解)
 * 連続解(切り上げ前)を返すため、1個単位の限界差分が整数丸めで消えない。
 * ドロップデータの無いアイテム(QP・ピース等)は制約から除外する(infeasible 回避)。
 */
export const continuousOptimalCost = (
  drops: Drops,
  need: Record<string, number>,
  questIds: string[],
  mode: DenominatorMode,
): number => {
  if (!Object.values(need).some(v => v > 0)) return 0

  const itemsWithDropData = new Set(drops.drop_rates.map(dr => dr.item_id))
  const model: solver.Model = {
    optimize: mode === 'turn' ? 'totalRuns' : 'totalAp',
    opType: 'min',
    constraints: {},
    variables: {},
    ints: {},
  }
  for (const [itemId, count] of Object.entries(need)) {
    if (count > 0 && itemsWithDropData.has(itemId)) model.constraints[itemId] = { min: count }
  }
  if (Object.keys(model.constraints).length === 0) return 0

  const allowed = new Set(questIds)
  for (const q of drops.quests) {
    if (!allowed.has(q.id)) continue
    model.variables[q.id] = { totalRuns: 1, totalAp: q.ap }
  }
  for (const dr of drops.drop_rates) {
    if (dr.drop_rate > 0 && model.constraints[dr.item_id] && model.variables[dr.quest_id]) {
      model.variables[dr.quest_id][dr.item_id] = dr.drop_rate
    }
  }

  const res = solver.Solve(model)
  if (!res.feasible) return Infinity
  return typeof res.result === 'number' ? res.result : 0
}

/** 候補素材の参照(atlasId・短縮ID・不足数)。 */
export type CandidateRef = {
  /** Atlas ID 文字列(育成計算機の所持数・必要数と同じ空間)。 */
  id: string
  /** 短縮 apiItemId(drops の item_id)。 */
  shortId: string
  /** 不足数(必要数 − 所持数)。 */
  deficiency: number
}

export type CandidatePricing = {
  /** 全不足を最適周回したときの基準総量(周回 or AP)。 */
  baseline: number
  /** 短縮ID -> 1個あたり限界削減量(周回 or AP)。 */
  valueByShortId: Record<string, number>
  /** 短縮ID -> フリクエ恒常ドロップの有無。 */
  hasDropData: Record<string, boolean>
}

/**
 * 各候補の「1個あたり限界削減量」を算出する。
 * value(i) = baseline − optimal(全不足から i を1個減らした need)。
 * 拘束制約(自前調達が必要な素材)なら正、非拘束(ついでに揃う素材)なら 0。
 * total(獲得可能総数)に依存しないため、配分とは独立にキャッシュできる。
 */
export const priceCandidates = (
  drops: Drops,
  fullNeed: Record<string, number>,
  candidates: CandidateRef[],
  mode: DenominatorMode,
  questIds: string[],
): CandidatePricing => {
  const itemsWithDropData = new Set(drops.drop_rates.map(dr => dr.item_id))
  const baseline = continuousOptimalCost(drops, fullNeed, questIds, mode)
  const valueByShortId: Record<string, number> = {}
  const hasDropData: Record<string, boolean> = {}

  for (const c of candidates) {
    const has = itemsWithDropData.has(c.shortId)
    hasDropData[c.shortId] = has
    if (!has || c.deficiency <= 0 || !Number.isFinite(baseline)) {
      valueByShortId[c.shortId] = 0
      continue
    }
    const reduced = { ...fullNeed, [c.shortId]: Math.max(0, (fullNeed[c.shortId] ?? 0) - 1) }
    const cost = continuousOptimalCost(drops, reduced, questIds, mode)
    valueByShortId[c.shortId] = Math.max(0, baseline - cost)
  }
  return { baseline, valueByShortId, hasDropData }
}

/** 限界価値がこの値以下なら「ついで充足(byproduct)」とみなす。 */
const BYPRODUCT_EPS = 1e-6

export type SolverAllocation = {
  id: string
  shortId: string
  /** 推奨獲得数。 */
  allocated: number
  /** 1個あたり限界削減量(周回 or AP)。 */
  valuePerCopy: number
  /** valuePerCopy × allocated(1個あたり価値からの推定)。 */
  saved: number
  /** ドロップ有・限界価値≈0(他素材集めのついでに揃うため交換不要)。 */
  byproduct: boolean
  /** フリクエ恒常ドロップ無し(QP・ピース等)。 */
  noDropData: boolean
}

export type SolverAllocationResult = {
  allocations: SolverAllocation[]
  totalAllocated: number
  /** baseline − 残余最適。配分を反映した厳密な合算削減量。 */
  totalSaved: number
  leftover: number
}

/**
 * 限界価値で貪欲配分し、配分後の残余 need を再ソルブして厳密な合算削減量を測る。
 * 合算削減量は候補間の相互作用(共通の拘束クエストを共有する等)も織り込む。
 */
export const allocateAndMeasure = (
  drops: Drops,
  fullNeed: Record<string, number>,
  candidates: CandidateRef[],
  pricing: CandidatePricing,
  total: number,
  mode: DenominatorMode,
  questIds: string[],
): SolverAllocationResult => {
  const greedy = allocateGreedy(
    candidates.map(c => ({
      id: c.id,
      deficiency: c.deficiency,
      cost: pricing.valueByShortId[c.shortId] ?? 0,
    })),
    total,
  )

  // 配分を反映した残余 need で再ソルブし、厳密な合算削減量を求める。
  const residual = { ...fullNeed }
  candidates.forEach((c, i) => {
    const a = greedy.allocations[i].allocated
    if (a > 0) residual[c.shortId] = Math.max(0, (residual[c.shortId] ?? 0) - a)
  })
  let totalSaved = 0
  if (greedy.totalAllocated > 0 && Number.isFinite(pricing.baseline)) {
    const residualCost = continuousOptimalCost(drops, residual, questIds, mode)
    totalSaved = Math.max(0, pricing.baseline - residualCost)
  }

  const allocations: SolverAllocation[] = candidates.map((c, i) => {
    const allocated = greedy.allocations[i].allocated
    const value = pricing.valueByShortId[c.shortId] ?? 0
    const noDropData = !pricing.hasDropData[c.shortId]
    return {
      id: c.id,
      shortId: c.shortId,
      allocated,
      valuePerCopy: value,
      saved: value * allocated,
      byproduct: !noDropData && c.deficiency > 0 && value <= BYPRODUCT_EPS,
      noDropData,
    }
  })

  return { allocations, totalAllocated: greedy.totalAllocated, totalSaved, leftover: greedy.leftover }
}

/** 貪欲法に渡す候補素材。 */
export type AllocationCandidate = {
  /** 参照キー(Atlas ID 文字列)。 */
  id: string
  /** 不足数(必要数 - 所持数)。0 以下なら割当対象外。 */
  deficiency: number
  /** 1個あたりコスト(現在のモードの AP/個 または 周回/個)。null=ドロップデータ無し。 */
  cost: number | null
}

/** 貪欲法の各素材の割当結果。 */
export type Allocation = {
  id: string
  /** 推奨獲得数。 */
  allocated: number
  /** 1個あたりコスト(入力のまま)。 */
  cost: number | null
  /** この素材で削減できる総コスト(allocated × cost)。 */
  saved: number
  /** ドロップデータ無しで優先度計算から除外されたか。 */
  excluded: boolean
}

export type AllocationResult = {
  /** 入力順を保った各素材の割当。 */
  allocations: Allocation[]
  /** 配分した総数。 */
  totalAllocated: number
  /** 削減できる総コスト(AP または 周回数)。 */
  totalSaved: number
  /** 配分しきれず余った枠。 */
  leftover: number
}

/**
 * 貪欲法で最適配分を求める。
 * 1個あたりコストが大きい(=自前調達が高くつく)順に、不足分を上限として獲得枠を割り振る。
 * 各素材の1個あたり削減コストは一定のため、この貪欲法で厳密な最適解が得られる。
 */
export const allocateGreedy = (
  candidates: AllocationCandidate[],
  total: number,
): AllocationResult => {
  const capacity = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0))

  // 割当対象(コスト有り・不足あり)を抽出し、コスト降順に並べる。
  const eligible = candidates
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => c.cost != null && c.cost > 0 && c.deficiency > 0)
    .sort((a, b) => (b.c.cost ?? 0) - (a.c.cost ?? 0))

  const allocatedByIndex = new Map<number, number>()
  let remaining = capacity
  for (const { c, index } of eligible) {
    if (remaining <= 0) break
    const give = Math.min(c.deficiency, remaining)
    if (give <= 0) continue
    allocatedByIndex.set(index, give)
    remaining -= give
  }

  let totalAllocated = 0
  let totalSaved = 0
  const allocations: Allocation[] = candidates.map((c, index) => {
    const allocated = allocatedByIndex.get(index) ?? 0
    const excluded = !(c.cost != null && c.cost > 0)
    const saved = excluded ? 0 : allocated * (c.cost as number)
    totalAllocated += allocated
    totalSaved += saved
    return { id: c.id, allocated, cost: c.cost, saved, excluded }
  })

  return {
    allocations,
    totalAllocated,
    totalSaved,
    leftover: capacity - totalAllocated,
  }
}

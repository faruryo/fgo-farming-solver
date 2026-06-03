import { Drops } from './get-drops'
import { Campaign } from '../interfaces/fgodrop'
import { computeEffectiveAp } from './solver'
import { DEFAULT_TURNS } from './quest-efficiency'

// 素材選択アドバイザーの最適化ロジック(純粋関数群)。
//
// 「複数候補からN個もらえる(配布・交換券)」状況で、各候補をフリクエで自前調達する
// コスト(AP/個 または 周回/個)を Drops から逆算し、最もコスト削減が大きくなる配分を
// 貪欲法で厳密に求める。候補数 M ≤ 10・総数 N ≤ 100 程度の小規模問題のため、
// 削減コスト(=1個あたりコスト)が大きい順に不足分へ割り振るだけで最適解になる。

export type DenominatorMode = 'ap' | 'turn'

/**
 * アイテム1個をフリクエで集めるための最良コスト。
 * - apCost  : AP/個(= 最良クエストの 実効AP / ドロップ率)。null=恒常ドロップ無し。
 * - turnCost: 周回/個(= 最良クエストの ターン数 / ドロップ率)。null=恒常ドロップ無し。
 * 「最良」とは複数クエスト中で1個あたりコストが最小(=効率最大)のもの。
 */
export type ItemEfficiency = {
  apCost: number | null
  turnCost: number | null
}

/**
 * Drops から各アイテムの最良効率(AP/個・周回/個)を逆算する。
 * キーは育成計算機(material/result・所持数)と同じ Atlas ID 空間の文字列。
 * atlasId を持たないアイテムは短縮 ID をキーにフォールバックする。
 */
export const computeItemEfficiencies = (
  drops: Drops,
  activeCampaigns: Campaign[] = [],
): Map<string, ItemEfficiency> => {
  // クエストごとの分母を事前計算する。
  const apDenom = new Map<string, number>()
  const turnDenom = new Map<string, number>()
  for (const q of drops.quests) {
    const ap = activeCampaigns.length > 0 ? computeEffectiveAp(q.ap, q.id, activeCampaigns) : q.ap
    apDenom.set(q.id, ap)
    const turns = (q as { waveCount?: number }).waveCount
    turnDenom.set(q.id, turns != null && turns > 0 ? turns : DEFAULT_TURNS)
  }

  // 短縮 item_id ごとに最良効率(ドロップ率 / 分母)を求める。
  const bestApEff = new Map<string, number>()
  const bestTurnEff = new Map<string, number>()
  for (const dr of drops.drop_rates) {
    if (dr.drop_rate <= 0) continue
    const ap = apDenom.get(dr.quest_id)
    if (ap != null && ap > 0) {
      const e = dr.drop_rate / ap
      if (e > (bestApEff.get(dr.item_id) ?? 0)) bestApEff.set(dr.item_id, e)
    }
    const t = turnDenom.get(dr.quest_id)
    if (t != null && t > 0) {
      const e = dr.drop_rate / t
      if (e > (bestTurnEff.get(dr.item_id) ?? 0)) bestTurnEff.set(dr.item_id, e)
    }
  }

  const result = new Map<string, ItemEfficiency>()
  for (const item of drops.items) {
    const key = item.atlasId != null ? String(item.atlasId) : item.id
    const apE = bestApEff.get(item.id)
    const turnE = bestTurnEff.get(item.id)
    result.set(key, {
      apCost: apE != null && apE > 0 ? 1 / apE : null,
      turnCost: turnE != null && turnE > 0 ? 1 / turnE : null,
    })
  }
  return result
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

/** モードに応じてコストを選び貪欲法を実行する高水準ヘルパー。 */
export const computeAllocation = (
  candidates: { id: string; deficiency: number; apCost: number | null; turnCost: number | null }[],
  total: number,
  mode: DenominatorMode,
): AllocationResult =>
  allocateGreedy(
    candidates.map(c => ({
      id: c.id,
      deficiency: c.deficiency,
      cost: mode === 'ap' ? c.apCost : c.turnCost,
    })),
    total,
  )

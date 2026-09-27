import { isBothResult, type BothResult, type Result } from '../../interfaces/api'

/** 直近の周回計算結果からクエストごとの予定周回数。両方で解いた結果はダッシュボードと同じく周回数側。 */
export const plannedLapsByQuest = (result: Result | BothResult | null | undefined): Map<string, number> => {
  if (!result) return new Map()
  const quests = isBothResult(result) ? result.lap.quests : result.quests
  return new Map((quests ?? []).map(q => [q.id, q.lap]))
}

export type PlanSplit = {
  planned: number
  inPlanRuns: number
  inPlanBond: number
  overRuns: number
  achieved: boolean
}

/** 残り周回を予定周回数 N の内と外に分ける。ティーポット周回は先に充てる前提(estimateRuns と同じ)。 */
export const splitByPlan = (
  { runs, teapotRuns, perRun, remaining }: { runs: number; teapotRuns: number; perRun: number; remaining: number },
  planned: number | undefined,
): PlanSplit | null => {
  if (!planned || planned <= 0) return null
  const inPlanRuns = Math.min(runs, planned)
  const inPlanTeapot = Math.min(teapotRuns, inPlanRuns)
  const inPlanBond = Math.min(remaining, (inPlanRuns + inPlanTeapot) * perRun)
  return { planned, inPlanRuns, inPlanBond, overRuns: runs - inPlanRuns, achieved: runs <= planned }
}

/** 実効APが通常APと違うときの表示。整数分の1なら比率、それ以外は fraction: null。 */
export const apCampaignLabel = (ap: number, effectiveAp: number): { fraction: string | null } | null => {
  if (effectiveAp === ap) return null
  const ratio = ap / effectiveAp
  return { fraction: Number.isInteger(ratio) && ratio > 1 ? `1/${ratio}` : null }
}

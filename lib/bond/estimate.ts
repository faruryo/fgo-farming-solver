import { questConsumesPod } from '../quest-consumes-pod'
import { allocatePodFreeRuns, type PodFreeContext } from './pod-free'

export const MAX_CURRENT_BOND_LEVEL = 15
export const MAX_TARGET_BOND_LEVEL = 16

export type BondInputField =
  | 'currentLevel'
  | 'targetLevel'
  | 'remainingToNext'
  | 'observedPerRun'

export type BondInputError =
  | { kind: 'range'; field: BondInputField; min: number; max?: number }
  | { kind: 'no-bond-data' }

type Result<T> = ({ ok: true } & T) | { ok: false; error: BondInputError }

const isIntegerIn = (value: number, min: number, max = Infinity) =>
  Number.isInteger(value) && value >= min && value <= max

const rangeError = (field: BondInputField, min: number, max?: number) => ({
  ok: false as const,
  error: { kind: 'range' as const, field, min, ...(max === undefined ? {} : { max }) },
})

/** Lv→Lv+1 の必要増分。`growth` にその Lv の要素がなければ null(絆データ未取得)。 */
export const bondIncrement = (
  growth: readonly number[] | undefined,
  level: number,
): number | null => {
  if (!growth || level < 0 || level >= growth.length) return null
  return level === 0 ? growth[0] : (growth.at(level) as number) - (growth.at(level - 1) as number)
}

export const remainingBond = (
  growth: readonly number[] | undefined,
  {
    currentLevel,
    remainingToNext,
    targetLevel,
  }: { currentLevel: number; remainingToNext: number; targetLevel: number },
): Result<{ remaining: number }> => {
  if (!isIntegerIn(currentLevel, 0, MAX_CURRENT_BOND_LEVEL))
    return rangeError('currentLevel', 0, MAX_CURRENT_BOND_LEVEL)
  if (!isIntegerIn(targetLevel, currentLevel + 1, MAX_TARGET_BOND_LEVEL))
    return rangeError('targetLevel', currentLevel + 1, MAX_TARGET_BOND_LEVEL)
  if (!growth || growth.length < targetLevel)
    return { ok: false, error: { kind: 'no-bond-data' } }
  const toNext = bondIncrement(growth, currentLevel) as number
  if (!isIntegerIn(remainingToNext, 1, toNext))
    return rangeError('remainingToNext', 1, toNext)
  let remaining = remainingToNext
  for (let level = currentLevel + 1; level < targetLevel; level++) {
    remaining += bondIncrement(growth, level) as number
  }
  return { ok: true, remaining }
}

/**
 * リザルト画面の獲得絆を、周回クエストの1周あたりに直す。
 * ティーポット周回の半減を先に済ませ、その値に基本絆の比を掛ける(どちらも切り捨て)。
 */
export type BondPerRunBasis = 'base' | 'measured' | 'converted'

export const bondPerRun = ({
  observed,
  teapotRun,
  measuredBase,
  questBase,
  isMeasuredQuest,
}: {
  observed: number
  teapotRun: boolean
  /** 計測クエストの基本絆。計測クエストがマスターデータから消えたら undefined。 */
  measuredBase: number | undefined
  questBase: number
  isMeasuredQuest: boolean
}): Result<{ perRun: number; estimated: boolean; basis: BondPerRunBasis }> => {
  // 未計測(0)、または計測クエストが消えて換算できないときは、クエストの基本絆(ボーナスなし)を下限として使う
  if (observed === 0 || !measuredBase)
    return { ok: true, perRun: questBase, estimated: true, basis: 'base' }
  const min = teapotRun ? 2 : 1
  if (!isIntegerIn(observed, min)) return rangeError('observedPerRun', min)
  const base = teapotRun ? Math.floor(observed / 2) : observed
  if (isMeasuredQuest) return { ok: true, perRun: base, estimated: false, basis: 'measured' }
  // ponytail: 換算で0になると周回数が無限になるため1周1ptを下限にする
  const perRun = Math.max(1, Math.floor((base * questBase) / measuredBase))
  return { ok: true, perRun, estimated: true, basis: 'converted' }
}

export type RunEstimate = {
  runs: number
  runsWithoutTeapot: number
  teapotRuns: number
}

/** ティーポット(絆2倍)の周回を所持数の範囲で先に充てた残り周回数。 */
export const estimateRuns = (
  remaining: number,
  perRun: number,
  teapotStock: number | null,
): RunEstimate => {
  const runsWithoutTeapot = remaining > 0 ? Math.ceil(remaining / perRun) : 0
  if (!teapotStock || teapotStock <= 0 || remaining <= 0)
    return { runs: runsWithoutTeapot, runsWithoutTeapot, teapotRuns: 0 }
  const teapotRuns = Math.min(teapotStock, Math.ceil(remaining / (perRun * 2)))
  const rest = remaining - teapotRuns * perRun * 2
  const normalRuns = rest > 0 ? Math.ceil(rest / perRun) : 0
  return { runs: teapotRuns + normalRuns, runsWithoutTeapot, teapotRuns }
}

export type QuestRunInput = {
  questId: string
  area: string
  effectiveAp: number
  /** 入力エラーで見積もれない騎は null。集計から除く。 */
  runs: number | null
}

export type QuestRunGroup = {
  questId: string
  runs: number
  ap: number
  pods: number
  /** ストームポッド消費なし期間に無料と数えた周回数。 */
  freeRuns: number
  /** 無料と数えた周回がある期間の終わり(秒)。無ければ null。 */
  freeEndsAt: number | null
  servantCount: number
}

export type QuestRunTotal = Pick<QuestRunGroup, 'runs' | 'ap' | 'pods' | 'freeRuns' | 'freeEndsAt'>

const NO_POD_FREE: PodFreeContext = { podFreeEndsAt: new Map(), nowSec: 0, useApples: false }

/** 同じクエストの騎は同じ編成で回す前提で、周回数は所属騎の最大値にする。 */
export const groupByQuest = (
  estimates: readonly QuestRunInput[],
  { podFreeEndsAt, nowSec, useApples }: PodFreeContext = NO_POD_FREE,
): { groups: QuestRunGroup[]; total: QuestRunTotal } => {
  const byQuest = new Map<string, QuestRunInput & { runs: number; servantCount: number }>()
  for (const estimate of estimates) {
    if (estimate.runs === null) continue
    const current = byQuest.get(estimate.questId)
    byQuest.set(estimate.questId, {
      ...estimate,
      runs: Math.max(current?.runs ?? 0, estimate.runs),
      servantCount: (current?.servantCount ?? 0) + 1,
    })
  }
  const quests = [...byQuest.values()]
  const freeRunsByQuest = allocatePodFreeRuns(
    quests.flatMap(({ questId, area, effectiveAp, runs }) => {
      const endsAt = podFreeEndsAt.get(questId)
      return endsAt !== undefined && questConsumesPod(area)
        ? [{ questId, remainingSec: endsAt - nowSec, effectiveAp, runs }]
        : []
    }),
    useApples,
  )
  const groups = quests.map(({ questId, area, effectiveAp, runs, servantCount }) => {
    const freeRuns = freeRunsByQuest.get(questId) ?? 0
    return {
      questId,
      runs,
      ap: runs * effectiveAp,
      pods: questConsumesPod(area) ? runs - freeRuns : 0,
      freeRuns,
      freeEndsAt: freeRuns > 0 ? (podFreeEndsAt.get(questId) as number) : null,
      servantCount,
    }
  })
  const total = groups.reduce<QuestRunTotal>(
    (sum, group) => ({
      runs: sum.runs + group.runs,
      ap: sum.ap + group.ap,
      pods: sum.pods + group.pods,
      freeRuns: sum.freeRuns + group.freeRuns,
      freeEndsAt:
        group.freeEndsAt === null ? sum.freeEndsAt : Math.max(sum.freeEndsAt ?? group.freeEndsAt, group.freeEndsAt),
    }),
    { runs: 0, ap: 0, pods: 0, freeRuns: 0, freeEndsAt: null },
  )
  return { groups, total }
}

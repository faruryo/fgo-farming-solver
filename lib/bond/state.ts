import { MAX_CURRENT_BOND_LEVEL, MAX_TARGET_BOND_LEVEL } from './estimate'
import type { BondQuestCandidate } from './quest-candidates'

export type BondTrackerEntry = {
  servantId: number
  questId: string
  currentLevel: number
  remainingToNext: number
  targetLevel: number
  observedPerRun: number
  observedTeapotRun: boolean
  measuredQuestId: string
}

export type BondTrackerState = {
  entries: BondTrackerEntry[]
  teapot: { enabled: boolean; stock: number }
}

export const emptyBondTrackerState = (): BondTrackerState => ({
  entries: [],
  teapot: { enabled: false, stock: 0 },
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isIntegerIn = (value: unknown, min: number, max = Infinity): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

// 残りポイントや獲得絆の上限はサーヴァントとクエストに依存するため、ここでは形だけを見る。
// 範囲外は画面で「許される範囲」と一緒に示す。
const isEntry = (value: unknown): value is BondTrackerEntry =>
  isRecord(value) &&
  isIntegerIn(value.servantId, 1) &&
  typeof value.questId === 'string' &&
  isIntegerIn(value.currentLevel, 0, MAX_CURRENT_BOND_LEVEL) &&
  isIntegerIn(value.remainingToNext, 0) &&
  isIntegerIn(value.targetLevel, 1, MAX_TARGET_BOND_LEVEL) &&
  isIntegerIn(value.observedPerRun, 0) &&
  typeof value.observedTeapotRun === 'boolean' &&
  typeof value.measuredQuestId === 'string'

export const parseBondTrackerState = (value: unknown): BondTrackerState => {
  if (!isRecord(value) || !Array.isArray(value.entries) || !isRecord(value.teapot))
    return emptyBondTrackerState()
  const { entries, teapot } = value
  if (!entries.every(isEntry) || typeof teapot.enabled !== 'boolean' || !isIntegerIn(teapot.stock, 0))
    return emptyBondTrackerState()
  if (new Set(entries.map(entry => entry.servantId)).size !== entries.length)
    return emptyBondTrackerState()
  return {
    entries: entries.map(entry => ({
      servantId: entry.servantId,
      questId: entry.questId,
      currentLevel: entry.currentLevel,
      remainingToNext: entry.remainingToNext,
      targetLevel: entry.targetLevel,
      observedPerRun: entry.observedPerRun,
      observedTeapotRun: entry.observedTeapotRun,
      measuredQuestId: entry.measuredQuestId,
    })),
    teapot: { enabled: teapot.enabled, stock: teapot.stock },
  }
}

/** 対象クラス未確認ではない候補の先頭。編成できないかもしれないクエストを初期値にしない。 */
export const defaultBondQuestId = (candidates: readonly BondQuestCandidate[]): string | undefined =>
  candidates.find(candidate => !candidate.unconfirmedClass)?.quest.id

/** マスターデータ読込後の突き合わせ。保存値の形の検証(parseBondTrackerState)とは分ける。 */
export const reconcileEntry = (
  entry: BondTrackerEntry,
  candidates: readonly BondQuestCandidate[],
  questIds: ReadonlySet<string>,
): { entry: BondTrackerEntry; needsRemeasure: boolean } => {
  const isCandidate = candidates.some(candidate => candidate.quest.id === entry.questId)
  const questId = isCandidate ? entry.questId : (defaultBondQuestId(candidates) ?? entry.questId)
  return {
    entry: questId === entry.questId ? entry : { ...entry, questId },
    needsRemeasure: !questIds.has(entry.measuredQuestId),
  }
}

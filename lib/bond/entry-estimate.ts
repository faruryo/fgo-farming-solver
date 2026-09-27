import type { Quest } from '../../interfaces/fgodrop'
import { questConsumesPod } from '../quest-consumes-pod'
import { bondPerRun, estimateRuns, remainingBond, type BondInputError, type RunEstimate } from './estimate'
import type { BondQuestCandidate } from './quest-candidates'
import { reconcileEntry, type BondTrackerEntry } from './state'

export type EntryEstimate = {
  entry: BondTrackerEntry
  candidate: BondQuestCandidate | undefined
  errors: BondInputError[]
  result: {
    remaining: number
    perRun: number
    estimated: boolean
    measuredQuest: Quest | undefined
    runs: RunEstimate
    ap: number
    pods: number
  } | null
}

export const estimateEntry = ({
  entry: savedEntry,
  growth,
  candidates,
  questsById,
  teapotStock,
}: {
  entry: BondTrackerEntry
  growth: readonly number[] | undefined
  candidates: readonly BondQuestCandidate[]
  questsById: ReadonlyMap<string, Quest>
  teapotStock: number | null
}): EntryEstimate => {
  const { entry, needsRemeasure } = reconcileEntry(savedEntry, candidates, new Set(questsById.keys()))
  const candidate = candidates.find(c => c.quest.id === entry.questId)
  const measuredQuest = questsById.get(entry.measuredQuestId)
  const errors: BondInputError[] = []
  const remaining = remainingBond(growth, entry)
  if (!remaining.ok) errors.push(remaining.error)
  const perRun = bondPerRun({
    observed: entry.observedPerRun,
    teapotRun: entry.observedTeapotRun,
    measuredBase: needsRemeasure ? undefined : measuredQuest?.bondPoints,
    questBase: candidate?.quest.bondPoints ?? 0,
    isMeasuredQuest: entry.measuredQuestId === entry.questId,
  })
  if (!perRun.ok) errors.push(perRun.error)
  if (!remaining.ok || !perRun.ok || !candidate) return { entry, candidate, errors, result: null }
  const runs = estimateRuns(remaining.remaining, perRun.perRun, teapotStock)
  return {
    entry,
    candidate,
    errors,
    result: {
      remaining: remaining.remaining,
      perRun: perRun.perRun,
      estimated: perRun.estimated,
      measuredQuest,
      runs,
      ap: runs.runs * candidate.effectiveAp,
      pods: questConsumesPod(candidate.quest.area) ? runs.runs : 0,
    },
  }
}

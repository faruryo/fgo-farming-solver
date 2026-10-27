import type { Quest } from '../../interfaces/fgodrop'
import { questConsumesPod } from '../quest-consumes-pod'
import {
  bondPerRun,
  estimateRuns,
  remainingBond,
  type BondInputError,
  type BondPerRunBasis,
  type RunEstimate,
} from './estimate'
import { podFreeRuns, type PodFreeContext } from './pod-free'
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
    basis: BondPerRunBasis
    measuredQuest: Quest | undefined
    runs: RunEstimate
    ap: number
    pods: number
    consumesPod: boolean
  } | null
}

export const estimateEntry = ({
  entry: savedEntry,
  growth,
  candidates,
  questsById,
  teapotStock,
  podFree,
}: {
  entry: BondTrackerEntry
  growth: readonly number[] | undefined
  candidates: readonly BondQuestCandidate[]
  questsById: ReadonlyMap<string, Quest>
  teapotStock: number | null
  /** 省略時は期間外として扱う。サーヴァント単独で回す前提で、他のクエストとは分け合わない。 */
  podFree?: PodFreeContext
}): EntryEstimate => {
  const { entry } = reconcileEntry(savedEntry, candidates, new Set(questsById.keys()))
  const candidate = candidates.find(c => c.quest.id === entry.questId)
  const measuredQuest = questsById.get(entry.measuredQuestId)
  const errors: BondInputError[] = []
  const remaining = remainingBond(growth, entry)
  if (!remaining.ok) errors.push(remaining.error)
  const perRun = bondPerRun({
    observed: entry.observedPerRun,
    teapotRun: entry.observedTeapotRun,
    measuredBase: measuredQuest?.bondPoints,
    questBase: candidate?.quest.bondPoints ?? 0,
    isMeasuredQuest: entry.measuredQuestId === entry.questId,
  })
  if (!perRun.ok) errors.push(perRun.error)
  if (!remaining.ok || !perRun.ok || !candidate) return { entry, candidate, errors, result: null }
  const runs = estimateRuns(remaining.remaining, perRun.perRun, teapotStock)
  const consumesPod = questConsumesPod(candidate.quest.area)
  const endsAt = podFree?.podFreeEndsAt.get(candidate.quest.id)
  const freeRuns =
    podFree && endsAt !== undefined
      ? podFreeRuns({
          remainingSec: endsAt - podFree.nowSec,
          effectiveAp: candidate.effectiveAp,
          runs: runs.runs,
          useApples: podFree.useApples,
        })
      : 0
  return {
    entry,
    candidate,
    errors,
    result: {
      remaining: remaining.remaining,
      perRun: perRun.perRun,
      estimated: perRun.estimated,
      basis: perRun.basis,
      measuredQuest,
      runs,
      ap: runs.runs * candidate.effectiveAp,
      pods: consumesPod ? runs.runs - freeRuns : 0,
      consumesPod,
    },
  }
}

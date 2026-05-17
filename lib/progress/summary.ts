import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import {
  elapsedMinutesBetween,
  extractChaldeaState,
  extractCheckedQuests,
  extractItemCounts,
  sumTargetItemCounts,
} from './diff'
import { computeServantGrowthDeltas, computeTargetApIncrease } from './growth'
import {
  hasHighDifficultyAccess as detectHighDifficultyAccess,
  collectHighDifficultyQuestIds,
} from './quest-access'
import { getRarityApTables, pickRarityApTable } from './rarity-ap-table'
import type { Rarity } from './rarity-ap-sample'
import type { Snapshot, SnapshotPeriod } from './snapshot'
import { fetchAllSnapshotsByPeriod } from './snapshot'
import {
  classifyTier,
  detectNewServants,
  sumNewServantOffsetAp,
} from './tier'
import type {
  FallbackReason,
  PeriodSummary,
  ProgressResponse,
} from './types'
import type { D1Database } from '@cloudflare/workers-types'
import type { Quest } from '../../interfaces/fgodrop'

export type CurrentStateInput = {
  chaldea: ChaldeaState | null
  itemCounts: Record<string, string | number> | null
  checkedQuests: string[] | null
  totalAp: number | null
  generatedAtIso?: string
}

type BuildContext = {
  current: CurrentStateInput
  highDifficultyQuestIds: string[]
  rarityById: Map<string, Rarity>
  nameById: Map<string, string>
  apTableBasic: Record<Rarity, number>
  apTableHighDifficulty: Record<Rarity, number>
  generatedAtIso: string
}

const buildPeriodSummary = (
  period: SnapshotPeriod,
  snapshot: Snapshot | null,
  ctx: BuildContext,
  hasAnyPastSnapshot: boolean
): PeriodSummary | null => {
  if (snapshot == null) {
    const fallback: FallbackReason = hasAnyPastSnapshot
      ? 'no_snapshot_for_period'
      : 'first_time'
    return {
      period,
      tier: 'none',
      deltaApRaw: 0,
      deltaApAdjusted: 0,
      newServantCount: 0,
      newServantOffsetAp: 0,
      servantGrowth: [],
      targetApIncrease: 0,
      elapsedMinutes: 0,
      fallback,
    }
  }

  const pastChaldea = extractChaldeaState(snapshot.data)
  const pastCheckedQuests = extractCheckedQuests(snapshot.data)
  const pastItemCounts = extractItemCounts(snapshot.data)
  const pastTargetSum = sumTargetItemCounts(pastItemCounts)
  const currentTargetSum = sumTargetItemCounts(ctx.current.itemCounts)

  // Determine which AP table to use based on the PAST checkedQuests (because
  // the past snapshot is what's being compared) — fall back to current if past
  // didn't record quests.
  const checkedForAccess = pastCheckedQuests ?? ctx.current.checkedQuests ?? []
  const hadHighDifficultyAccess = detectHighDifficultyAccess(
    checkedForAccess,
    ctx.highDifficultyQuestIds
  )
  const apTable = hadHighDifficultyAccess
    ? ctx.apTableHighDifficulty
    : ctx.apTableBasic

  const newServants = detectNewServants(
    ctx.current.chaldea,
    pastChaldea,
    ctx.rarityById
  )
  const newServantOffsetAp = sumNewServantOffsetAp(newServants, apTable)

  // Raw delta on the *target* AP scale isn't directly available in snapshots;
  // we approximate AP delta from total target item-count change weighted later
  // by the actual solver run. As a proxy here, we use:
  //   deltaAp = pastTargetSum - currentTargetSum
  // Negative deltas indicate "more items needed now" (e.g. after new servant
  // unlocks), which gets offset by newServantOffsetAp.
  const deltaApRaw = pastTargetSum - currentTargetSum
  const deltaApAdjusted = deltaApRaw + newServantOffsetAp

  const targetApIncrease = computeTargetApIncrease(
    ctx.current.totalAp ?? currentTargetSum,
    pastTargetSum
  )

  const elapsedMinutes = elapsedMinutesBetween(
    snapshot.createdAt,
    ctx.generatedAtIso
  )

  const servantGrowth = computeServantGrowthDeltas(
    ctx.current.chaldea,
    pastChaldea,
    ctx.nameById
  )

  const tier = classifyTier(deltaApAdjusted, elapsedMinutes)

  const zeroProgress =
    deltaApAdjusted <= 0 &&
    servantGrowth.length === 0 &&
    targetApIncrease === 0

  return {
    period,
    tier,
    deltaApRaw,
    deltaApAdjusted,
    newServantCount: newServants.length,
    newServantOffsetAp,
    servantGrowth,
    targetApIncrease,
    elapsedMinutes,
    fallback: zeroProgress ? 'zero_progress' : null,
  }
}

export type BuildProgressResponseInput = {
  db: D1Database
  userId: string
  current: CurrentStateInput
  quests: Quest[]
  servants: Array<{ id: number | string; name?: string; rarity: number }>
}

export const buildProgressResponse = async ({
  db,
  userId,
  current,
  quests,
  servants,
}: BuildProgressResponseInput): Promise<ProgressResponse> => {
  const generatedAtIso = current.generatedAtIso ?? new Date().toISOString()
  const [snapshots, apTables] = await Promise.all([
    fetchAllSnapshotsByPeriod(db, userId),
    getRarityApTables(),
  ])

  const rarityById = new Map<string, Rarity>()
  const nameById = new Map<string, string>()
  for (const s of servants) {
    if (s.rarity >= 1 && s.rarity <= 5) {
      rarityById.set(s.id.toString(), s.rarity as Rarity)
    }
    if (s.name) nameById.set(s.id.toString(), s.name)
  }

  const highDifficultyQuestIds = collectHighDifficultyQuestIds(quests)

  const ctx: BuildContext = {
    current,
    highDifficultyQuestIds,
    rarityById,
    nameById,
    apTableBasic: apTables.basic,
    apTableHighDifficulty: apTables.withHighDifficulty,
    generatedAtIso,
  }

  const hasAnyPastSnapshot =
    snapshots.previous != null ||
    snapshots.week != null ||
    snapshots.month != null

  return {
    generatedAt: generatedAtIso,
    current: {
      totalAp: current.totalAp ?? 0,
    },
    periods: {
      previous: buildPeriodSummary(
        'previous',
        snapshots.previous,
        ctx,
        hasAnyPastSnapshot
      ),
      week: buildPeriodSummary('week', snapshots.week, ctx, hasAnyPastSnapshot),
      month: buildPeriodSummary(
        'month',
        snapshots.month,
        ctx,
        hasAnyPastSnapshot
      ),
    },
  }
}

// re-export for use in /api/progress
export { pickRarityApTable }

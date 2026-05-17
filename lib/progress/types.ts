import type { SnapshotPeriod } from './snapshot'

export type ProgressTier = 'large' | 'medium' | 'small' | 'none'

export type FallbackReason =
  | 'first_time'
  | 'no_snapshot_for_period'
  | 'zero_progress'

export type ServantGrowthEntry = {
  servantId: string
  servantName?: string
  delta: number
}

export type PeriodSummary = {
  period: SnapshotPeriod
  tier: ProgressTier
  deltaApRaw: number
  deltaApAdjusted: number
  newServantCount: number
  newServantOffsetAp: number
  servantGrowth: ServantGrowthEntry[]
  targetApIncrease: number
  elapsedMinutes: number
  fallback: FallbackReason | null
}

export type ProgressResponse = {
  generatedAt: string
  current: {
    totalAp: number
  }
  periods: {
    previous: PeriodSummary | null
    week: PeriodSummary | null
    month: PeriodSummary | null
  }
}

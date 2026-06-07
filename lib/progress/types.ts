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

export type NewServantSummaryEntry = {
  servantId: string
  servantName?: string
}

export type PeriodSummary = {
  period: SnapshotPeriod
  tier: ProgressTier
  /** 育成総量: 比較スナップショットから縮んだ育成目標レンジ(再臨/スキル/アペンド)の合計。 */
  growthTotal: number
  newServantCount: number
  /** 新規入手サーヴァント(名前付き)。比較スナップショットに material が無い場合は空。 */
  newServants: NewServantSummaryEntry[]
  servantGrowth: ServantGrowthEntry[]
  /**
   * アイテム入手による「残りに必要なAP/周回数/費用」の減少量。
   * 目標を現在で固定して再ソルブする方式1で算出。サーバは過去所持を返すのみで、
   * 値はクライアントが再ソルブして埋めるため optional。算出不能時(過去所持欠損等)は undefined。
   */
  reducedAp?: number
  reducedLap?: number
  reducedYen?: number
  /** 素材スループット: 比較スナップショット以降に獲得した素材の合計個数(QP除外)。 */
  itemsFarmed?: number
  /** 素材スループット: 比較スナップショット以降に育成等で消費した素材の合計個数(QP除外)。 */
  itemsConsumed?: number
  /** スキル合計の変化: 所持サーヴァントのスキル現在レベル合計の増分(新規入手も含む)。 */
  skillDelta?: number
  /** 比較スナップショット時点の所持数(atlasId キー)。クライアントの再ソルブに使う。 */
  pastPosession?: Record<string, number>
  elapsedMinutes: number
  fallback: FallbackReason | null
  snapshotCreatedAt?: string | null
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

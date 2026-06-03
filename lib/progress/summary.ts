import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import {
  elapsedMinutesBetween,
  extractChaldeaState,
  extractPosession,
} from './diff'
import { computeServantGrowthDeltas } from './growth'
import type { Rarity } from './rarity-ap-sample'
import type { Snapshot, SnapshotPeriod } from './snapshot'
import { fetchAllSnapshotsByPeriod } from './snapshot'
import { detectNewServants } from './tier'
import type {
  FallbackReason,
  PeriodSummary,
  ProgressResponse,
} from './types'
import type { D1Database } from '@cloudflare/workers-types'

export type CurrentStateInput = {
  chaldea: ChaldeaState | null
  itemCounts: Record<string, string | number> | null
  checkedQuests: string[] | null
  totalAp: number | null
  generatedAtIso?: string
}

export type BuildContext = {
  current: CurrentStateInput
  rarityById: Map<string, Rarity>
  nameById: Map<string, string>
  generatedAtIso: string
}

export const buildPeriodSummary = (
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
      growthTotal: 0,
      newServantCount: 0,
      servantGrowth: [],
      elapsedMinutes: 0,
      fallback,
      snapshotCreatedAt: null,
    }
  }

  const pastChaldea = extractChaldeaState(snapshot.data)

  const newServants = detectNewServants(
    ctx.current.chaldea,
    pastChaldea,
    ctx.rarityById
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
  // 育成総量: 育成で縮んだ目標レンジ(再臨/スキル/アペンド)の合計。
  const growthTotal = servantGrowth.reduce((sum, g) => sum + g.delta, 0)

  // 「アイテム入手による残りの減少(reducedAp/Lap/Yen)」は目標を現在で固定した
  // 再ソルブが必要で、現在の目標(material/result)と所持(posession)を持つ
  // クライアント側で算出する(方式1)。そのためサーバは過去所持(pastPosession)を
  // 返すだけにし、tier はクライアントが reducedAp 確定後に再判定する。
  // ここでの tier は暫定の 'none'(ダッシュボードが上書きする)。
  const pastPosession = extractPosession(snapshot.data) ?? undefined

  return {
    period,
    tier: 'none',
    growthTotal,
    newServantCount: newServants.length,
    servantGrowth,
    pastPosession,
    elapsedMinutes,
    fallback: null,
    snapshotCreatedAt: snapshot.createdAt,
  }
}

export type BuildProgressResponseInput = {
  db: D1Database
  userId: string
  current: CurrentStateInput
  servants: Array<{ id: number | string; name?: string; rarity: number }>
}

export const buildProgressResponse = async ({
  db,
  userId,
  current,
  servants,
}: BuildProgressResponseInput): Promise<ProgressResponse> => {
  const generatedAtIso = current.generatedAtIso ?? new Date().toISOString()

  const snapshots = await fetchAllSnapshotsByPeriod(db, userId)

  const rarityById = new Map<string, Rarity>()
  const nameById = new Map<string, string>()
  for (const s of servants) {
    if (s.rarity >= 1 && s.rarity <= 5) {
      rarityById.set(s.id.toString(), s.rarity as Rarity)
    }
    if (s.name) nameById.set(s.id.toString(), s.name)
  }

  const ctx: BuildContext = {
    current,
    rarityById,
    nameById,
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

import type { D1Database } from '@cloudflare/workers-types'

export type Snapshot = {
  id: string
  userId: string
  data: unknown
  createdAt: string
}

export type SnapshotPeriod = 'previous' | 'week' | 'month'

const dateKey = (date: Date = new Date()) => date.toISOString().slice(0, 10)

const snapshotId = (userId: string, date: Date = new Date()) =>
  `${userId}:${dateKey(date)}`

const parseSnapshot = (row: {
  id: string
  user_id: string
  data: string
  created_at: string
}): Snapshot => {
  let parsed: unknown = row.data
  try {
    parsed = JSON.parse(row.data) as unknown
  } catch {
    // keep as string if not JSON
  }
  return {
    id: row.id,
    userId: row.user_id,
    data: parsed,
    createdAt: row.created_at,
  }
}

export const saveSnapshot = async (
  db: D1Database,
  userId: string,
  data: unknown
): Promise<void> => {
  const id = snapshotId(userId)
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  await db
    .prepare(
      `INSERT INTO state_snapshots (id, user_id, data, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         data = excluded.data,
         created_at = CURRENT_TIMESTAMP`
    )
    .bind(id, userId, json)
    .run()
}

// 比較の相手(baseline)に選ぶ「約1ヶ月前に最も近い」スナップショットを返す。
// ちょうど30日前のデータは通常存在しないため、30日前との時刻差が最小のものを採る。
//   - 手持ちが全て直近(<1ヶ月)なら、自然と最も古いものが選ばれる(最長比較)。
//   - データが貯まれば約1ヶ月前のものへ寄る。
// 「今(ライブ状態)」が比較の起点なので、baseline は常に過去側の1点のみ。
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

export const selectBaselineRow = <T extends { created_at: string }>(
  rows: T[],
  nowMs: number
): T | null => {
  const targetMs = nowMs - ONE_MONTH_MS
  let best: T | null = null
  let bestDiff = Infinity
  for (const r of rows) {
    const t = new Date(r.created_at).getTime()
    if (!Number.isFinite(t)) continue
    const diff = Math.abs(t - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      best = r
    }
  }
  return best
}

export const fetchAllSnapshotsByPeriod = async (
  db: D1Database,
  userId: string
): Promise<Record<SnapshotPeriod, Snapshot | null>> => {
  const { results } = await db
    .prepare(
      `SELECT id, user_id, data, created_at
       FROM state_snapshots
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<{ id: string; user_id: string; data: string; created_at: string }>()

  const list = results || []

  // 単一比較: 約1ヶ月前に最も近いスナップショット1つを baseline(previous スロット)に
  // 載せる。週/月スロットは廃し、比較相手はこの1点に集約する。
  const baselineRow = selectBaselineRow(list, Date.now())

  return {
    previous: baselineRow ? parseSnapshot(baselineRow) : null,
    week: null,
    month: null,
  }
}

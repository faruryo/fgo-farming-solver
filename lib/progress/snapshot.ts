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

const daysAgo = (n: number): Date => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

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

const fetchClosest = async (
  db: D1Database,
  userId: string,
  beforeIso: string
): Promise<Snapshot | null> => {
  const row = await db
    .prepare(
      `SELECT id, user_id, data, created_at
       FROM state_snapshots
       WHERE user_id = ? AND created_at <= ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(userId, beforeIso)
    .first<{ id: string; user_id: string; data: string; created_at: string }>()
  return row ? parseSnapshot(row) : null
}

export const fetchSnapshotByPeriod = async (
  db: D1Database,
  userId: string,
  period: SnapshotPeriod
): Promise<Snapshot | null> => {
  if (period === 'previous') {
    // Most recent snapshot strictly before today (excludes the current day's overwrite).
    const todayIso = `${dateKey()}T00:00:00.000Z`
    return fetchClosest(db, userId, todayIso)
  }
  const ago = period === 'week' ? 7 : 30
  return fetchClosest(db, userId, daysAgo(ago).toISOString())
}

export const fetchAllSnapshotsByPeriod = async (
  db: D1Database,
  userId: string
): Promise<Record<SnapshotPeriod, Snapshot | null>> => {
  const [previous, week, month] = await Promise.all([
    fetchSnapshotByPeriod(db, userId, 'previous'),
    fetchSnapshotByPeriod(db, userId, 'week'),
    fetchSnapshotByPeriod(db, userId, 'month'),
  ])
  return { previous, week, month }
}

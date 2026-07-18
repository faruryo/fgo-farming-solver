import type { D1Database } from '@cloudflare/workers-types'

export type Snapshot = {
  id: string
  userId: string
  data: unknown
  createdAt: string
}

export type SnapshotPeriod = 'd30' | 'd60' | 'd90'

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

// 比較の相手(baseline)に選ぶ「targetMs に最も近い」スナップショットを返す。
// ちょうど targetMs のデータは通常存在しないため、targetMs との時刻差が最小のものを採る。
//   - 手持ちが全て targetMs より新しいなら、自然と最も古いものが選ばれる(最長比較)。
//   - データが貯まれば targetMs 付近のものへ寄る。
// 「今(ライブ状態)」が比較の起点なので、baseline は常に過去側の1点のみ。
// targetMs は呼び出し側が「now - 30日」「now - 60日」「now - 90日」等を渡す総称関数
// (design.md D2/D3: 30/60/90日いずれの候補にも使い回す)。
export const selectBaselineRow = <T extends { created_at: string }>(
  rows: T[],
  targetMs: number
): T | null => {
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

const DAY_MS = 24 * 60 * 60 * 1000

export const fetchAllSnapshotsByPeriod = async (
  db: D1Database,
  userId: string,
  nowMs: number = Date.now()
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

  // 30/60/90日前それぞれに最も近い候補を独立に選定する(design.md D2/D3)。
  // 同一スナップショットに複数ターゲットが解決することが多い(履歴が90日分無い間は
  // 常にそうなる)ため、id が同じ行は JSON.parse を使い回して二重処理を避ける。
  const d30Row = selectBaselineRow(list, nowMs - 30 * DAY_MS)
  const d60Row = selectBaselineRow(list, nowMs - 60 * DAY_MS)
  const d90Row = selectBaselineRow(list, nowMs - 90 * DAY_MS)

  const parsedById = new Map<string, Snapshot>()
  const resolve = (row: typeof d30Row): Snapshot | null => {
    if (!row) return null
    const cached = parsedById.get(row.id)
    if (cached) return cached
    const parsed = parseSnapshot(row)
    parsedById.set(row.id, parsed)
    return parsed
  }

  return {
    d30: resolve(d30Row),
    d60: resolve(d60Row),
    d90: resolve(d90Row),
  }
}

import type { ChaldeaState, ServantState } from '../../hooks/create-chaldea-state'

// Loose shape of a snapshot's parsed payload. We do not enforce a tight schema
// because /api/cloud writes a CloudData wrapper and /api/solve writes a partial
// `{ items, quests }` blob — readers must tolerate either.
export type LooseSnapshot = {
  // From CloudData.storage (or top-level legacy)
  material?: string | ChaldeaState
  items?: string | Record<string, string>
  quests?: string | string[]
  posession?: string | Record<string, number>
  'material/result'?: string | Record<string, number>
  // CloudData wrapper
  storage?: {
    material?: string
    items?: string
    quests?: string
    posession?: string
    'material/result'?: string
  }
}

const parseJsonField = <T,>(value: unknown): T | null => {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  return value as T
}

const pickStorageField = (snapshot: unknown, key: string): unknown => {
  if (typeof snapshot !== 'object' || snapshot == null) return null
  const obj = snapshot as Record<string, unknown>
  if (obj.storage && typeof obj.storage === 'object') {
    const inner = (obj.storage as Record<string, unknown>)[key]
    if (inner != null) return inner
  }
  return obj[key] ?? null
}

export const extractChaldeaState = (snapshot: unknown): ChaldeaState | null =>
  parseJsonField<ChaldeaState>(pickStorageField(snapshot, 'material'))

export const extractItemCounts = (
  snapshot: unknown
): Record<string, string | number> | null => {
  const raw = pickStorageField(snapshot, 'items')
  return parseJsonField<Record<string, string | number>>(raw)
}

export const extractCheckedQuests = (snapshot: unknown): string[] | null => {
  const raw = pickStorageField(snapshot, 'quests')
  if (typeof raw === 'string') {
    // Two formats: JSON array (cloud) or comma-separated (solve snapshot).
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed as string[]
    } catch {
      // fall through to CSV parsing
    }
    return raw.split(',').filter(Boolean)
  }
  if (Array.isArray(raw)) return raw as string[]
  return null
}

// Snapshot includes the solver target items in `items` key as string counts.
// Sum them as a proxy for "total target item count".
export const sumTargetItemCounts = (
  itemCounts: Record<string, string | number> | null
): number => {
  if (!itemCounts) return 0
  let sum = 0
  for (const v of Object.values(itemCounts)) {
    const n = typeof v === 'string' ? Number(v) : v
    if (Number.isFinite(n) && n > 0) sum += n
  }
  return sum
}

export const servantGrowthSum = (state: ServantState | undefined): number => {
  if (!state || state.disabled) return 0
  let total = 0
  for (const [, t] of Object.entries(state.targets)) {
    if (!t || t.disabled) continue
    for (const range of t.ranges) {
      total += Math.max(0, range.end - range.start)
    }
  }
  return total
}

export const elapsedMinutesBetween = (fromIso: string, toIso: string): number => {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, Math.floor((to - from) / 60000))
}

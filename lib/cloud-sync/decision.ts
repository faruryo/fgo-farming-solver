// Pure decision logic for cloud sync, extracted from hooks/use-cloud-sync.ts.
// No window/localStorage access so the clean/dirty × newer/older × device
// state machine can be regression-tested in Vitest's node environment
// (the project doesn't use @testing-library/react — see the note in
// hooks/use-dashboard-result.test.ts).

export type CloudMetadata = {
  updatedAt: string
  deviceId: string
}

export type LocalMetadata = {
  updatedAt: string
  deviceId: string
  lastSyncedAt?: string
}

// Tolerated clock difference between devices before cloud counts as "newer".
export const CLOCK_SKEW_MS = 1000

// Merges one resume's burst (visibilitychange + pageshow + multiple hook
// instances) into roughly a single GET. Must stay short: a throttled resume
// gets no retry event, so a long cooldown would mean "stale until the next
// resume" — the very bug the resume refetch exists to fix.
export const RESUME_REFETCH_COOLDOWN_MS = 5000

export type SyncAction = 'none' | 'auto-apply' | 'conflict'

// Decision core of checkConflict: cloud must be newer beyond the skew
// allowance; a dirty local combined with another device's cloud write is a
// conflict, anything else is safe to apply automatically.
export const decideSyncAction = (
  local: LocalMetadata,
  cloud: CloudMetadata
): SyncAction => {
  const cloudDate = new Date(cloud.updatedAt).getTime()
  const localDate = new Date(local.updatedAt).getTime()
  const isCloudNewer = cloudDate > localDate + CLOCK_SKEW_MS
  if (!isCloudNewer) return 'none'

  const isLocalClean = local.updatedAt === local.lastSyncedAt
  const isConflict = !isLocalClean && cloud.deviceId !== local.deviceId
  return isConflict ? 'conflict' : 'auto-apply'
}

export const shouldRefetchOnResume = (
  lastFetchedAt: number | null,
  now: number,
  cooldownMs: number = RESUME_REFETCH_COOLDOWN_MS
): boolean => lastFetchedAt == null || now - lastFetchedAt >= cooldownMs

export type ResumeEventContext = {
  visibilityState?: 'visible' | 'hidden'
  persisted?: boolean
}

// visibilitychange fires on both hide and show; pageshow fires on every
// normal load too (which the mount fetch already covers), so only the
// bfcache-restore case (persisted) counts as a resume.
export const isResumeTrigger = (
  eventType: 'visibilitychange' | 'pageshow',
  context: ResumeEventContext
): boolean =>
  eventType === 'visibilitychange'
    ? context.visibilityState === 'visible'
    : context.persisted === true

// Metadata transitions — single source of truth for the clean/dirty state
// (clean means updatedAt === lastSyncedAt).

export const markDirty = (meta: LocalMetadata, now: string): LocalMetadata => ({
  ...meta,
  updatedAt: now,
})

// Applying cloud data leaves local clean at the cloud's timestamp; deviceId
// stays local so a later edit here is attributed to this device.
export const metadataAfterApply = (
  local: LocalMetadata,
  cloud: CloudMetadata
): LocalMetadata => ({
  updatedAt: cloud.updatedAt,
  deviceId: local.deviceId,
  lastSyncedAt: cloud.updatedAt,
})

export const metadataAfterSave = (
  local: LocalMetadata,
  now: string
): LocalMetadata => ({
  ...local,
  updatedAt: now,
  lastSyncedAt: now,
})

// Pure decision logic for cloud sync, extracted from hooks/use-cloud-sync.ts.
// No window/localStorage access keeps the clean/dirty × newer/older × device
// state machine fast to test; hook-level wiring is covered separately.

export type CloudMetadata = {
  updatedAt: string
  deviceId: string
}

export type LocalMetadata = {
  updatedAt: string
  deviceId: string
  lastSyncedAt?: string
}

export const INITIAL_SYNC_TIMESTAMP = new Date(0).toISOString()

export const createInitialLocalMetadata = (
  deviceId: string
): LocalMetadata => ({
  updatedAt: INITIAL_SYNC_TIMESTAMP,
  deviceId,
  lastSyncedAt: INITIAL_SYNC_TIMESTAMP,
})

export const isInitialSyncMetadata = (metadata: LocalMetadata): boolean =>
  metadata.updatedAt === INITIAL_SYNC_TIMESTAMP &&
  metadata.lastSyncedAt === INITIAL_SYNC_TIMESTAMP

export const normalizeLocalMetadata = (
  metadata: LocalMetadata
): LocalMetadata =>
  metadata.updatedAt === INITIAL_SYNC_TIMESTAMP &&
  metadata.lastSyncedAt === undefined
    ? { ...metadata, lastSyncedAt: INITIAL_SYNC_TIMESTAMP }
    : metadata

// Tolerated clock difference between devices before cloud counts as "newer".
export const CLOCK_SKEW_MS = 1000

// Merges one resume's burst (visibilitychange + pageshow + multiple hook
// instances) into roughly a single GET. Must stay short: a throttled resume
// gets no retry event, so a long cooldown would mean "stale until the next
// resume" — the very bug the resume refetch exists to fix.
export const RESUME_REFETCH_COOLDOWN_MS = 5000

export type SyncAction = 'none' | 'auto-apply' | 'conflict' | 'divergent'

// この端末がまだ一度もクラウドと同期していないこと。lastSyncedAt を持たない旧
// メタデータも同じ扱いにする。
export const hasNeverSynced = (metadata: LocalMetadata): boolean =>
  (metadata.lastSyncedAt ?? INITIAL_SYNC_TIMESTAMP) === INITIAL_SYNC_TIMESTAMP

// Decision core of checkConflict: cloud must be newer beyond the skew
// allowance; a dirty local combined with another device's cloud write is a
// conflict, anything else is safe to apply automatically.
export const decideSyncAction = (
  local: LocalMetadata,
  cloud: CloudMetadata,
  cloudHasData = false
): SyncAction => {
  const isLocalDirty = local.updatedAt !== local.lastSyncedAt

  // 一度も同期していない端末のローカル編集は、クラウドの内容を取り込んだ上での
  // 編集ではない。共通の祖先がないため updatedAt の新旧比較に意味がなく、どちらを
  // 残すかはユーザーが選ぶ。時刻比較より先に判定する。
  if (hasNeverSynced(local) && isLocalDirty && cloudHasData) return 'divergent'

  const cloudDate = new Date(cloud.updatedAt).getTime()
  const localDate = new Date(local.updatedAt).getTime()
  const isCloudNewer = cloudDate > localDate + CLOCK_SKEW_MS
  if (!isCloudNewer) return 'none'

  const isConflict = isLocalDirty && cloud.deviceId !== local.deviceId
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

import { describe, it, expect } from 'vitest'
import {
  CLOCK_SKEW_MS,
  INITIAL_SYNC_TIMESTAMP,
  RESUME_REFETCH_COOLDOWN_MS,
  createInitialLocalMetadata,
  decideSyncAction,
  isInitialSyncMetadata,
  isResumeTrigger,
  markDirty,
  metadataAfterApply,
  metadataAfterSave,
  normalizeLocalMetadata,
  shouldRefetchOnResume,
  LocalMetadata,
} from './decision'

const T0 = '2026-06-12T00:00:00.000Z'
const t0 = new Date(T0).getTime()
const at = (offsetMs: number) => new Date(t0 + offsetMs).toISOString()

const localMeta = (overrides: Partial<LocalMetadata> = {}): LocalMetadata => ({
  updatedAt: T0,
  deviceId: 'device-a',
  lastSyncedAt: T0,
  ...overrides,
})

describe('decideSyncAction', () => {
  // Matrix: local clean/dirty × cloud newer/older/within-skew × same/other device
  describe('cloud is newer (beyond skew)', () => {
    const cloudNewer = (deviceId: string) => ({
      updatedAt: at(CLOCK_SKEW_MS + 1),
      deviceId,
    })

    it('clean local + other device → auto-apply (Safe Auto-Load)', () => {
      expect(decideSyncAction(localMeta(), cloudNewer('device-b'))).toBe(
        'auto-apply'
      )
    })

    it('clean local + same device → auto-apply', () => {
      expect(decideSyncAction(localMeta(), cloudNewer('device-a'))).toBe(
        'auto-apply'
      )
    })

    it('dirty local + other device → conflict (unsynced changes protected)', () => {
      const dirty = localMeta({ updatedAt: at(500) }) // edited after last sync
      expect(
        decideSyncAction(dirty, {
          updatedAt: at(500 + CLOCK_SKEW_MS + 1), // newer than the edit too
          deviceId: 'device-b',
        })
      ).toBe('conflict')
    })

    it('dirty local + same device → auto-apply (own newer save wins)', () => {
      const dirty = localMeta({ updatedAt: at(500) })
      expect(
        decideSyncAction(dirty, {
          updatedAt: at(CLOCK_SKEW_MS + 501),
          deviceId: 'device-a',
        })
      ).toBe('auto-apply')
    })

    it('never-synced local starts clean and auto-applies cloud data on first login', () => {
      const fresh = createInitialLocalMetadata('device-a')

      expect(
        decideSyncAction(fresh, { updatedAt: T0, deviceId: 'device-b' })
      ).toBe('auto-apply')
      expect(fresh).toEqual({
        updatedAt: INITIAL_SYNC_TIMESTAMP,
        deviceId: 'device-a',
        lastSyncedAt: INITIAL_SYNC_TIMESTAMP,
      })
      expect(isInitialSyncMetadata(fresh)).toBe(true)
    })
  })

  describe('cloud is not newer', () => {
    it('cloud older → none (regardless of dirty state)', () => {
      const dirty = localMeta({ updatedAt: at(5000) })
      const cloud = { updatedAt: T0, deviceId: 'device-b' }
      expect(decideSyncAction(localMeta(), cloud)).toBe('none')
      expect(decideSyncAction(dirty, cloud)).toBe('none')
    })

    it('cloud equal → none', () => {
      expect(
        decideSyncAction(localMeta(), { updatedAt: T0, deviceId: 'device-b' })
      ).toBe('none')
    })

    it('cloud newer but within the ±1000ms skew allowance → none', () => {
      expect(
        decideSyncAction(localMeta(), {
          updatedAt: at(CLOCK_SKEW_MS),
          deviceId: 'device-b',
        })
      ).toBe('none')
    })

    it('boundary: skew + 1ms counts as newer', () => {
      expect(
        decideSyncAction(localMeta(), {
          updatedAt: at(CLOCK_SKEW_MS + 1),
          deviceId: 'device-b',
        })
      ).toBe('auto-apply')
    })
  })
})

describe('shouldRefetchOnResume', () => {
  it('first fetch (no record) → refetch', () => {
    expect(shouldRefetchOnResume(null, t0)).toBe(true)
  })

  it('within cooldown → skip (burst merged)', () => {
    expect(
      shouldRefetchOnResume(t0, t0 + RESUME_REFETCH_COOLDOWN_MS - 1)
    ).toBe(false)
  })

  it('cooldown elapsed → always refetch (never permanently skipped)', () => {
    expect(shouldRefetchOnResume(t0, t0 + RESUME_REFETCH_COOLDOWN_MS)).toBe(
      true
    )
  })

  it('respects a custom cooldown', () => {
    expect(shouldRefetchOnResume(t0, t0 + 10, 100)).toBe(false)
    expect(shouldRefetchOnResume(t0, t0 + 100, 100)).toBe(true)
  })
})

describe('isResumeTrigger', () => {
  it('visibilitychange → visible only', () => {
    expect(
      isResumeTrigger('visibilitychange', { visibilityState: 'visible' })
    ).toBe(true)
    expect(
      isResumeTrigger('visibilitychange', { visibilityState: 'hidden' })
    ).toBe(false)
  })

  it('pageshow → bfcache restore (persisted) only, not normal loads', () => {
    expect(isResumeTrigger('pageshow', { persisted: true })).toBe(true)
    expect(isResumeTrigger('pageshow', { persisted: false })).toBe(false)
    expect(isResumeTrigger('pageshow', {})).toBe(false)
  })
})

describe('metadata transitions', () => {
  it('normalizes legacy epoch metadata without lastSyncedAt as a clean initial state', () => {
    const legacy: LocalMetadata = {
      updatedAt: INITIAL_SYNC_TIMESTAMP,
      deviceId: 'device-a',
    }

    expect(normalizeLocalMetadata(legacy)).toEqual(
      createInitialLocalMetadata('device-a')
    )
  })

  it('marks initial metadata as no longer initial after a real local edit', () => {
    const initial = createInitialLocalMetadata('device-a')
    const dirty = markDirty(initial, at(100))

    expect(isInitialSyncMetadata(dirty)).toBe(false)
    expect(dirty.lastSyncedAt).toBe(INITIAL_SYNC_TIMESTAMP)
  })

  it('markDirty bumps updatedAt and breaks the clean state', () => {
    const dirty = markDirty(localMeta(), at(100))
    expect(dirty.updatedAt).toBe(at(100))
    expect(dirty.updatedAt).not.toBe(dirty.lastSyncedAt)
    expect(dirty.deviceId).toBe('device-a')
  })

  it('metadataAfterApply is clean at the cloud timestamp, keeps local deviceId', () => {
    const applied = metadataAfterApply(
      localMeta({ updatedAt: at(500) }), // dirty same-device case
      { updatedAt: at(2000), deviceId: 'device-b' }
    )
    expect(applied.updatedAt).toBe(at(2000))
    expect(applied.lastSyncedAt).toBe(at(2000))
    expect(applied.updatedAt).toBe(applied.lastSyncedAt) // clean
    expect(applied.deviceId).toBe('device-a') // not the cloud writer's id
  })

  it('metadataAfterSave is clean at the save timestamp', () => {
    const saved = metadataAfterSave(localMeta({ updatedAt: at(500) }), at(600))
    expect(saved.updatedAt).toBe(at(600))
    expect(saved.lastSyncedAt).toBe(at(600))
    expect(saved.deviceId).toBe('device-a')
  })

  it('apply → edit → save round-trip keeps state coherent', () => {
    const applied = metadataAfterApply(localMeta(), {
      updatedAt: at(2000),
      deviceId: 'device-b',
    })
    // clean after apply: a newer cloud from the same data must not conflict
    expect(
      decideSyncAction(applied, { updatedAt: at(2000), deviceId: 'device-b' })
    ).toBe('none')

    const edited = markDirty(applied, at(3000))
    // dirty + other device's newer cloud → conflict
    expect(
      decideSyncAction(edited, {
        updatedAt: at(3000 + CLOCK_SKEW_MS + 1),
        deviceId: 'device-b',
      })
    ).toBe('conflict')

    const saved = metadataAfterSave(edited, at(5000))
    expect(
      decideSyncAction(saved, { updatedAt: at(5000), deviceId: 'device-a' })
    ).toBe('none')
  })
})

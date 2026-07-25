// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCloudSync } from './use-cloud-sync'
import { useLocalStorage } from './use-local-storage'
import { INITIAL_SYNC_TIMESTAMP } from '../lib/cloud-sync/decision'

const mocks = vi.hoisted(() => ({
  getItems: vi.fn(async () => []),
  session: { data: { user: { name: 'Test Master' } } },
  router: { refresh: vi.fn() },
  i18n: { language: 'ja' },
  t: (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => mocks.session,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: mocks.i18n, t: mocks.t }),
}))

vi.mock('../lib/get-items', () => ({
  getItems: mocks.getItems,
}))

const CLOUD_UPDATED_AT = '2026-07-25T00:00:00.000Z'
const CLOUD_MATERIAL = JSON.stringify({
  all: { source: 'cloud' },
  '100100': { disabled: false },
})
const DEFAULT_MATERIAL = { all: { source: 'default' } }

const cloudResponse = () => ({
  status: 200,
  json: async () => ({
    storage: { material: CLOUD_MATERIAL },
    metadata: {
      updatedAt: CLOUD_UPDATED_AT,
      deviceId: 'desktop-device',
    },
  }),
})

describe('useCloudSync first-device restore', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.router.refresh.mockReset()
    mocks.getItems.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => cloudResponse()),
    )
  })

  it('restores cloud material on a fresh device even before auto-sync is enabled', async () => {
    const { result } = renderHook(() => {
      useLocalStorage('material', DEFAULT_MATERIAL)
      return useCloudSync()
    })

    await waitFor(() => {
      expect(localStorage.getItem('material')).toBe(CLOUD_MATERIAL)
    })

    expect(localStorage.getItem('fgo_auto_sync_enabled')).toBeNull()
    expect(result.current.hasConflict).toBe(false)
    expect(JSON.parse(localStorage.getItem('fgo_sync_metadata')!)).toEqual({
      updatedAt: CLOUD_UPDATED_AT,
      deviceId: expect.any(String),
      lastSyncedAt: CLOUD_UPDATED_AT,
    })
  })

  it('repairs legacy epoch metadata and restores cloud material for already-affected devices', async () => {
    localStorage.setItem('material', JSON.stringify(DEFAULT_MATERIAL))
    localStorage.setItem(
      'fgo_sync_metadata',
      JSON.stringify({
        updatedAt: INITIAL_SYNC_TIMESTAMP,
        deviceId: 'legacy-mobile-device',
      }),
    )

    const { result } = renderHook(() => useCloudSync())

    await waitFor(() => {
      expect(localStorage.getItem('material')).toBe(CLOUD_MATERIAL)
    })
    expect(result.current.hasConflict).toBe(false)
  })

  it('does not treat a derived recalculation as an unsynced local change', async () => {
    const { result } = renderHook(() => useCloudSync())

    await waitFor(() => {
      expect(localStorage.getItem('material')).toBe(CLOUD_MATERIAL)
    })
    const afterRestore = localStorage.getItem('fgo_sync_metadata')

    window.dispatchEvent(
      new CustomEvent('ls-sync', { detail: { key: 'todoState', derived: true } }),
    )
    expect(localStorage.getItem('fgo_sync_metadata')).toBe(afterRestore)

    window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'todoState' } }))
    expect(localStorage.getItem('fgo_sync_metadata')).not.toBe(afterRestore)
    expect(result.current.hasConflict).toBe(false)
  })

  // 一度も同期していない端末での編集はクラウドと共通の祖先を持たない。時刻の新旧で
  // 黙って片方に倒すと、ローカルが新しいだけでクラウドが復元されないまま autosave が
  // クラウドを上書きしうる。
  it('reports divergence instead of silently keeping a never-synced local edit', async () => {
    localStorage.setItem('material', JSON.stringify({ all: { source: 'local-edit' } }))
    localStorage.setItem(
      'fgo_sync_metadata',
      JSON.stringify({
        updatedAt: '2026-07-26T00:00:00.000Z', // クラウドの保存時刻より後
        deviceId: 'mobile-device',
        lastSyncedAt: INITIAL_SYNC_TIMESTAMP,
      }),
    )

    const { result } = renderHook(() => useCloudSync())

    await waitFor(() => {
      expect(result.current.isDivergent).toBe(true)
    })
    // バナーと autosave 中断は conflict と同じ扱い
    expect(result.current.hasConflict).toBe(true)
    expect(localStorage.getItem('material')).toBe(
      JSON.stringify({ all: { source: 'local-edit' } }),
    )

    // 選択モーダルの「クラウドから復元」で解消する
    result.current.applyData(
      { material: CLOUD_MATERIAL },
      { updatedAt: CLOUD_UPDATED_AT, deviceId: 'desktop-device' },
    )
    await waitFor(() => {
      expect(result.current.isDivergent).toBe(false)
    })
    expect(result.current.hasConflict).toBe(false)
    expect(localStorage.getItem('material')).toBe(CLOUD_MATERIAL)
  })

  it('does not report divergence when the cloud has no data to restore', async () => {
    localStorage.setItem('material', JSON.stringify({ all: { source: 'local-edit' } }))
    localStorage.setItem(
      'fgo_sync_metadata',
      JSON.stringify({
        updatedAt: '2026-07-26T00:00:00.000Z',
        deviceId: 'mobile-device',
        lastSyncedAt: INITIAL_SYNC_TIMESTAMP,
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        json: async () => ({
          storage: {},
          metadata: { updatedAt: CLOUD_UPDATED_AT, deviceId: 'desktop-device' },
        }),
      })),
    )

    const { result } = renderHook(() => useCloudSync())

    await waitFor(() => {
      expect(result.current.cloudData).not.toBeNull()
    })
    expect(result.current.isDivergent).toBe(false)
    expect(result.current.hasConflict).toBe(false)
  })

  it('keeps a real unsynced local edit and reports a conflict', async () => {
    const localMaterial = JSON.stringify({ all: { source: 'local-edit' } })
    localStorage.setItem('material', localMaterial)
    localStorage.setItem(
      'fgo_sync_metadata',
      JSON.stringify({
        updatedAt: '2026-07-24T23:00:00.000Z',
        deviceId: 'mobile-device',
      }),
    )

    const { result } = renderHook(() => useCloudSync())

    await waitFor(() => {
      expect(result.current.hasConflict).toBe(true)
    })
    expect(localStorage.getItem('material')).toBe(localMaterial)
  })
})

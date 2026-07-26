// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCloudSync } from './use-cloud-sync'
import { useLocalStorage } from './use-local-storage'
import { INITIAL_SYNC_TIMESTAMP } from '../lib/cloud-sync/decision'

const mocks = vi.hoisted(() => ({
  getItems: vi.fn(async () => []),
  session: { data: { user: { name: 'Test Master' } } } as {
    data: { user: { name: string } } | null
  },
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

// 事故の再現: 同期済みの端末でローカルのデータだけが消え、その空の内容がクラウドを
// 上書きしてしまう。pending はモジュールスコープの変数なので、テストごとに
// resetModules で読み込み直して状態を持ち越さない(順序依存で通ってしまうのを防ぐ)。
describe('useCloudSync shrink guard', () => {
  const CLOUD_SERVANTS = 461
  const CLOUD_POSSESSIONS = 104

  const bigCloudStorage = (): Record<string, string> => ({
    material: JSON.stringify({
      all: { source: 'cloud' },
      ...Object.fromEntries(
        Array.from({ length: CLOUD_SERVANTS }, (_, i) => [
          String(100100 + i),
          { disabled: false },
        ]),
      ),
    }),
    posession: JSON.stringify(
      Object.fromEntries(
        Array.from({ length: CLOUD_POSSESSIONS }, (_, i) => [String(6500 + i), 30]),
      ),
    ),
  })

  // POST を反映する状態付きのクラウド。保存が通った後の再取得が古い内容を返すと、
  // 「保存できたのに次のオートセーブがまた止まる」という現実にない状況を作ってしまう。
  let cloudPayload: { storage: Record<string, string>; metadata: unknown }
  let fetchMock: ReturnType<typeof vi.fn>

  const postCalls = () =>
    fetchMock.mock.calls.filter(
      ([, init]) => (init as { method?: string } | undefined)?.method === 'POST',
    )

  const getCalls = () =>
    fetchMock.mock.calls.filter(
      ([, init]) => (init as { method?: string } | undefined)?.method !== 'POST',
    )

  const loadUseCloudSync = async () => {
    vi.resetModules()
    const mod = await import('./use-cloud-sync')
    return mod.useCloudSync
  }

  // 一度同期した後にローカルだけが空になった状態。divergent にも auto-apply にも
  // ならないので、ガードが無ければそのままクラウドを上書きする。
  const setupWipedLocal = () => {
    localStorage.setItem('material', '{}')
    localStorage.setItem('posession', '{}')
    localStorage.setItem(
      'fgo_sync_metadata',
      JSON.stringify({
        updatedAt: '2026-07-25T01:00:00.000Z',
        deviceId: 'mobile-device',
        lastSyncedAt: CLOUD_UPDATED_AT,
      }),
    )
  }

  const renderCloudSync = async () => {
    const useCloudSyncFresh = await loadUseCloudSync()
    const { result } = renderHook(() => useCloudSyncFresh())
    await waitFor(() => {
      expect(result.current.cloudData).not.toBeNull()
    })
    return result
  }

  // 変更リスナーが debounce を再武装したかどうかを、実時間を待たずに見る。
  const armedAutoSaves = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter((call) => call[1] === 5000)

  const editMaterial = () =>
    act(() => {
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'material' } }))
    })

  beforeEach(() => {
    localStorage.clear()
    mocks.router.refresh.mockReset()
    mocks.getItems.mockClear()
    cloudPayload = {
      storage: bigCloudStorage(),
      metadata: { updatedAt: CLOUD_UPDATED_AT, deviceId: 'desktop-device' },
    }
    fetchMock = vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') {
        cloudPayload = JSON.parse(init.body ?? '{}') as typeof cloudPayload
        return { ok: true, status: 200, json: async () => cloudPayload }
      }
      return { ok: true, status: 200, json: async () => cloudPayload }
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    mocks.session = { data: { user: { name: 'Test Master' } } }
  })

  it('does not push a save that would wipe out most of the cloud', async () => {
    setupWipedLocal()
    const result = await renderCloudSync()

    await act(async () => {
      await result.current.handleSave()
    })

    expect(postCalls()).toHaveLength(0)
    expect(result.current.pendingShrink).toEqual({
      next: { servants: 0, possessions: 0 },
      cloud: { servants: CLOUD_SERVANTS, possessions: CLOUD_POSSESSIONS },
      missingKeys: [],
      force: false,
    })
  })

  it('pushes the same save once the user allows the shrink', async () => {
    setupWipedLocal()
    const result = await renderCloudSync()

    await act(async () => {
      await result.current.handleSave(false, { allowShrink: true })
    })

    expect(postCalls()).toHaveLength(1)
    expect(result.current.pendingShrink).toBeNull()
  })

  // force はコンフリクトのバイパスであって縮小の許可ではない。/cloud の「強制上書き」
  // こそがクラウドを潰す実行犯なので、ここを素通りさせない。
  it('still guards the /cloud force overwrite', async () => {
    setupWipedLocal()
    const result = await renderCloudSync()

    await act(async () => {
      await result.current.handleSave(true)
    })

    expect(postCalls()).toHaveLength(0)
    expect(result.current.pendingShrink?.force).toBe(true)
  })

  // 比較できないから通す、にすると通信が不安定な端末＝事故と同じ条件でだけ
  // ガードが無効になる。
  it('aborts the save when the cloud state stays unknown', async () => {
    setupWipedLocal()
    fetchMock = vi.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === 'POST' ? { ok: true, status: 200 } : { ok: false, status: 500 },
    )
    vi.stubGlobal('fetch', fetchMock)
    const useCloudSyncFresh = await loadUseCloudSync()
    const { result } = renderHook(() => useCloudSyncFresh())
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(result.current.cloudData).toBeNull()
    // マウント時の1回で諦めず、保存の直前にもう一度だけ取りに行っている
    expect(getCalls()).toHaveLength(2)
    expect(postCalls()).toHaveLength(0)
    expect(result.current.saveStatus).toBe('failed')
    expect(result.current.pendingShrink).toBeNull()
  })

  // マウント時の取得に失敗して基準値を持っていない状態。保存直前の再取得で基準値を
  // 手に入れ、そこで判定できる(setCloudData は同じレンダーの cloudData を更新しない
  // ため、再取得の戻り値で受け取る必要がある)。
  it('uses the refetched cloud data as the baseline when it had none', async () => {
    setupWipedLocal()
    let getCount = 0
    fetchMock = vi.fn(async (_url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return { ok: true, status: 200 }
      getCount += 1
      // 初回(マウント時)だけ失敗させ、ref が空のまま handleSave に入らせる
      if (getCount === 1) return { ok: false, status: 500 }
      return { ok: true, status: 200, json: async () => cloudPayload }
    })
    vi.stubGlobal('fetch', fetchMock)

    const useCloudSyncFresh = await loadUseCloudSync()
    const { result } = renderHook(() => useCloudSyncFresh())
    await waitFor(() => {
      expect(getCount).toBe(1)
    })
    expect(result.current.cloudData).toBeNull()

    await act(async () => {
      await result.current.handleSave()
    })

    expect(getCount).toBe(2)
    expect(postCalls()).toHaveLength(0)
    expect(result.current.pendingShrink?.cloud).toEqual({
      servants: CLOUD_SERVANTS,
      possessions: CLOUD_POSSESSIONS,
    })
  })

  // 未ログイン(開発用モック)では cloudData が作られないため、ガードを適用すると
  // 最初のモック保存そのものが作れなくなる。
  it('skips the guard when signed out so the dev mock save still works', async () => {
    mocks.session = { data: null }
    vi.stubEnv('NODE_ENV', 'development')
    setupWipedLocal()

    const useCloudSyncFresh = await loadUseCloudSync()
    const { result } = renderHook(() => useCloudSyncFresh())

    await act(async () => {
      await result.current.handleSave()
    })

    expect(localStorage.getItem('fgo_mock_cloud_data')).not.toBeNull()
    expect(postCalls()).toHaveLength(0)
    expect(result.current.pendingShrink).toBeNull()
  })

  // モックができて以降は本番と同じ経路を通る。ここが素通りだと、開発中にガードを
  // 一度も動かせず実機で検証できない。
  it('guards the dev mock save once a mock cloud already exists', async () => {
    mocks.session = { data: null }
    vi.stubEnv('NODE_ENV', 'development')
    localStorage.setItem(
      'fgo_mock_cloud_data',
      JSON.stringify({
        storage: bigCloudStorage(),
        metadata: { updatedAt: CLOUD_UPDATED_AT, deviceId: 'desktop-device' },
      }),
    )
    setupWipedLocal()

    const result = await renderCloudSync()
    const mockBefore = localStorage.getItem('fgo_mock_cloud_data')

    await act(async () => {
      await result.current.handleSave()
    })

    expect(localStorage.getItem('fgo_mock_cloud_data')).toBe(mockBefore)
    expect(result.current.pendingShrink?.cloud).toEqual({
      servants: CLOUD_SERVANTS,
      possessions: CLOUD_POSSESSIONS,
    })
  })

  // クラウド側が壊れている状態で保存を止め続けると、既に読めないデータを理由に
  // 正常なローカルの保存が永久に止まり、ユーザーに脱出手段が無くなる。
  it('still saves when the cloud itself cannot be measured but no key is lost', async () => {
    cloudPayload = {
      storage: { material: '{"broken": ', posession: '{}' },
      metadata: { updatedAt: CLOUD_UPDATED_AT, deviceId: 'desktop-device' },
    }
    setupWipedLocal()
    const result = await renderCloudSync()

    await act(async () => {
      await result.current.handleSave()
    })

    expect(postCalls()).toHaveLength(1)
    expect(result.current.pendingShrink).toBeNull()
    expect(result.current.saveStatus).not.toBe('failed')
  })

  it('falls back to the missing-key check when the cloud cannot be measured', async () => {
    cloudPayload = {
      storage: {
        material: '{"broken": ',
        posession: '{}',
        todoState: '{"a":1}',
        quests: '{"b":1}',
      },
      metadata: { updatedAt: CLOUD_UPDATED_AT, deviceId: 'desktop-device' },
    }
    setupWipedLocal()
    const result = await renderCloudSync()

    await act(async () => {
      await result.current.handleSave()
    })

    expect(postCalls()).toHaveLength(0)
    expect(result.current.pendingShrink?.cloud).toBeNull()
    expect(result.current.pendingShrink?.missingKeys).toEqual(['quests', 'todoState'])
  })

  // 送ろうとしている内容が読めないときは、何を上書きするのか分からないので保存しない。
  it('aborts when the payload about to be saved cannot be measured', async () => {
    setupWipedLocal()
    localStorage.setItem('material', '{"broken": ')
    const result = await renderCloudSync()

    await act(async () => {
      await result.current.handleSave()
    })

    expect(postCalls()).toHaveLength(0)
    expect(result.current.pendingShrink).toBeNull()
    expect(result.current.saveStatus).toBe('failed')
  })

  it('does not schedule an auto-save while a shrink is unresolved', async () => {
    localStorage.setItem('fgo_auto_sync_enabled', 'true')
    setupWipedLocal()
    const result = await renderCloudSync()
    await act(async () => {
      await result.current.handleSave()
    })
    expect(result.current.pendingShrink).not.toBeNull()

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    editMaterial()

    expect(armedAutoSaves(setTimeoutSpy)).toHaveLength(0)
    expect(postCalls()).toHaveLength(0)
  })

  // pending はモジュール変数なので、解除を書き忘れるとリロードするまで
  // オートセーブが止まったままになる。解除後に本当に再武装されるかまで見る。
  it('resumes auto-save after restoring from the cloud', async () => {
    localStorage.setItem('fgo_auto_sync_enabled', 'true')
    setupWipedLocal()
    const result = await renderCloudSync()
    await act(async () => {
      await result.current.handleSave()
    })

    act(() => {
      result.current.resolveShrinkByRestore()
    })

    expect(result.current.pendingShrink).toBeNull()
    // クラウドの内容が引き下ろされ、ローカルが直っている
    expect(JSON.parse(localStorage.getItem('material')!)['100100']).toEqual({
      disabled: false,
    })

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    editMaterial()
    const armed = armedAutoSaves(setTimeoutSpy)
    expect(armed).toHaveLength(1)

    await act(async () => {
      ;(armed[0][0] as () => void)()
    })
    await waitFor(() => {
      expect(postCalls()).toHaveLength(1)
    })
  })

  it('resumes auto-save after the user forces the save through', async () => {
    localStorage.setItem('fgo_auto_sync_enabled', 'true')
    setupWipedLocal()
    const result = await renderCloudSync()
    await act(async () => {
      await result.current.handleSave()
    })

    await act(async () => {
      await result.current.resolveShrinkByForce()
    })

    expect(result.current.pendingShrink).toBeNull()
    expect(postCalls()).toHaveLength(1)

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    editMaterial()
    const armed = armedAutoSaves(setTimeoutSpy)
    expect(armed).toHaveLength(1)

    await act(async () => {
      ;(armed[0][0] as () => void)()
    })
    await waitFor(() => {
      expect(postCalls()).toHaveLength(2)
    })
  })

  // 閉じても縮小は未解決のまま。次の編集で出し直す(閉じたきり忘れられると、
  // 同期が止まっていることに気づけない)。
  it('re-presents the dialog on the next edit after it was dismissed', async () => {
    setupWipedLocal()
    const result = await renderCloudSync()
    await act(async () => {
      await result.current.handleSave()
    })

    act(() => {
      result.current.dismissShrinkDialog()
    })
    expect(result.current.pendingShrink).toBeNull()

    editMaterial()

    expect(result.current.pendingShrink).not.toBeNull()
    expect(postCalls()).toHaveLength(0)
  })
})

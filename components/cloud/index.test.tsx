// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PendingShrink } from '../../hooks/use-cloud-sync'
import type { Stats } from './parts/stats-logic'

// t(key, fallback) の fallback をそのまま返し、実際に出る日本語で検証する。
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
  signIn: vi.fn(),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

const useCloudSync = vi.fn()

vi.mock('../../hooks/use-cloud-sync', () => ({
  useCloudSync: () => useCloudSync() as unknown,
  KEYS: ['material', 'posession'],
}))

import Cloud from './index'

const stats = (overrides: Partial<Stats> = {}): Stats => ({
  ownedCount: 3,
  skillTotal: 12,
  appendTotal: 0,
  bronze: 5,
  silver: 3,
  gold: 2,
  fragments: 0,
  ...overrides,
})

const pending = (overrides: Partial<PendingShrink> = {}): PendingShrink => ({
  next: { servants: 0, possessions: 0 },
  cloud: { servants: 461, possessions: 104 },
  missingKeys: [],
  force: false,
  ...overrides,
})

const resolveShrinkByRestore = vi.fn()
const resolveShrinkByForce = vi.fn()

const syncState = (overrides: Record<string, unknown> = {}) => ({
  session: { user: { name: 'tester' } },
  cloudData: {
    storage: { material: '{}' },
    metadata: { updatedAt: '2026-07-01T00:00:00.000Z', deviceId: 'device' },
  },
  localStats: stats(),
  cloudStats: stats(),
  isSaving: false,
  saveStatus: false,
  isLoading: false,
  setIsLoading: vi.fn(),
  handleSave: vi.fn(),
  applyData: vi.fn(),
  fetchCloudData: vi.fn(),
  isInitializing: false,
  autoSyncEnabled: true,
  toggleAutoSync: vi.fn(),
  hasConflict: false,
  isDivergent: false,
  pendingShrink: null,
  blockedShrink: null,
  resolveShrinkByRestore,
  resolveShrinkByForce,
  dismissShrinkDialog: vi.fn(),
  items: [],
  ...overrides,
})

// /cloud が読むのは blockedShrink（ダイアログの「見比べる」= dismiss を経由しても
// 残る保留状態）。dismiss で null になる pendingShrink を見ていると、遷移先が
// 素通しになる。
const blocked = (overrides: Partial<PendingShrink> = {}) => {
  const value = pending(overrides)
  return { pendingShrink: value, blockedShrink: value }
}

describe('Cloud page (shrink guard pending state)', () => {
  beforeEach(() => {
    resolveShrinkByRestore.mockReset()
    resolveShrinkByForce.mockReset()
    useCloudSync.mockReset()
  })

  it('does not claim the sync is healthy while a save is blocked', () => {
    useCloudSync.mockReturnValue(syncState(blocked()))
    render(<Cloud />)

    expect(screen.queryByText('クラウドとの同期は正常です')).not.toBeInTheDocument()
    expect(screen.getByText('保存を中断しています')).toBeInTheDocument()
  })

  it('shows what would have been saved next to what the cloud holds', () => {
    useCloudSync.mockReturnValue(syncState(blocked()))
    render(<Cloud />)

    expect(screen.getByText('サーヴァント 0 / 所持素材の種類 0')).toBeInTheDocument()
    expect(screen.getByText('サーヴァント 461 / 所持素材の種類 104')).toBeInTheDocument()
  })

  it('says the cloud counts cannot be read instead of showing a number', () => {
    useCloudSync.mockReturnValue(syncState(blocked({ cloud: null })))
    render(<Cloud />)

    expect(screen.getByText('読み取れません')).toBeInTheDocument()
    expect(screen.getByText('サーヴァント 0 / 所持素材の種類 0')).toBeInTheDocument()
  })

  // ダイアログと同じ 2 つの数字を並べるだけでは「見比べる」で情報が増えない。
  // /cloud では getStats 由来の 3 指標(サーヴァント数・スキル合計・素材レア度別)を出す。
  it('shows the richer local/cloud comparison table, not just the dialog counts', () => {
    useCloudSync.mockReturnValue(
      syncState({
        ...blocked(),
        localStats: stats({ ownedCount: 3, skillTotal: 12, gold: 2, silver: 3, bronze: 5 }),
        cloudStats: stats({ ownedCount: 461, skillTotal: 900, gold: 40, silver: 50, bronze: 60 }),
      }),
    )
    render(<Cloud />)

    expect(screen.getByText('Servants')).toBeInTheDocument()
    expect(screen.getByText('Skill Lv')).toBeInTheDocument()
    expect(screen.getByText('Items (G/S/B)')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
    expect(screen.getByText('2/3/5')).toBeInTheDocument()
    expect(screen.getByText('40/50/60')).toBeInTheDocument()
  })

  // いつ・どの端末から保存されたクラウドデータなのかは、復元するかの判断に直結する。
  it('shows when the cloud copy was saved and from which device', () => {
    useCloudSync.mockReturnValue(
      syncState({
        ...blocked(),
        cloudData: {
          storage: { material: '{}' },
          metadata: { updatedAt: '2026-07-01T00:00:00.000Z', deviceId: 'device-abc' },
        },
      }),
    )
    render(<Cloud />)

    expect(screen.getByText('クラウドの最終保存')).toBeInTheDocument()
    // 生の ISO ではなく JST の読みやすい表記(既存 formatDate の流儀)。
    expect(screen.getByText('7月1日 09:00')).toBeInTheDocument()
    expect(screen.queryByText('2026-07-01T00:00:00.000Z')).not.toBeInTheDocument()
    expect(screen.getByText('保存した端末')).toBeInTheDocument()
    expect(screen.getByText('device-abc')).toBeInTheDocument()
  })

  it('lists the names of the missing entries, not only how many', () => {
    useCloudSync.mockReturnValue(
      syncState(blocked({ missingKeys: ['todoState', 'quests'] })),
    )
    render(<Cloud />)

    expect(screen.getByText('todoState, quests')).toBeInTheDocument()
  })

  // クラウドを読めていないのに CLOUD 列の数字を出すと矛盾するので、表ごと出さない。
  it('hides the comparison table when the cloud side could not be measured', () => {
    useCloudSync.mockReturnValue(syncState(blocked({ cloud: null })))
    render(<Cloud />)

    expect(screen.getByText('読み取れません')).toBeInTheDocument()
    expect(screen.queryByText('Servants')).not.toBeInTheDocument()
    expect(screen.queryByText('Skill Lv')).not.toBeInTheDocument()
  })

  it('falls back to the payload counts when stats are unavailable', () => {
    useCloudSync.mockReturnValue(
      syncState({ ...blocked(), localStats: null, cloudStats: null }),
    )
    render(<Cloud />)

    expect(screen.queryByText('Skill Lv')).not.toBeInTheDocument()
    expect(screen.getByText('サーヴァント 0 / 所持素材の種類 0')).toBeInTheDocument()
    expect(screen.getByText('サーヴァント 461 / 所持素材の種類 104')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'このまま保存する' })).toBeInTheDocument()
  })

  it('resolves the block by restoring from the cloud', async () => {
    useCloudSync.mockReturnValue(syncState(blocked()))
    render(<Cloud />)

    await userEvent.click(screen.getByRole('button', { name: '読み込み' }))

    expect(resolveShrinkByRestore).toHaveBeenCalledTimes(1)
    expect(resolveShrinkByForce).not.toHaveBeenCalled()
  })

  it('resolves the block by pushing the save through', async () => {
    useCloudSync.mockReturnValue(syncState(blocked()))
    render(<Cloud />)

    await userEvent.click(screen.getByRole('button', { name: 'このまま保存する' }))

    expect(resolveShrinkByForce).toHaveBeenCalledTimes(1)
    expect(resolveShrinkByRestore).not.toHaveBeenCalled()
  })

  it('reports missing entries only when there are any', () => {
    useCloudSync.mockReturnValue(syncState(blocked()))
    const first = render(<Cloud />)
    expect(screen.queryByText(/保存内容から消えている項目/)).not.toBeInTheDocument()
    first.unmount()

    useCloudSync.mockReturnValue(
      syncState(blocked({ missingKeys: ['todoState', 'quests'] })),
    )
    render(<Cloud />)
    expect(screen.getByText(/保存内容から消えている項目\s*2/)).toBeInTheDocument()
  })

  // 縮小ガードは conflict と同時に立ちうる（コンフリクト中の強制上書きがガードに
  // 掛かる）。そのときは保存が実際に止まっている縮小ガード側を優先する。
  it('prefers the blocked-save UI when a conflict is also present', () => {
    useCloudSync.mockReturnValue(syncState({ ...blocked(), hasConflict: true }))
    render(<Cloud />)

    expect(screen.getByText('保存を中断しています')).toBeInTheDocument()
    expect(screen.queryByText('Sync Conflict Detected')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'このまま保存する' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'クラウドを強制上書き' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the healthy state untouched when nothing is blocked', () => {
    useCloudSync.mockReturnValue(syncState())
    render(<Cloud />)

    expect(screen.getByText('クラウドとの同期は正常です')).toBeInTheDocument()
    expect(screen.queryByText('保存を中断しています')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'このまま保存する' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '読み込み' })).not.toBeInTheDocument()
  })

  it('leaves the existing conflict UI unchanged', () => {
    useCloudSync.mockReturnValue(syncState({ hasConflict: true }))
    render(<Cloud />)

    expect(screen.getByText('Sync Conflict Detected')).toBeInTheDocument()
    expect(screen.queryByText('クラウドとの同期は正常です')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'クラウドを強制上書き' }),
    ).toBeInTheDocument()
  })
})

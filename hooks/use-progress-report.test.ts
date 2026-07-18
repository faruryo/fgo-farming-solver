// @vitest-environment jsdom
//
// Hook-level tests for the D2 window-selection algorithm (design.md
// 2026-07-18): useProgressReport computes forwardLaps/effortLaps for each
// of the d30/d60/d90 candidates and picks the winner via selectBestWindow,
// then returns the single finalized summary as `current` (design.md D2b:
// selection is centralized in the hook, not the display component).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useProgressReport } from './use-progress-report'
import type { PeriodSummary, ProgressResponse } from '../lib/progress/types'
import type { Drops } from '../lib/get-drops'

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'test-user' } } }),
}))

// 単価が扱いやすいよう lapPrice=1/apPrice=1 になる最小構成のドロップ表。
const drops: Drops = {
  items: [{ id: 'itemA', name: 'A', category: 'material', atlasId: 100 }],
  quests: [{ id: 'q1', section: 'Free', area: 'X', name: 'q1', ap: 1 }],
  drop_rates: [{ quest_id: 'q1', item_id: 'itemA', drop_rate: 1 }],
  campaigns: [],
} as unknown as Drops

const mkSummary = (
  period: PeriodSummary['period'],
  overrides: Partial<PeriodSummary> = {}
): PeriodSummary => ({
  period,
  tier: 'none',
  growthTotal: 0,
  newServantCount: 0,
  newServants: [],
  servantGrowth: [],
  elapsedMinutes: 30 * 1440,
  fallback: null,
  pastPosession: { '100': 0 },
  snapshotCreatedAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
})

const noSnapshot = (period: PeriodSummary['period']): PeriodSummary => ({
  period,
  tier: 'none',
  growthTotal: 0,
  newServantCount: 0,
  newServants: [],
  servantGrowth: [],
  elapsedMinutes: 0,
  fallback: 'no_snapshot_for_period',
  snapshotCreatedAt: null,
})

const stubFetch = (periods: ProgressResponse['periods']) => {
  const response: ProgressResponse = {
    generatedAt: '2026-07-18T00:00:00.000Z',
    current: { totalAp: 0 },
    periods,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    })
  )
}

const setLocalStorage = (opts: {
  posession?: Record<string, number>
  targets?: Record<string, number>
  quests?: string[]
  stockEnabled?: boolean
}) => {
  if (opts.posession) localStorage.setItem('posession', JSON.stringify(opts.posession))
  if (opts.targets) localStorage.setItem('material/result', JSON.stringify(opts.targets))
  if (opts.quests) localStorage.setItem('quests', JSON.stringify(opts.quests))
  localStorage.setItem('efficiency/stockEnabled', JSON.stringify(opts.stockEnabled ?? false))
}

describe('useProgressReport (D2: forwardPerDay/effortPerDay 最大の窓を選定)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('直近30日にバースト獲得があれば30日窓の baseline を採用する', async () => {
    // 全窓とも過去所持は同じ(60〜90日前の間は変化なし、直近30日で+100獲得)。
    stubFetch({
      d30: mkSummary('d30', { pastPosession: { '100': 900 }, elapsedMinutes: 30 * 1440 }),
      d60: mkSummary('d60', { pastPosession: { '100': 900 }, elapsedMinutes: 60 * 1440 }),
      d90: mkSummary('d90', { pastPosession: { '100': 900 }, elapsedMinutes: 90 * 1440 }),
    })
    setLocalStorage({
      posession: { '100': 1000 },
      targets: { '100': 100000 },
      quests: ['q1'],
    })

    const { result } = renderHook(() => useProgressReport(null, drops))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.current).not.toBeNull())

    expect(result.current.current?.period).toBe('d30')
    expect(result.current.current?.forwardLaps).toBeCloseTo(100)
  })

  it('直近30日に獲得が乗らない場合は forwardPerDay が高い長い窓を採用する', async () => {
    // 直近30日は変化なし。30〜60日前の間に+1200獲得、60〜90日前の間は変化なし。
    stubFetch({
      d30: mkSummary('d30', { pastPosession: { '100': 1000 }, elapsedMinutes: 30 * 1440 }),
      d60: mkSummary('d60', { pastPosession: { '100': -200 }, elapsedMinutes: 60 * 1440 }),
      d90: mkSummary('d90', { pastPosession: { '100': -200 }, elapsedMinutes: 90 * 1440 }),
    })
    setLocalStorage({
      posession: { '100': 1000 },
      targets: { '100': 100000 },
      quests: ['q1'],
    })

    const { result } = renderHook(() => useProgressReport(null, drops))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.current).not.toBeNull())

    expect(result.current.current?.period).toBe('d60')
  })

  it('全窓で forwardLaps<=0(目標未設定)のときは effortPerDay 最大の候補を採用する', async () => {
    // targets 未設定(=material/result 無し)なので forwardLaps は常に0。
    // effortLaps は純増分のみで比較される: d60 の間に最大の純増(+1200)がある。
    stubFetch({
      d30: mkSummary('d30', { pastPosession: { '100': 1000 }, elapsedMinutes: 30 * 1440 }),
      d60: mkSummary('d60', { pastPosession: { '100': -200 }, elapsedMinutes: 60 * 1440 }),
      d90: mkSummary('d90', { pastPosession: { '100': -200 }, elapsedMinutes: 90 * 1440 }),
    })
    setLocalStorage({
      posession: { '100': 1000 },
      quests: ['q1'],
    })

    const { result } = renderHook(() => useProgressReport(null, drops))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.current).not.toBeNull())

    expect(result.current.current?.period).toBe('d60')
    expect(result.current.current?.forwardLaps ?? 0).toBeLessThanOrEqual(0)
    expect(result.current.current?.effortLaps).toBeCloseTo(1200)
    // effort補完はlegendaryに到達しない(classifyEffortTierのlarge上限キャップ)。
    expect(result.current.current?.tier).not.toBe('legendary')
  })

  it('pastPosession の無い(degenerate/欠損)候補を除外して選定する', async () => {
    stubFetch({
      d30: noSnapshot('d30'),
      d60: mkSummary('d60', { pastPosession: { '100': 400 }, elapsedMinutes: 60 * 1440 }),
      d90: mkSummary('d90', { pastPosession: { '100': 0 }, elapsedMinutes: 90 * 1440 }),
    })
    setLocalStorage({
      posession: { '100': 1000 },
      targets: { '100': 100000 },
      quests: ['q1'],
    })

    const { result } = renderHook(() => useProgressReport(null, drops))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.current).not.toBeNull())

    // d60: +600/60day=10/day, d90: +1000/90day=11.1/day → d90 が forwardPerDay 最大。
    expect(result.current.current?.period).toBe('d90')
  })

  it('直近のみ存在する場合(全候補が同一スナップショット)は単一候補に収束し d30 が選ばれる', async () => {
    const shared = { pastPosession: { '100': 800 }, elapsedMinutes: 5 * 1440 }
    stubFetch({
      d30: mkSummary('d30', shared),
      d60: mkSummary('d60', shared),
      d90: mkSummary('d90', shared),
    })
    setLocalStorage({
      posession: { '100': 1000 },
      targets: { '100': 100000 },
      quests: ['q1'],
    })

    const { result } = renderHook(() => useProgressReport(null, drops))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.current).not.toBeNull())

    expect(result.current.current?.period).toBe('d30')
  })

  it('drops 未取得時は forward/effort とも未算出のまま、比較可能な候補から選定される(fallback付きsummaryも保持)', async () => {
    stubFetch({
      d30: null,
      d60: mkSummary('d60', { pastPosession: { '100': 400 }, elapsedMinutes: 60 * 1440 }),
      d90: mkSummary('d90', { pastPosession: { '100': 0 }, elapsedMinutes: 90 * 1440 }),
    })
    setLocalStorage({ posession: { '100': 1000 } })

    const { result } = renderHook(() => useProgressReport(null, null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.current).not.toBeNull())

    // 未算出時は d60 優先(次に存在する最短窓)で選定される。
    expect(result.current.current?.period).toBe('d60')
    expect(result.current.current?.forwardLaps).toBeUndefined()
  })

  it('全候補が初回登録(pastPosession 無し)ならフォールバック summary をそのまま返す', async () => {
    stubFetch({
      d30: noSnapshot('d30'),
      d60: noSnapshot('d60'),
      d90: noSnapshot('d90'),
    })
    setLocalStorage({ posession: {} })

    const { result } = renderHook(() => useProgressReport(null, drops))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.current).not.toBeNull())

    expect(result.current.current?.period).toBe('d30')
    expect(result.current.current?.fallback).toBe('no_snapshot_for_period')
  })
})

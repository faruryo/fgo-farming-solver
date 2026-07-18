import { describe, it, expect } from 'vitest'
import { selectBestWindow, type WindowKey, type WindowLapValues } from './select-baseline'
import type { PeriodSummary } from './types'

const mk = (
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
  pastPosession: { '6512': 10 },
  snapshotCreatedAt: '2026-05-03T00:00:00.000Z',
  ...overrides,
})

const noSnapshot = (
  period: PeriodSummary['period'],
  fallback: PeriodSummary['fallback'] = 'no_snapshot_for_period'
): PeriodSummary => ({
  period,
  tier: 'none',
  growthTotal: 0,
  newServantCount: 0,
  newServants: [],
  servantGrowth: [],
  elapsedMinutes: 0,
  fallback,
  snapshotCreatedAt: null,
})

describe('selectBestWindow (design.md D2: forwardPerDay/effortPerDay 最大の窓を採用)', () => {
  it('periods が無ければ null', () => {
    expect(selectBestWindow(null)).toBeNull()
    expect(selectBestWindow(undefined)).toBeNull()
  })

  it('直近30日にバースト獲得があれば30日窓を採用する', () => {
    const periods = {
      d30: mk('d30', { elapsedMinutes: 30 * 1440 }),
      d60: mk('d60', { elapsedMinutes: 60 * 1440 }),
      d90: mk('d90', { elapsedMinutes: 90 * 1440 }),
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d30: { forwardLaps: 300 }, // 10/day
      d60: { forwardLaps: 120 }, // 2/day
      d90: { forwardLaps: 90 }, // 1/day
    }
    const b = selectBestWindow(periods, lapValues)
    expect(b?.period).toBe('d30')
  })

  it('直近30日に獲得が乗らない場合は forwardPerDay が高い長い窓を採用する', () => {
    const periods = {
      d30: mk('d30', { elapsedMinutes: 30 * 1440 }),
      d60: mk('d60', { elapsedMinutes: 60 * 1440 }),
      d90: mk('d90', { elapsedMinutes: 90 * 1440 }),
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d30: { forwardLaps: 0 }, // 直近は未消化で前進ゼロ
      d60: { forwardLaps: 1200 }, // 20/day
      d90: { forwardLaps: 900 }, // 10/day
    }
    const b = selectBestWindow(periods, lapValues)
    expect(b?.period).toBe('d60')
  })

  it('全窓で forwardLaps<=0 のときは effortPerDay 最大の候補を採用する', () => {
    const periods = {
      d30: mk('d30', { elapsedMinutes: 30 * 1440 }),
      d60: mk('d60', { elapsedMinutes: 60 * 1440 }),
      d90: mk('d90', { elapsedMinutes: 90 * 1440 }),
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d30: { forwardLaps: 0, effortLaps: 60 }, // 2/day
      d60: { forwardLaps: 0, effortLaps: 1200 }, // 20/day
      d90: { forwardLaps: 0, effortLaps: 900 }, // 10/day
    }
    const b = selectBestWindow(periods, lapValues)
    expect(b?.period).toBe('d60')
  })

  it('forwardPerDay が正の候補があれば effortPerDay の大小は無視する(指標を跨がない)', () => {
    const periods = {
      d30: mk('d30', { elapsedMinutes: 30 * 1440 }),
      d60: mk('d60', { elapsedMinutes: 60 * 1440 }),
      d90: null,
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d30: { forwardLaps: 30, effortLaps: 30 }, // forward 1/day, effort 1/day
      d60: { forwardLaps: 0, effortLaps: 6000 }, // forward 0, effort 100/day (圧倒的に高い)
    }
    const b = selectBestWindow(periods, lapValues)
    // d60 の effortPerDay が高くても、d30 の forwardPerDay(正) が優先される。
    expect(b?.period).toBe('d30')
  })

  it('degenerate(pastPosession 無し)候補は選定から除外される', () => {
    const periods = {
      d30: noSnapshot('d30'),
      d60: mk('d60', { elapsedMinutes: 60 * 1440 }),
      d90: mk('d90', { elapsedMinutes: 90 * 1440 }),
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d60: { forwardLaps: 60 }, // 1/day
      d90: { forwardLaps: 900 }, // 10/day
    }
    const b = selectBestWindow(periods, lapValues)
    expect(b?.period).toBe('d90')
  })

  it('全候補が degenerate/欠損なら d30 優先でフォールバック表示用の候補を返す', () => {
    const periods = {
      d30: noSnapshot('d30', 'first_time'),
      d60: noSnapshot('d60', 'first_time'),
      d90: noSnapshot('d90', 'first_time'),
    }
    const b = selectBestWindow(periods, {})
    expect(b?.period).toBe('d30')
    expect(b?.fallback).toBe('first_time')
  })

  it('一部のみ null(欠損)でも d30 優先でフォールバック候補を返す', () => {
    const periods: Record<WindowKey, PeriodSummary | null> = {
      d30: null,
      d60: noSnapshot('d60', 'no_snapshot_for_period'),
      d90: noSnapshot('d90', 'first_time'),
    }
    const b = selectBestWindow(periods, {})
    expect(b?.period).toBe('d60')
  })

  it('直近のみ存在する場合(全候補が同一スナップショットに解決)は単一候補に収束する', () => {
    const shared = mk('d30', { elapsedMinutes: 5 * 1440 })
    const periods = {
      d30: shared,
      d60: { ...shared, period: 'd60' as const },
      d90: { ...shared, period: 'd90' as const },
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d30: { forwardLaps: 50 },
      d60: { forwardLaps: 50 },
      d90: { forwardLaps: 50 },
    }
    const b = selectBestWindow(periods, lapValues)
    // 同値タイは短い窓を優先する。
    expect(b?.period).toBe('d30')
  })

  it('変化ゼロ(forward/effortとも0)でも pastPosession があれば実比較として選定される', () => {
    const periods = {
      d30: mk('d30', { elapsedMinutes: 30 * 1440 }),
      d60: noSnapshot('d60'),
      d90: noSnapshot('d90'),
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d30: { forwardLaps: 0, effortLaps: 0 },
    }
    const b = selectBestWindow(periods, lapValues)
    expect(b?.period).toBe('d30')
  })

  it('drops 未取得(forward/effort とも未算出)でも比較可能な候補の中から d30 優先で選ぶ', () => {
    const periods = {
      d30: noSnapshot('d30'),
      d60: mk('d60', { elapsedMinutes: 60 * 1440 }),
      d90: mk('d90', { elapsedMinutes: 90 * 1440 }),
    }
    const b = selectBestWindow(periods, {})
    expect(b?.period).toBe('d60')
  })

  it('同値タイは短い窓(d30 > d60 > d90)を優先する', () => {
    const periods = {
      d30: mk('d30', { elapsedMinutes: 30 * 1440 }),
      d60: mk('d60', { elapsedMinutes: 60 * 1440 }),
      d90: mk('d90', { elapsedMinutes: 90 * 1440 }),
    }
    const lapValues: Partial<Record<WindowKey, WindowLapValues>> = {
      d30: { forwardLaps: 0 },
      d60: { forwardLaps: 600 }, // 10/day
      d90: { forwardLaps: 900 }, // 10/day (同値)
    }
    const b = selectBestWindow(periods, lapValues)
    expect(b?.period).toBe('d60')
  })
})

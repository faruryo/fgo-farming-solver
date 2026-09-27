// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBondTracker } from './use-bond-tracker'

const recentResult = {
  items: [],
  params: { items: {}, quests: ['quest-1'] },
  quests: [{ id: 'quest-1', lap: 5 }],
}

const adjustedResult = {
  items: [],
  params: { items: {}, quests: ['quest-1'] },
  quests: [{ id: 'quest-1', lap: 9 }],
}

vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => ({ items: [], quests: [], drop_rates: [], campaigns: [], isLoading: false }),
}))

vi.mock('../../hooks/use-active-campaigns', () => ({
  useActiveCampaigns: () => ({ activeCampaigns: [], digest: '', nowSec: 0 }),
}))

vi.mock('../../hooks/use-local-storage', () => ({
  useLocalStorage: (_key: string, initial: unknown) => [initial, vi.fn()],
}))

vi.mock('../../hooks/use-recent-result', () => ({
  useRecentResult: () => ({ result: recentResult, historyCount: 1, loading: false }),
}))

let dashboardResultValue: unknown = adjustedResult
vi.mock('../../hooks/use-dashboard-result', () => ({
  useDashboardResult: () => dashboardResultValue,
}))

describe('useBondTracker plannedLaps', () => {
  it('uses the dashboard-adjusted result when it differs from the raw stored result', () => {
    dashboardResultValue = adjustedResult
    const { result } = renderHook(() => useBondTracker(undefined))
    expect(result.current.plannedLaps.get('quest-1')).toBe(9)
  })

  it('falls back to the raw stored result when no adjusted result exists (no plan → unchanged behavior)', () => {
    dashboardResultValue = null
    const { result } = renderHook(() => useBondTracker(undefined))
    expect(result.current.plannedLaps.get('quest-1')).toBe(5)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBondTracker } from './use-bond-tracker'
import type { MaterialCatalogServant } from '../../lib/material-catalog'
import type { Quest } from '../../interfaces/fgodrop'

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

let dropQuests: Quest[] = []
vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => ({ items: [], quests: dropQuests, drop_rates: [], campaigns: [], isLoading: false }),
}))

const NOW = 1_000_000
vi.mock('../../hooks/use-active-campaigns', () => ({
  useActiveCampaigns: () => ({ activeCampaigns: [], digest: '', nowSec: NOW }),
}))

let dashboardMetaData: unknown = null
vi.mock('../../hooks/use-dashboard-meta', () => ({
  useDashboardMeta: () => ({ data: dashboardMetaData, isLoading: false, error: null }),
}))

let storedState: unknown = undefined
vi.mock('../../hooks/use-local-storage', () => ({
  useLocalStorage: (_key: string, initial: unknown) => [storedState ?? initial, vi.fn()],
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

describe('useBondTracker のポッド無料期間', () => {
  const GROWTH = [
    3000, 9125, 15250, 21375, 27500, 310000, 610000, 930000, 1270000, 1640000, 2730000, 3960000,
    5320000, 6820000, 8460000, 13460000,
  ]
  const servants = [{ id: 1, className: 'caster', bondGrowth: GROWTH }] as unknown as MaterialCatalogServant[]
  // 残り絆 100,000 ÷ 1周 5,000 = 20周。期間は残り1日（288AP）なので実効40APで7周が無料。
  const state = (useApples: boolean) => ({
    entries: [
      {
        servantId: 1,
        questId: 'grand',
        currentLevel: 14,
        remainingToNext: 100000,
        targetLevel: 15,
        observedPerRun: 5000,
        observedTeapotRun: false,
        measuredQuestId: 'grand',
      },
    ],
    teapot: { enabled: false, stock: 0 },
    useApples,
  })

  const setup = (useApples: boolean, withPeriod = true) => {
    dashboardResultValue = null
    dropQuests = [{ id: 'grand', section: 'Free', area: '冠位研鑽戦', name: '〔キャスター〕 Ⅶ', ap: 40, bondPoints: 4748 }]
    dashboardMetaData = withPeriod
      ? { podFreePeriods: [{ id: 1, name: 'p', startedAt: NOW - 3600, endedAt: NOW + 86400, questIds: ['grand'] }] }
      : null
    storedState = state(useApples)
    return renderHook(() => useBondTracker(servants)).result.current
  }

  it('期間の自然回復で回せる周回だけをポッド0個と数え、見積もりとサーヴァントのカードに反映する', () => {
    const tracker = setup(false)
    expect(tracker.summary.total).toMatchObject({ runs: 20, ap: 800, pods: 13, freeRuns: 7 })
    expect(tracker.cards[0]?.estimate.result).toMatchObject({ pods: 13, consumesPod: true })
    expect(tracker.podFreeQuestIds.has('grand')).toBe(true)
  })

  it('「りんご・石を使う」がオンなら期間中の周回をすべて0個と数え、必要APは変えない', () => {
    const tracker = setup(true)
    expect(tracker.summary.total).toMatchObject({ runs: 20, ap: 800, pods: 0, freeRuns: 20 })
    expect(tracker.cards[0]?.estimate.result).toMatchObject({ pods: 0 })
  })

  it('期間のデータが無ければ従来どおり1周1個と数える', () => {
    const tracker = setup(false, false)
    expect(tracker.summary.total).toMatchObject({ runs: 20, ap: 800, pods: 20, freeRuns: 0 })
  })
})

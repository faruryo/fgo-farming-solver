// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NearGoalSection } from './NearGoalSection'
import { loadMaterialCatalog } from '../../hooks/use-material-catalog'
import { seedServantNeed } from '../../hooks/required-materials-test-utils'

vi.mock('../../hooks/use-material-catalog', () => ({ loadMaterialCatalog: vi.fn() }))
const catalogMock = vi.mocked(loadMaterialCatalog)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

const dropsItem = vi.hoisted<{ atlasId?: number }>(() => ({ atlasId: 6501 }))

vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => ({
    items: [{ id: 'item-1', name: '竜の牙', category: '銅素材', atlasId: dropsItem.atlasId }],
    quests: [{ id: 'quest-1', name: 'デミング', ap: 20 }],
    drop_rates: [{ quest_id: 'quest-1', item_id: 'item-1', drop_rate: 0.5 }],
    campaigns: [],
    isLoading: false,
  }),
}))

vi.mock('../../hooks/use-recent-result', () => ({
  useRecentResult: () => ({
    result: {
      items: [{ id: 'item-1', count: 10 }],
      params: { items: { 'item-1': 10 }, quests: ['quest-1'] },
      questList: [{ id: 'quest-1', count: 20 }],
    },
    loading: false,
  }),
}))

vi.mock('../../hooks/use-spot-icons', () => ({
  useSpotIcons: () => ({}),
}))

vi.mock('../../hooks/use-dashboard-result', () => ({
  useDashboardResult: (result: unknown) => result,
}))

vi.mock('../../hooks/use-active-campaigns', () => ({
  useActiveCampaigns: () => ({ activeCampaigns: [], nowSec: 0 }),
}))

vi.mock('../../hooks/use-dashboard-meta', () => ({
  useDashboardMeta: () => ({ data: null }),
}))

vi.mock('../../hooks/use-pod-free-quests', () => ({
  usePodFreeQuests: () => ({ questIds: new Set(), period: null }),
}))

describe('NearGoalSection', () => {
  beforeEach(() => {
    localStorage.clear()
    dropsItem.atlasId = 6501
    catalogMock.mockReset()
    catalogMock.mockReturnValue(new Promise(() => {}))
  })

  it('育成ぶんがまだ無い端末で開くと移行が走り、目標の無い端末では旧値を目標に使わない', async () => {
    localStorage.setItem('material/result', JSON.stringify({ '6501': 30 }))
    localStorage.setItem('posession', JSON.stringify({ '6501': 25 }))

    render(<NearGoalSection />)

    await waitFor(() => expect(localStorage.getItem('material/servant-result')).toBe('{}'))
    // 旧値の 30 ではなく、計算結果の目標 10 から所持数を引く（10 - 25 で不足なし）
    expect(screen.queryByText('あと5個')).not.toBeInTheDocument()
  })

  it('renders section title and edit possession button if provided', async () => {
    const onOpenPossession = vi.fn()
    const user = userEvent.setup()

    render(<NearGoalSection onOpenPossession={onOpenPossession} />)

    expect(screen.getByText('達成間近の素材')).toBeInTheDocument()
    const editButton = screen.getByRole('button', { name: /所持数を編集/ })
    expect(editButton).toBeInTheDocument()

    await user.click(editButton)
    expect(onOpenPossession).toHaveBeenCalledTimes(1)
  })

  it('does not render edit button when onOpenPossession is not passed', () => {
    render(<NearGoalSection />)
    expect(screen.queryByRole('button', { name: /所持数を編集/ })).not.toBeInTheDocument()
  })

  // #262: 所持数は Atlas ID キー。育成必要数がある素材は、それを目標にして今の所持数を引く。
  it('育成必要数から Atlas ID キーの所持数を1回だけ引いた残りを出す', async () => {
    catalogMock.mockResolvedValue(seedServantNeed({ '6501': 30 }))
    localStorage.setItem('posession', JSON.stringify({ '6501': 25 }))

    render(<NearGoalSection />)

    expect(await screen.findByText('あと5個')).toBeInTheDocument()
    expect(screen.getByText('あと10周で達成！')).toBeInTheDocument()
  })

  it('所持数が ls-sync で目標以上になると達成間近から外れる', async () => {
    catalogMock.mockResolvedValue(seedServantNeed({ '6501': 30 }))
    localStorage.setItem('posession', JSON.stringify({ '6501': 20 }))

    render(<NearGoalSection />)
    expect(await screen.findByText('あと10個')).toBeInTheDocument()

    act(() => {
      localStorage.setItem('posession', JSON.stringify({ '6501': 30 }))
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'posession' } }))
    })

    await waitFor(() => expect(screen.queryByText('達成間近の素材')).not.toBeInTheDocument())
  })

  it('育成必要数が無い素材は計算結果の目標数から所持数を引く', async () => {
    localStorage.setItem('posession', JSON.stringify({ '6501': 4 }))

    render(<NearGoalSection />)

    expect(await screen.findByText('あと6個')).toBeInTheDocument()
  })

  it('atlasId の無い素材は所持数を引けないので計算結果の残数をそのまま出す', async () => {
    dropsItem.atlasId = undefined
    localStorage.setItem('posession', JSON.stringify({ 'item-1': 4, '6501': 4 }))

    render(<NearGoalSection />)

    expect(await screen.findByText('あと10個')).toBeInTheDocument()
  })
})

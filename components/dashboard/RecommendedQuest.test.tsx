// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendedQuest } from './RecommendedQuest'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

const recent = vi.hoisted<{ result: unknown }>(() => ({ result: null }))

vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => ({
    items: [{ id: 'item-1', name: '英雄の証', category: '銅素材', atlasId: 6503 }],
    quests: [{ id: 'quest-1', name: 'ダラス', area: '北米', ap: 21 }],
    drop_rates: [{ quest_id: 'quest-1', item_id: 'item-1', drop_rate: 0.78 }],
    campaigns: [],
    isLoading: false,
  }),
}))

vi.mock('../../hooks/use-recent-result', () => ({
  useRecentResult: () => ({ result: recent.result, loading: false }),
}))

vi.mock('../../hooks/use-spot-icons', () => ({ useSpotIcons: () => ({}) }))
vi.mock('../../hooks/use-dashboard-result', () => ({ useDashboardResult: (r: unknown) => r }))
vi.mock('../../hooks/use-dashboard-sort-mode', () => ({ useDashboardSortMode: () => ['laps', vi.fn()] }))
vi.mock('../../hooks/use-dashboard-meta', () => ({ useDashboardMeta: () => ({ data: null }) }))
vi.mock('../../hooks/use-active-campaigns', () => ({
  useActiveCampaigns: () => ({ activeCampaigns: [], nowSec: 0 }),
}))
vi.mock('../../hooks/use-pod-free-quests', () => ({
  usePodFreeQuests: () => ({ isActive: false, questIds: new Set(), period: null }),
}))

describe('RecommendedQuest', () => {
  beforeEach(() => {
    localStorage.clear()
    recent.result = null
  })

  it('without a farming result or goal, guides to goal input and shows no quest', () => {
    render(<RecommendedQuest />)

    expect(screen.getByText('推奨周回クエスト')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /育成目標を入れる/ })).toHaveAttribute('href', '/material')
    expect(screen.queryByText('ダラス')).not.toBeInTheDocument()
  })

  it('with a goal but no farming result, guides to the solver and shows no quest', () => {
    localStorage.setItem(STORAGE_KEYS.MATERIAL_RESULT, JSON.stringify({ '6503': 12 }))
    render(<RecommendedQuest />)

    expect(screen.getByRole('link', { name: /周回数を求める/ })).toHaveAttribute('href', '/material/result')
    expect(screen.queryByRole('link', { name: /育成目標を入れる/ })).not.toBeInTheDocument()
    expect(screen.queryByText('ダラス')).not.toBeInTheDocument()
  })

  it('with a farming result, lists the planned quests as before', () => {
    recent.result = {
      quests: [{ id: 'quest-1', name: 'ダラス', area: '北米', ap: 21, lap: 30 }],
      items: [{ id: 'item-1', count: 12 }],
      drop_rates: [{ quest_id: 'quest-1', item_id: 'item-1', drop_rate: 0.78 }],
      params: { items: { 'item-1': 12 }, quests: ['quest-1'] },
    }
    render(<RecommendedQuest />)

    expect(screen.getByText('周回予定クエスト')).toBeInTheDocument()
    expect(screen.getByText('あと30周で達成！')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /周回数を求める/ })).not.toBeInTheDocument()
  })
})

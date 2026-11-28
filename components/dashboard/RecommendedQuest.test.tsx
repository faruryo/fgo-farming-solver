// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RecommendedQuest } from './RecommendedQuest'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { loadMaterialCatalog } from '../../hooks/use-material-catalog'
import { seedServantNeed } from '../../hooks/required-materials-test-utils'

vi.mock('../../hooks/use-material-catalog', () => ({ loadMaterialCatalog: vi.fn() }))
const catalogMock = vi.mocked(loadMaterialCatalog)

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
    catalogMock.mockReset()
    catalogMock.mockReturnValue(new Promise(() => {}))
  })

  it('without a farming result or goal, guides to goal input and shows no quest', () => {
    render(<RecommendedQuest />)

    expect(screen.getByText('推奨周回クエスト')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /育成目標を入れる/ })).toHaveAttribute('href', '/material')
    expect(screen.queryByText('ダラス')).not.toBeInTheDocument()
  })

  it('with a goal but no farming result, guides to the solver and shows no quest', () => {
    // 旧フォールバックは material にサーヴァントがあると先頭品目のクエストを出していた
    catalogMock.mockResolvedValue(seedServantNeed({ '6503': 12 }))
    render(<RecommendedQuest />)

    expect(screen.queryByText('ダラス')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /周回数を求める/ })).toHaveAttribute('href', '/material/result')
    expect(screen.queryByRole('link', { name: /育成目標を入れる/ })).not.toBeInTheDocument()
  })

  it('育成目標が無くクラススコアの目標だけでも、合算した必要数があれば周回計算へ誘導する', () => {
    localStorage.setItem(
      STORAGE_KEYS.CLASS_SCORE,
      JSON.stringify({ classes: { saber: 'target' } }),
    )
    render(<RecommendedQuest />)
    expect(screen.getByRole('link', { name: /周回数を求める/ })).toHaveAttribute('href', '/material/result')
  })

  it('育成ぶんがまだ無い端末で開くと移行が走り、目標の無い端末では旧値を必要数に使わない', async () => {
    localStorage.setItem(STORAGE_KEYS.MATERIAL_RESULT, JSON.stringify({ '6503': 12 }))
    render(<RecommendedQuest />)
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEYS.MATERIAL_SERVANT_RESULT)).toBe('{}'))
    expect(screen.getByRole('link', { name: /育成目標を入れる/ })).toHaveAttribute('href', '/material')
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

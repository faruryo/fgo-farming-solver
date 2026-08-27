// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NearGoalSection } from './NearGoalSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => ({
    items: [{ id: 'item-1', name: '竜の牙', category: '銅素材' }],
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
})

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

const mockSession = vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' })
vi.mock('next-auth/react', () => ({
  useSession: () => mockSession(),
}))

vi.mock('../hooks/use-dashboard-meta', () => ({
  useDashboardMeta: () => ({ data: { events: [], recentServants: [], gachas: [] }, isLoading: false }),
}))
vi.mock('../hooks/use-drops', () => ({
  useDrops: () => ({ items: [], isLoading: false }),
}))

vi.mock('../components/common/PossessionModal', () => ({ PossessionModal: () => null }))
vi.mock('../components/dashboard/EventSection', () => ({ EventSection: () => null }))
vi.mock('../components/dashboard/CampaignSection', () => ({ CampaignSection: () => null }))
vi.mock('../components/dashboard/GachaSection', () => ({ GachaSection: () => null }))
vi.mock('../components/dashboard/RecentServantSection', () => ({ RecentServantSection: () => null }))
vi.mock('../components/dashboard/ProgressSection', () => ({ ProgressSection: () => null }))
vi.mock('../components/dashboard/RecommendedQuest', () => ({ RecommendedQuest: () => null }))
vi.mock('../components/dashboard/FarmingWizard', () => ({ FarmingWizard: () => null }))
vi.mock('../components/dashboard/NearGoalSection', () => ({ NearGoalSection: () => null }))
vi.mock('../components/todo/TodoWidget', () => ({ TodoWidget: () => null }))
vi.mock('../components/dashboard/HistoryGraph', () => ({
  HistoryGraph: () => <div data-testid="history-graph">HistoryGraph</div>,
}))

import HomePage from './page'

beforeEach(() => {
  mockSession.mockReturnValue({ data: null, status: 'unauthenticated' })
})

describe('dashboard', () => {
  it('hides the history link and graph when unauthenticated', () => {
    render(<HomePage />)
    expect(screen.queryByRole('link', { name: '計算履歴' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('history-graph')).not.toBeInTheDocument()
  })

  it('hides the history link and graph while the session is being checked', () => {
    mockSession.mockReturnValue({ data: null, status: 'loading' })
    render(<HomePage />)
    expect(screen.queryByRole('link', { name: '計算履歴' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('history-graph')).not.toBeInTheDocument()
  })

  it('renders the history link and graph when authenticated', () => {
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' })
    render(<HomePage />)
    expect(screen.getByRole('link', { name: '計算履歴' })).toHaveAttribute('href', '/farming/history')
    expect(screen.getByTestId('history-graph')).toBeInTheDocument()
  })
})

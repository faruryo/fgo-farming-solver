// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Page, type PageProps } from './result'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}))

vi.mock('../dashboard/HistoryGraph', () => ({
  HistoryGraph: () => <div data-testid="history-graph">HistoryGraph</div>,
}))

vi.mock('./tweet-intent', () => ({
  TweetIntent: () => <div data-testid="tweet-intent">TweetIntent</div>,
}))

const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

const mockResult = {
  items: [
    {
      id: '100',
      category: '金素材',
      name: '灯火の焔',
      largeCategory: '強化素材',
      shortName: '灯火',
      count: 5,
    },
  ],
  quests: [
    { id: '1A01', section: '1章', area: 'エリアA', name: 'クエスト1', ap: 10, lap: 5 },
  ],
  drop_rates: [
    { quest_id: '1A01', quest_name: 'クエスト1', item_id: '100', item_name: '灯火の焔', drop_rate: 0.5 },
  ],
  total_ap: 50,
  total_lap: 5,
  params: { objective: 'both', items: { '100': 5 }, quests: ['1A01'] },
}

const defaultProps: PageProps = {
  apResult: mockResult,
  lapResult: mockResult,
  createdAt: '2026-09-27T00:00:00.000Z',
  isOwner: false,
  isPublic: true,
  resultId: 'res-test-123',
}

describe('components/farming/result Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders TweetIntent when isPublic is true', () => {
    render(<Page {...defaultProps} isPublic={true} />)
    expect(screen.getByTestId('tweet-intent')).toBeInTheDocument()
  })

  it('hides TweetIntent when isPublic is false', () => {
    render(<Page {...defaultProps} isPublic={false} />)
    expect(screen.queryByTestId('tweet-intent')).not.toBeInTheDocument()
  })

  it('does NOT render visibility switch when user is NOT the owner', () => {
    render(<Page {...defaultProps} isOwner={false} />)
    expect(screen.queryByRole('switch', { name: '公開・非公開の切り替え' })).not.toBeInTheDocument()
  })

  it('renders visibility switch and badge when user is the owner', () => {
    render(<Page {...defaultProps} isOwner={true} isPublic={true} />)
    const toggle = screen.getByRole('switch', { name: '公開・非公開の切り替え' })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toBeChecked()
    expect(screen.getByText('公開中')).toBeInTheDocument()
  })

  it('calls PATCH /api/farming/results/[id] when owner toggles visibility', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, isPublic: false }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<Page {...defaultProps} isOwner={true} isPublic={true} />)

    const toggle = screen.getByRole('switch', { name: '公開・非公開の切り替え' })
    await user.click(toggle)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/farming/results/res-test-123',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isPublic: false }),
      })
    )

    // After toggling to private, TweetIntent should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('tweet-intent')).not.toBeInTheDocument()
      expect(screen.getByText('非公開')).toBeInTheDocument()
    })
  })

  it('rolls back visibility state and shows error toast when PATCH fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<Page {...defaultProps} isOwner={true} isPublic={true} />)

    const toggle = screen.getByRole('switch', { name: '公開・非公開の切り替え' })
    expect(toggle).toBeChecked()

    await user.click(toggle)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('公開設定の更新に失敗しました')
      expect(toggle).toBeChecked()
      expect(screen.getByText('公開中')).toBeInTheDocument()
    })
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventSection } from './EventSection'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import type { DashboardEvent } from '../../lib/master-data/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { count?: number }, options?: { count?: number }) => {
      const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key
      const opts = typeof fallbackOrOptions === 'object' ? fallbackOrOptions : options
      if (opts?.count !== undefined) {
        return fallback.replace('{{count}}', String(opts.count))
      }
      return fallback
    },
  }),
}))

const mockEvents: DashboardEvent[] = [
  {
    id: 1001,
    name: 'バレンタインイベント',
    banner: 'https://example.com/banner1.png',
    startedAt: 1700000000,
    endedAt: 1701000000,
    shopFinishedAt: 1701500000,
    type: 'eventQuest',
    drops: [{ id: 101, name: 'チョコ', icon: 'https://example.com/drop1.png' }],
    hasLottery: false,
  },
  {
    id: 1002,
    name: 'ホワイトデーイベント',
    banner: 'https://example.com/banner2.png',
    startedAt: 1700000000,
    endedAt: 1701000000,
    shopFinishedAt: 1701500000,
    type: 'eventQuest',
    drops: [{ id: 102, name: 'クッキー', icon: 'https://example.com/drop2.png' }],
    hasLottery: true,
  },
]

describe('EventSection', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders all events normally when none are completed', () => {
    render(<EventSection events={mockEvents} />)

    expect(screen.getByText('開催中のイベント')).toBeInTheDocument()
    expect(screen.getByText('バレンタインイベント')).toBeInTheDocument()
    expect(screen.getByText('ホワイトデーイベント')).toBeInTheDocument()
    expect(screen.queryByText('交換完了')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /完了済みを非表示/ })).not.toBeInTheDocument()
  })

  it('displays completion badge when an event TODO is completed', () => {
    localStorage.setItem(
      STORAGE_KEYS.TODO_STATE,
      JSON.stringify([
        { id: 'event-shop-1001', title: 'バレンタイン', category: 'event', deadline: '', completed: true },
      ])
    )

    render(<EventSection events={mockEvents} />)

    expect(screen.getByText('バレンタインイベント')).toBeInTheDocument()
    expect(screen.getByText('交換完了')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /完了済みを非表示/ })).toBeInTheDocument()
  })

  it('hides completed events and allows expanding via accordion when hideCompleted is active', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      STORAGE_KEYS.TODO_STATE,
      JSON.stringify([
        { id: 'event-shop-1001', title: 'バレンタイン', category: 'event', deadline: '', completed: true },
      ])
    )
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_HIDE_COMPLETED_EVENTS, JSON.stringify(true))

    render(<EventSection events={mockEvents} />)

    // Active event is visible
    expect(screen.getByText('ホワイトデーイベント')).toBeInTheDocument()
    // Completed event is hidden from main view
    expect(screen.queryByText('バレンタインイベント')).not.toBeInTheDocument()

    // Accordion button exists
    const accordionBtn = screen.getByRole('button', { name: /完了済みのイベント（1件）を表示/ })
    expect(accordionBtn).toBeInTheDocument()

    // Click to expand
    await user.click(accordionBtn)
    expect(screen.getByText('バレンタインイベント')).toBeInTheDocument()

    // Click again to collapse
    const collapseBtn = screen.getByRole('button', { name: /完了済みのイベント（1件）を折りたたむ/ })
    await user.click(collapseBtn)
    expect(screen.queryByText('バレンタインイベント')).not.toBeInTheDocument()
  })

  it('toggles hideCompleted setting and persists in localStorage without mutating todoState', async () => {
    const user = userEvent.setup()
    const initialTodoState = [
      { id: 'event-shop-1001', title: 'バレンタイン', category: 'event', deadline: '', completed: true },
    ]
    localStorage.setItem(STORAGE_KEYS.TODO_STATE, JSON.stringify(initialTodoState))

    render(<EventSection events={mockEvents} />)

    const toggleBtn = screen.getByRole('button', { name: /完了済みを非表示/ })
    await user.click(toggleBtn)

    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_HIDE_COMPLETED_EVENTS)).toBe('true')
    // Verify todoState is completely untouched (read-only)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.TODO_STATE) ?? '[]')).toEqual(initialTodoState)
  })
})

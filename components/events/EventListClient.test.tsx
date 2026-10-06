// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { EventListClient } from './EventListClient'
import type { EventSummaryWithFeatures } from '../../lib/event-features'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}))

const ended = (id: number, name: string, features: EventSummaryWithFeatures['features']): EventSummaryWithFeatures => ({
  id,
  name,
  startedAt: 1000,
  endedAt: 2000,
  features,
})

const cardOf = (name: string) => screen.getByText(name).closest('a') as HTMLElement

describe('EventListClient', () => {
  it('shows the generic header and feature badges per event', () => {
    render(
      <EventListClient
        updatedAt={0}
        events={[ended(1, 'ボックスのみ', ['box']), ended(2, '料理のみ', ['craft']), ended(3, '両方', ['box', 'craft'])]}
      />,
    )

    expect(screen.getByText('イベント一覧')).toBeInTheDocument()

    const box = within(cardOf('ボックスのみ'))
    expect(box.getByText('ボックス計画')).toBeInTheDocument()
    expect(box.queryByText('料理作成')).not.toBeInTheDocument()

    const craft = within(cardOf('料理のみ'))
    expect(craft.getByText('料理作成')).toBeInTheDocument()
    expect(craft.queryByText('ボックス計画')).not.toBeInTheDocument()

    const both = within(cardOf('両方'))
    expect(both.getByText('ボックス計画')).toBeInTheDocument()
    expect(both.getByText('料理作成')).toBeInTheDocument()
    expect(cardOf('両方')).toHaveAttribute('href', '/events/3')
  })
})

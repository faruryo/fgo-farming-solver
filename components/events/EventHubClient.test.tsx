// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { EventHubClient } from './EventHubClient'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const template = typeof fallback === 'string' ? fallback : key
      const vars = typeof fallback === 'object' ? fallback : options
      return vars
        ? template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
            const value: unknown = Reflect.get(vars, name)
            return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
          })
        : template
    },
  }),
}))

vi.mock('./EventPlannerClient', () => ({
  EventPlannerClient: () => <div data-testid="box-planner" />,
}))

vi.mock('./EventCraftSection', () => ({
  EventCraftSection: () => <div data-testid="craft-section" />,
}))

const shopEntry = (itemId: number, costItemId: number, extra: Partial<EventShopItem> = {}): EventShopItem => ({
  itemId,
  qty: 2,
  costItemId,
  costAmount: 30,
  limitNum: 5,
  name: `素材${itemId}`,
  ...extra,
})

const event = (overrides: Partial<EventPlannerEvent>): EventPlannerEvent => ({
  id: 80632,
  name: 'テストイベント',
  type: 'eventQuest',
  startedAt: 1000,
  endedAt: 2000,
  currency: { id: 94001, name: '武蔵うどん', icon: '' },
  unlimitedBoxes: false,
  lotteries: [],
  shop: [],
  farmingNodes: [],
  ...overrides,
})

const summary = { id: 80632, name: 'テストイベント', startedAt: 1000, endedAt: 2000 }

describe('EventHubClient', () => {
  it('ロトの無い交換所イベントでは交換所一覧を通貨ごとに出し、ボックス計画は出さない', () => {
    const shopEvent = event({
      shop: [
        shopEntry(1, 94001, { costName: '武蔵うどん' }),
        shopEntry(2, 94002, { costName: '江戸むすび', limitNum: 0 }),
        shopEntry(3, 94001, { costName: '武蔵うどん', costAmount: 100, limitNum: 2 }),
      ],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    expect(screen.queryByTestId('box-planner')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '交換所' })).toBeInTheDocument()

    const udon = screen.getByRole('heading', { name: '武蔵うどん' }).closest('div.rounded-md') as HTMLElement
    expect(within(udon).getByText('全交換 350')).toBeInTheDocument()
    expect(within(udon).getByText('素材1')).toBeInTheDocument()
    expect(within(udon).getByText('素材3')).toBeInTheDocument()
    expect(within(udon).queryByText('素材2')).not.toBeInTheDocument()

    const musubi = screen.getByRole('heading', { name: '江戸むすび' }).closest('div.rounded-md') as HTMLElement
    expect(within(musubi).getByText('全交換 0')).toBeInTheDocument()
    expect(within(musubi).getByText('＋上限なし 1 品目')).toBeInTheDocument()
    expect(within(musubi).getByText('上限なし')).toBeInTheDocument()
  })

  it('通貨名を持たない古いデータでは通貨の ID を見出しに出す', () => {
    render(<EventHubClient summary={summary} boxEvent={event({ shop: [shopEntry(1, 94001)] })} features={['shop']} />)

    expect(screen.getByRole('heading', { name: 'ID 94001' })).toBeInTheDocument()
  })

  it('ロトのあるイベントではボックス計画を出し、交換所一覧は出さない', () => {
    const boxEvent = event({
      lotteries: [{ boxIndex: 0, costPerBox: 100, contents: [], rareRewards: [] }],
      shop: [shopEntry(1, 94001, { costName: '武蔵うどん' })],
    })
    render(<EventHubClient summary={summary} boxEvent={boxEvent} features={['box', 'shop']} />)

    expect(screen.getByTestId('box-planner')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '交換所' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '武蔵うどん' })).not.toBeInTheDocument()
  })

  it('KV に交換所のデータが無ければ交換所一覧を出さない', () => {
    render(<EventHubClient summary={summary} features={['shop', 'craft']} />)

    expect(screen.queryByRole('heading', { name: '交換所' })).not.toBeInTheDocument()
  })

  it('KV のイベントの交換所が空なら交換所一覧を出さない', () => {
    render(<EventHubClient summary={summary} boxEvent={event({ shop: [] })} features={['shop']} />)

    expect(screen.queryByRole('heading', { name: '交換所' })).not.toBeInTheDocument()
  })
})

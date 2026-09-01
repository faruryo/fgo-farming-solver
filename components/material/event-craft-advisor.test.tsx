// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  EventCraftAdvisor,
  EventCraftExpectedYields,
} from './event-craft-advisor'
import {
  EVENT_CRAFT_RECIPES_2026,
  sumExpectedCraftYields,
} from '../../data/event-craft-recipes'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { Drops } from '../../lib/get-drops'
import { Item } from '../../interfaces/atlas-academy'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: Record<string, unknown>) => {
      let str = fallback ?? _key
      if (options) {
        Object.entries(options).forEach(([k, v]) => {
          str = str.replaceAll(`{{${k}}}`, String(v))
        })
      }
      return str
    },
  }),
}))

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <span>{props.alt}</span>,
}))

const mockDrops: Drops & { isLoading?: boolean } = {
  items: [
    {
      id: '01',
      category: '銅素材',
      largeCategory: '強化素材',
      shortName: '凶骨',
      name: '凶骨',
      atlasId: 6516,
    },
  ],
  quests: [{ id: 'Q1', section: 'Free', area: 'A', name: 'Q1', ap: 20 }],
  drop_rates: [{ quest_id: 'Q1', item_id: '01', drop_rate: 1 }],
  campaigns: [],
  isLoading: false,
}

vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => mockDrops,
}))

describe('EventCraftExpectedYields', () => {
  it('shows the plan heading and summed expected counts, not only per-dish yields', () => {
    const andagi = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === 'skull-andagi')
    const steak = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === 'steak')
    if (!andagi || !steak) {
      throw new Error('missing bronze recipes')
    }
    const entries = sumExpectedCraftYields([
      { recipe: andagi, totalCount: 2 },
      { recipe: steak, totalCount: 3 },
    ])
    const skull = entries.find((e) => e.shortId === '01')
    expect(skull).toBeDefined()
    if (!skull) return

    render(<EventCraftExpectedYields entries={entries} />)

    expect(screen.getByText('この配分での期待獲得')).toBeTruthy()
    expect(screen.getByText(`凶骨 ${skull.amount.toFixed(1)}`)).toBeTruthy()
    expect(screen.queryByText(/期待: /)).toBeNull()
  })
})

describe('EventCraftAdvisor cards', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(
      STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
      JSON.stringify({
        exhaustIngredients: false,
        ingredients: { seafood: 20, meat: 20, vegetable: 20 },
      }),
    )
  })

  it('still lists dish names and a per-dish expected yield line', () => {
    const items: Item[] = [
      {
        id: 6516,
        name: '凶骨',
        type: 'skillLvUp',
        uses: 'skill',
        detail: '',
        icon: '',
        background: 'bronze',
        priority: 1,
        dropPriority: 1,
      },
    ]
    render(
      <EventCraftAdvisor
        items={items}
        fullNeed={{ '01': 1 }}
        mode="ap"
        onModeChange={() => undefined}
        stockEnabled={false}
      />,
    )
    expect(screen.getByText('ドクロアンダギー')).toBeTruthy()
    expect(screen.getAllByText(/期待: /).length).toBeGreaterThan(0)
  })

  it('対象素材の不足数を表示する', () => {
    const items: Item[] = [
      {
        id: 6516,
        name: '凶骨',
        type: 'skillLvUp',
        uses: 'skill',
        detail: '',
        icon: '',
        background: 'bronze',
        priority: 1,
        dropPriority: 1,
      },
    ]
    render(
      <EventCraftAdvisor
        items={items}
        fullNeed={{ '01': 1 }}
        mode="ap"
        onModeChange={() => undefined}
        stockEnabled={false}
      />,
    )
    expect(screen.getByText('不足 あと1個')).toBeTruthy()
  })

  it('renders ingredient inputs with item icons and labels', () => {
    const items: Item[] = []
    render(
      <EventCraftAdvisor
        items={items}
        fullNeed={{}}
        mode="ap"
        onModeChange={() => undefined}
        stockEnabled={false}
      />,
    )
    expect(screen.getByText('うちなー海鮮盛り')).toBeTruthy()
    expect(screen.getByText('うちなーお肉盛り')).toBeTruthy()
    expect(screen.getByText('うちなー野菜盛り')).toBeTruthy()
  })

  it('renders cost ingredient badges and leftover amounts', () => {
    const items: Item[] = [
      {
        id: 6516,
        name: '凶骨',
        type: 'skillLvUp',
        uses: 'skill',
        detail: '',
        icon: '',
        background: 'bronze',
        priority: 1,
        dropPriority: 1,
      },
    ]
    render(
      <EventCraftAdvisor
        items={items}
        fullNeed={{ '01': 1 }}
        mode="ap"
        onModeChange={() => undefined}
        stockEnabled={false}
      />,
    )
    expect(screen.getByText('残余食材:')).toBeTruthy()
    expect(screen.getByText('海鮮 0')).toBeTruthy()
    expect(screen.getByText('お肉 0')).toBeTruthy()
    expect(screen.getByText('野菜 0')).toBeTruthy()
  })
})

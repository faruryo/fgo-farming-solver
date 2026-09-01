// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  EventCraftAdvisor,
  EventCraftExpectedYields,
  INGREDIENT_COMMIT_DELAY_MS,
  migrateEventCraftConfig,
} from './event-craft-advisor'
import { EVENT_CRAFT_RECIPES_2026, sumExpectedCraftYields } from '../../data/event-craft-recipes'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { Drops } from '../../lib/get-drops'
import { Item } from '../../interfaces/atlas-academy'
import { IngredientCounts } from '../../data/event-craft-recipes'

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
    { id: '01', category: '銅素材', largeCategory: '強化素材', shortName: '凶骨', name: '凶骨', atlasId: 6516 },
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
    vi.stubGlobal('Worker', undefined)
    localStorage.clear()
    localStorage.setItem(
      STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
      JSON.stringify({
        exhaustIngredients: false,
        ingredients: { seafood: 20, meat: 20, vegetable: 20 },
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
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
        stockEnabled={false}
      />,
    )
    expect(screen.getAllByText('ドクロアンダギー').length).toBeGreaterThan(0)
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
        stockEnabled={false}
      />,
    )
    expect(screen.getAllByText('不足 あと1個').length).toBeGreaterThan(0)
  })

  it('shows runs and exhaust pattern cards without cooking-tab switches', () => {
    render(<EventCraftAdvisor fullNeed={{ '01': 1 }} />)
    expect(
      screen.getByRole('radio', { name: '周回を減らす' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: '食材を使い切る' }),
    ).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('updates Mash advice from the selected pattern', () => {
    localStorage.setItem(
      STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
      JSON.stringify({
        ingredients: { seafood: 100, meat: 100, vegetable: 100 },
        planPattern: 'runs',
      }),
    )
    render(<EventCraftAdvisor fullNeed={{}} />)
    fireEvent.click(
      screen.getByRole('radio', { name: '食材を使い切る' }),
    )
    expect(screen.getByText(/最優先は/)).toBeTruthy()
    expect(
      screen
        .getByRole('radio', { name: '食材を使い切る' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.EVENT_CRAFT_ADVISOR) ?? '{}',
    ) as { planPattern?: string }
    expect(stored.planPattern).toBe('exhaust')
  })

  it('keeps typed ingredients in the field before the idle delay, then persists', () => {
    vi.useFakeTimers()
    render(<EventCraftAdvisor fullNeed={{ '01': 1 }} />)
    const seafood = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(seafood, { target: { value: '12' } })
    expect(seafood).toHaveValue(12)
    expect(screen.getByText('最適な配分を計算しています、先輩...')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: '周回を減らす' })).toBeNull()
    const storedIngredients = () => {
      const parsed = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.EVENT_CRAFT_ADVISOR) ?? '{}',
      ) as { ingredients?: IngredientCounts }
      return parsed.ingredients
    }
    expect(storedIngredients()?.seafood).toBe(20)
    act(() => {
      vi.advanceTimersByTime(INGREDIENT_COMMIT_DELAY_MS - 1)
    })
    expect(storedIngredients()?.seafood).toBe(20)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(storedIngredients()?.seafood).toBe(12)
    vi.useRealTimers()
  })
})

describe('migrateEventCraftConfig', () => {
  const ingredients = { seafood: 1, meat: 2, vegetable: 3 }

  it('keeps a valid pattern and migrates the legacy exhaust flag', () => {
    expect(
      migrateEventCraftConfig({ ingredients, planPattern: 'even-ap' }),
    ).toEqual({ ingredients, planPattern: 'even-ap' })
    expect(
      migrateEventCraftConfig({ ingredients, exhaustIngredients: true }),
    ).toEqual({ ingredients, planPattern: 'exhaust' })
    expect(
      migrateEventCraftConfig({ ingredients, exhaustIngredients: false }),
    ).toEqual({ ingredients, planPattern: 'runs' })
  })

  it('falls back to runs for invalid persisted data', () => {
    expect(migrateEventCraftConfig({ ingredients, planPattern: 'bad' })).toEqual(
      { ingredients, planPattern: 'runs' },
    )
  })
})

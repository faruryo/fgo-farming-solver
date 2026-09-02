// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  EventCraftAdvisor,
  INGREDIENT_COMMIT_DELAY_MS,
  migrateEventCraftConfig,
} from './event-craft-advisor'
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
  default: (props: { src?: string; alt?: string; className?: string }) => (
    <span
      role="img"
      aria-label={props.alt}
      data-src={props.src}
      className={props.className}
    />
  ),
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
      icon: 'https://static.atlasacademy.io/JP/Items/6516.png',
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

describe('EventCraftAdvisor cards', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', undefined)
    localStorage.clear()
    localStorage.setItem(
      STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
      JSON.stringify({
        planPattern: 'runs',
        ingredients: { seafood: 20, meat: 20, vegetable: 20 },
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('groups dish cards and summed material yields by rarity zone instead of a flat plan-wide list', () => {
    const items: Item[] = [
      {
        id: 6516,
        name: '凶骨',
        type: 'skillLvUp',
        uses: 'skill',
        detail: '',
        icon: 'https://static.atlasacademy.io/JP/Items/6516.png',
        background: 'bronze',
        priority: 1,
        dropPriority: 1,
      },
    ]
    const { container } = render(
      <EventCraftAdvisor
        items={items}
        fullNeed={{ '01': 1 }}
        stockEnabled={false}
      />,
    )
    expect(screen.getAllByText('ドクロアンダギー').length).toBeGreaterThan(0)
    expect(screen.getAllByText('銅レア素材').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/凶骨 /).length).toBeGreaterThan(0)
    expect(screen.queryByText('この配分での期待獲得')).toBeNull()
    expect(screen.queryByText(/期待: /)).toBeNull()

    const yieldTileIcon = container.querySelector(
      '.grid [data-src="https://static.atlasacademy.io/JP/Items/6516.png"]',
    )
    expect(yieldTileIcon).toBeTruthy()
    expect(yieldTileIcon?.getAttribute('aria-label')).toBe('凶骨')
  })

  it('対象素材の不足数を表示する', () => {
    const items: Item[] = [
      {
        id: 6516,
        name: '凶骨',
        type: 'skillLvUp',
        uses: 'skill',
        detail: '',
        icon: 'https://static.atlasacademy.io/JP/Items/6516.png',
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

  it('renders ingredient inputs with item icons and labels', () => {
    const items: Item[] = []
    render(
      <EventCraftAdvisor items={items} fullNeed={{}} stockEnabled={false} />,
    )
    const seafoodLabel = screen.getByText('うちなー海鮮盛り').closest('label')
    const meatLabel = screen.getByText('うちなーお肉盛り').closest('label')
    const vegLabel = screen.getByText('うちなー野菜盛り').closest('label')

    expect(seafoodLabel).toBeTruthy()
    expect(meatLabel).toBeTruthy()
    expect(vegLabel).toBeTruthy()

    expect(
      seafoodLabel?.querySelector(
        '[data-src="https://static.atlasacademy.io/JP/Items/94159005.png"]',
      ),
    ).toBeTruthy()
    expect(
      meatLabel?.querySelector(
        '[data-src="https://static.atlasacademy.io/JP/Items/94159006.png"]',
      ),
    ).toBeTruthy()
    expect(
      vegLabel?.querySelector(
        '[data-src="https://static.atlasacademy.io/JP/Items/94159004.png"]',
      ),
    ).toBeTruthy()
  })

  it('renders dish icons, cost badges, and leftover ingredient icons', () => {
    const items: Item[] = [
      {
        id: 6516,
        name: '凶骨',
        type: 'skillLvUp',
        uses: 'skill',
        detail: '',
        icon: 'https://static.atlasacademy.io/JP/Items/6516.png',
        background: 'bronze',
        priority: 1,
        dropPriority: 1,
      },
    ]
    const { container } = render(
      <EventCraftAdvisor
        items={items}
        fullNeed={{ '01': 1 }}
        stockEnabled={false}
      />,
    )

    // 余った食材セクションのアイコン
    const leftoverSection = screen
      .getAllByText('余った食材:')[0]
      ?.closest('div')
    expect(leftoverSection).toBeTruthy()
    expect(
      leftoverSection?.querySelector(
        '[data-src="https://static.atlasacademy.io/JP/Items/94159005.png"]',
      ),
    ).toBeTruthy()
    expect(
      leftoverSection?.querySelector(
        '[data-src="https://static.atlasacademy.io/JP/Items/94159006.png"]',
      ),
    ).toBeTruthy()
    expect(
      leftoverSection?.querySelector(
        '[data-src="https://static.atlasacademy.io/JP/Items/94159004.png"]',
      ),
    ).toBeTruthy()
    expect(screen.getAllByText('海鮮 0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('お肉 0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('野菜 0').length).toBeGreaterThan(0)

    // 料理アイコン (ドクロアンダギー: icon_8061404.png)
    expect(
      container.querySelector(
        '[data-src="https://static.atlasacademy.io/JP/EventUI/Prefabs/80614/icon_8061404.png"]',
      ),
    ).toBeTruthy()

    // 料理カードのオーバーレイ素材アイコン (凶骨: 6516.png)
    const overlayMaterialImg = container.querySelector(
      '[data-src="https://static.atlasacademy.io/JP/Items/6516.png"]',
    )
    expect(overlayMaterialImg).toBeTruthy()
    expect(overlayMaterialImg?.getAttribute('aria-label')).toBe('凶骨')

    // 消費食材バッジアイコン
    const seafoodCostBadge = container.querySelector(
      '[data-src="https://static.atlasacademy.io/JP/Items/94159005.png"][aria-label="海鮮"]',
    )
    expect(seafoodCostBadge).toBeTruthy()
    const meatCostBadge = container.querySelector(
      '[data-src="https://static.atlasacademy.io/JP/Items/94159006.png"][aria-label="お肉"]',
    )
    expect(meatCostBadge).toBeTruthy()
    const vegCostBadge = container.querySelector(
      '[data-src="https://static.atlasacademy.io/JP/Items/94159004.png"][aria-label="野菜"]',
    )
    expect(vegCostBadge).toBeTruthy()
  })

  it('shows runs pattern card and never shows exhaust', () => {
    render(<EventCraftAdvisor fullNeed={{ '01': 1 }} />)
    expect(screen.getByRole('radio', { name: '周回を減らす' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: '食材を使い切る' })).toBeNull()
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
    const apRadio = screen.queryByRole('radio', { name: 'APを減らす' })
    if (apRadio) {
      fireEvent.click(apRadio)
      expect(
        screen.getByText(/を作成するのが最も効率的です、先輩。/),
      ).toBeTruthy()
      expect(apRadio.getAttribute('aria-checked')).toBe('true')
      const stored = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.EVENT_CRAFT_ADVISOR) ?? '{}',
      ) as { planPattern?: string }
      expect(stored.planPattern).toBe('ap')
    } else {
      expect(screen.getByRole('radio', { name: '周回を減らす' })).toBeTruthy()
    }
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

  it('keeps a valid pattern and migrates legacy exhaust pattern or flag to runs', () => {
    expect(
      migrateEventCraftConfig({ ingredients, planPattern: 'even-ap' }),
    ).toEqual({ ingredients, planPattern: 'even-ap' })
    expect(
      migrateEventCraftConfig({ ingredients, planPattern: 'exhaust' }),
    ).toEqual({ ingredients, planPattern: 'runs' })
    expect(
      migrateEventCraftConfig({ ingredients, exhaustIngredients: true }),
    ).toEqual({ ingredients, planPattern: 'runs' })
    expect(
      migrateEventCraftConfig({ ingredients, exhaustIngredients: false }),
    ).toEqual({ ingredients, planPattern: 'runs' })
  })

  it('falls back to runs for invalid persisted data', () => {
    expect(
      migrateEventCraftConfig({ ingredients, planPattern: 'bad' }),
    ).toEqual({ ingredients, planPattern: 'runs' })
  })
})

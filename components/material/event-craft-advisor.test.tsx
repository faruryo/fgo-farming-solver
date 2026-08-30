// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import {
  EventCraftAdvisor,
  EventCraftExpectedYields,
  migrateEventCraftConfig,
} from './event-craft-advisor'
import {
  EVENT_CRAFT_FEATURED_YIELD,
  EVENT_CRAFT_RECIPES_2026,
  EventCraftRecipe,
  sumExpectedCraftYields,
} from '../../data/event-craft-recipes'
import {
  CraftAllocationItem,
  EventCraftPatternId,
  EventCraftPatternMetric,
  EventCraftPlanPattern,
  EventCraftPlanResult,
} from '../../lib/event-craft-advisor'
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

const mockComputeEventCraftPlan = vi.fn()

vi.mock('../../lib/event-craft-advisor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/event-craft-advisor')>()
  return {
    ...actual,
    computeEventCraftPlan: (...args: unknown[]) => mockComputeEventCraftPlan(...args),
  }
})

const makeRecipe = (id: string, shortId: string): EventCraftRecipe => ({
  id,
  name: `recipe-${id}`,
  costs: { seafood: 10, meat: 10, vegetable: 10 },
  targetItem: { atlasId: 1, shortId, name: `mat-${shortId}`, rarity: 'bronze' },
  yieldCount: EVENT_CRAFT_FEATURED_YIELD,
})

const recipeA = makeRecipe('recipe-a', 'item-a')
const recipeB = makeRecipe('recipe-b', 'item-b')

const makeAllocation = (recipe: EventCraftRecipe, count: number): CraftAllocationItem => ({
  recipe,
  deficitCount: count,
  surplusCount: 0,
  totalCount: count,
  unitSaved: count > 0 ? 5 : 0,
  deficitSaved: count > 0 ? 5 * count : 0,
  surplusValue: 0,
  spentIngredients: {
    seafood: recipe.costs.seafood * count,
    meat: recipe.costs.meat * count,
    vegetable: recipe.costs.vegetable * count,
  },
})

const makePattern = (
  id: EventCraftPatternId,
  metric: EventCraftPatternMetric,
  allocations: CraftAllocationItem[],
  aliasOf: EventCraftPatternId[] = [],
): EventCraftPlanPattern => ({
  id,
  metric,
  allocations,
  totalCrafted: allocations.reduce((s, a) => s + a.totalCount, 0),
  totalDeficitCrafted: allocations.reduce((s, a) => s + a.deficitCount, 0),
  totalSurplusCrafted: 0,
  totalSaved: 10,
  totalSurplusValue: 0,
  spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
  leftoverIngredients: { seafood: 5, meat: 5, vegetable: 5 },
  residualTurnCost: 3,
  residualApCost: 60,
  baselineTurnCost: 13,
  baselineApCost: 260,
  aliasOf,
})

const makePlan = (
  patterns: EventCraftPlanPattern[],
  absorbedInto: EventCraftPlanResult['absorbedInto'] = {},
): EventCraftPlanResult => ({ patterns, absorbedInto })

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

describe('EventCraftAdvisor pattern cards', () => {
  beforeEach(() => {
    localStorage.clear()
    mockComputeEventCraftPlan.mockReset()
  })

  it('never renders a dish with totalCount 0', () => {
    mockComputeEventCraftPlan.mockReturnValue(
      makePlan([
        makePattern('runs', 'turn', [makeAllocation(recipeA, 2), makeAllocation(recipeB, 0)]),
        makePattern('exhaust', 'both', [makeAllocation(recipeA, 1)]),
      ]),
    )
    render(<EventCraftAdvisor items={items} fullNeed={{ 'item-a': 1 }} />)

    expect(screen.getAllByText('recipe-recipe-a').length).toBeGreaterThan(0)
    expect(screen.queryByText('recipe-recipe-b')).toBeNull()
  })

  it('always shows runs and exhaust cards', () => {
    mockComputeEventCraftPlan.mockReturnValue(
      makePlan([
        makePattern('runs', 'turn', [makeAllocation(recipeA, 1)]),
        makePattern('exhaust', 'both', [makeAllocation(recipeA, 1)]),
      ]),
    )
    render(<EventCraftAdvisor items={items} fullNeed={{}} />)

    expect(screen.getByText('周回を減らす')).toBeTruthy()
    expect(screen.getByText('食材を使い切る')).toBeTruthy()
  })

  it('shows the residual cost on non-exhaust cards too, not just the savings amount', () => {
    mockComputeEventCraftPlan.mockReturnValue(
      makePlan([
        makePattern('runs', 'turn', [makeAllocation(recipeA, 1)]),
        makePattern('exhaust', 'both', [makeAllocation(recipeA, 1)]),
      ]),
    )
    render(<EventCraftAdvisor items={items} fullNeed={{}} />)

    const runsCard = screen.getByRole('radio', { name: '周回を減らす' })
    expect(within(runsCard).getByText('残余: 3 周回')).toBeTruthy()
    expect(within(runsCard).getByText('合計 −10 周回 節約')).toBeTruthy()
  })

  it('shows a conditional card only when distinct, and lists its name as an alias on the fold target otherwise', () => {
    mockComputeEventCraftPlan.mockReturnValue(
      makePlan([
        makePattern('runs', 'turn', [makeAllocation(recipeA, 1)], ['even-turn']),
        makePattern('ap', 'ap', [makeAllocation(recipeB, 1)]),
        makePattern('exhaust', 'both', [makeAllocation(recipeA, 1)]),
      ]),
    )
    render(<EventCraftAdvisor items={items} fullNeed={{}} />)

    expect(screen.getByText('APを減らす')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /満遍なく（周回）/ })).toBeNull()
    expect(screen.getByText('同じ: 満遍なく（周回）')).toBeTruthy()
  })

  it('selects a card on click and persists it across a reload', () => {
    mockComputeEventCraftPlan.mockReturnValue(
      makePlan([
        makePattern('runs', 'turn', [makeAllocation(recipeA, 1)]),
        makePattern('ap', 'ap', [makeAllocation(recipeB, 1)]),
      ]),
    )
    const { unmount } = render(<EventCraftAdvisor items={items} fullNeed={{}} />)

    const apRadio = screen.getByRole('radio', { name: /APを減らす/ })
    fireEvent.click(apRadio)
    expect(apRadio.getAttribute('aria-checked')).toBe('true')

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENT_CRAFT_ADVISOR) ?? '{}')
    expect(stored.planPattern).toBe('ap')

    unmount()
    render(<EventCraftAdvisor items={items} fullNeed={{}} />)
    expect(screen.getByRole('radio', { name: /APを減らす/ }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('selects the absorbed-into card when the persisted pattern is hidden after folding', () => {
    localStorage.setItem(
      STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
      JSON.stringify({
        ingredients: { seafood: 10, meat: 10, vegetable: 10 },
        planPattern: 'even-turn',
      }),
    )
    mockComputeEventCraftPlan.mockReturnValue(
      makePlan(
        [
          makePattern('runs', 'turn', [makeAllocation(recipeA, 1)], ['even-turn']),
          makePattern('exhaust', 'both', [makeAllocation(recipeA, 1)]),
        ],
        { 'even-turn': 'runs' },
      ),
    )
    render(<EventCraftAdvisor items={items} fullNeed={{}} />)

    expect(screen.getByRole('radio', { name: /周回を減らす/ }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })
})

describe('migrateEventCraftConfig', () => {
  const ingredients = { seafood: 1, meat: 2, vegetable: 3 }

  it('keeps a valid persisted planPattern', () => {
    expect(migrateEventCraftConfig({ ingredients, planPattern: 'exhaust' })).toEqual({
      ingredients,
      planPattern: 'exhaust',
    })
  })

  it('migrates legacy exhaustIngredients=true to the exhaust pattern', () => {
    expect(migrateEventCraftConfig({ ingredients, exhaustIngredients: true })).toEqual({
      ingredients,
      planPattern: 'exhaust',
    })
  })

  it('migrates legacy exhaustIngredients=false to the runs pattern', () => {
    expect(migrateEventCraftConfig({ ingredients, exhaustIngredients: false })).toEqual({
      ingredients,
      planPattern: 'runs',
    })
  })

  it('defaults to runs when neither planPattern nor legacy flag is present', () => {
    expect(migrateEventCraftConfig({ ingredients })).toEqual({
      ingredients,
      planPattern: 'runs',
    })
  })

  it('defaults to runs for a garbage input', () => {
    expect(migrateEventCraftConfig(null)).toEqual({
      ingredients: { seafood: 0, meat: 0, vegetable: 0 },
      planPattern: 'runs',
    })
  })
})

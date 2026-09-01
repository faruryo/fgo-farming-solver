import { describe, expect, it } from 'vitest'
import {
  EVENT_CRAFT_FEATURED_YIELD,
  EVENT_CRAFT_RECIPES_2026,
  EVENT_INGREDIENTS,
  EventCraftRecipe,
  getEventCraftDishIconUrl,
  getEventItemIconUrl,
  getRecipeYields,
  otherMaterialYield,
  sumExpectedCraftYields,
} from './event-craft-recipes'

const recipeById = (id: string): EventCraftRecipe => {
  const recipe = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === id)
  if (!recipe) {
    throw new Error(`missing recipe ${id}`)
  }
  return recipe
}

describe('event craft expected yields', () => {
  it('derives 0.40 featured and even remainder (bronze/silver 0.15, gold 0.12)', () => {
    expect(EVENT_CRAFT_FEATURED_YIELD).toBeCloseTo(0.4)
    expect(otherMaterialYield('bronze')).toBeCloseTo(0.15)
    expect(otherMaterialYield('silver')).toBeCloseTo(0.15)
    expect(otherMaterialYield('gold')).toBeCloseTo(0.12)
  })

  it('gives a gold dish 0.12 to each of the other three gold materials', () => {
    const yields = getRecipeYields(recipeById('hijah-soup'))
    expect(yields['25']).toBeCloseTo(0.4)
    expect(yields['29']).toBeCloseTo(0.12)
    expect(yields['2h']).toBeCloseTo(0.12)
    expect(yields['21']).toBeCloseTo(0.12)
  })

  it('gives a bronze dish 0.15 to each of the other three bronze materials', () => {
    const andagi = recipeById('skull-andagi')
    const yields = getRecipeYields(andagi)
    expect(yields['01']).toBeCloseTo(0.4)
    expect(yields['07']).toBeCloseTo(0.15)
    expect(yields['04']).toBeCloseTo(0.15)
    expect(yields['0d']).toBeCloseTo(0.15)
    expect(Object.keys(yields)).toHaveLength(4)
  })

  it('uses the recipe yieldCount for the featured material when callers pass custom recipes', () => {
    const custom = { ...recipeById('skull-andagi'), yieldCount: 1 }
    const yields = getRecipeYields(custom, [custom])
    expect(yields[custom.targetItem.shortId]).toBeCloseTo(1)
  })

  it('sums recommended dish counts without overwriting overlapping yields', () => {
    const andagi = recipeById('skull-andagi')
    const steak = recipeById('steak')
    const totals = sumExpectedCraftYields([
      { recipe: andagi, totalCount: 2 },
      { recipe: steak, totalCount: 3 },
    ])
    const byId = Object.fromEntries(totals.map((e) => [e.shortId, e.amount]))
    expect(byId['01']).toBeCloseTo(2 * 0.4 + 3 * 0.15)
    expect(byId['0d']).toBeCloseTo(2 * 0.15 + 3 * 0.4)
    expect(totals.every((e) => e.amount > 0)).toBe(true)
  })

  it('provides iconUrl and atlasId for all event ingredients', () => {
    expect(EVENT_INGREDIENTS).toHaveLength(3)
    for (const ing of EVENT_INGREDIENTS) {
      expect(ing.atlasId).toBeGreaterThan(0)
      expect(ing.iconUrl).toMatch(
        /^https:\/\/static\.atlasacademy\.io\/JP\/Items\/\d+\.png$/,
      )
    }
  })

  it('provides iconUrl for all 12 recipes in 2026 master data', () => {
    expect(EVENT_CRAFT_RECIPES_2026).toHaveLength(12)
    for (const recipe of EVENT_CRAFT_RECIPES_2026) {
      expect(recipe.iconUrl).toMatch(
        /^https:\/\/static\.atlasacademy\.io\/JP\/EventUI\/Prefabs\/80614\/icon_\d+\.png$/,
      )
    }
  })

  it('generates expected item and dish icon URLs with helper functions', () => {
    expect(getEventItemIconUrl(94159005)).toBe(
      'https://static.atlasacademy.io/JP/Items/94159005.png',
    )
    expect(getEventCraftDishIconUrl(80614, 1)).toBe(
      'https://static.atlasacademy.io/JP/EventUI/Prefabs/80614/icon_8061401.png',
    )
    expect(getEventCraftDishIconUrl(80614, 12)).toBe(
      'https://static.atlasacademy.io/JP/EventUI/Prefabs/80614/icon_8061412.png',
    )
  })
})

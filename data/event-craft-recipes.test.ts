import { describe, expect, it } from 'vitest'
import {
  EVENT_CRAFT_FEATURED_YIELD,
  EVENT_CRAFT_RECIPES_2026,
  getRecipeYields,
  otherMaterialYield,
  sumExpectedCraftYields,
} from './event-craft-recipes'

describe('event craft expected yields', () => {
  it('derives 0.40 featured and even remainder (bronze/silver 0.15, gold 0.12)', () => {
    expect(EVENT_CRAFT_FEATURED_YIELD).toBe(0.4)
    expect(otherMaterialYield('bronze')).toBeCloseTo(0.15)
    expect(otherMaterialYield('silver')).toBeCloseTo(0.15)
    expect(otherMaterialYield('gold')).toBeCloseTo(0.12)
  })

  it('gives a gold dish 0.12 to each of the other three gold materials', () => {
    const soup = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === 'hijah-soup')!
    const yields = getRecipeYields(soup)
    expect(yields['25']).toBeCloseTo(0.4)
    expect(yields['29']).toBeCloseTo(0.12)
    expect(yields['2h']).toBeCloseTo(0.12)
    expect(yields['21']).toBeCloseTo(0.12)
  })

  it('gives a bronze dish 0.15 to each of the other three bronze materials', () => {
    const andagi = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === 'skull-andagi')
    expect(andagi).toBeDefined()
    const yields = getRecipeYields(andagi!)
    expect(yields['01']).toBeCloseTo(0.4)
    expect(yields['07']).toBeCloseTo(0.15)
    expect(yields['04']).toBeCloseTo(0.15)
    expect(yields['0d']).toBeCloseTo(0.15)
    expect(Object.keys(yields)).toHaveLength(4)
  })

  it('uses the recipe yieldCount for the featured material when callers pass custom recipes', () => {
    const andagi = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === 'skull-andagi')!
    const custom = { ...andagi, yieldCount: 1 }
    const yields = getRecipeYields(custom, [custom])
    expect(yields[custom.targetItem.shortId]).toBe(1)
  })

  it('sums recommended dish counts without overwriting overlapping yields', () => {
    const andagi = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === 'skull-andagi')!
    const steak = EVENT_CRAFT_RECIPES_2026.find((r) => r.id === 'steak')!
    const totals = sumExpectedCraftYields([
      { recipe: andagi, totalCount: 2 },
      { recipe: steak, totalCount: 3 },
    ])
    const byId = Object.fromEntries(totals.map((e) => [e.shortId, e.amount]))
    // 凶骨: 2*0.40 + 3*0.15 ; 狂気の残滓: 2*0.15 + 3*0.40
    expect(byId['01']).toBeCloseTo(2 * 0.4 + 3 * 0.15)
    expect(byId['0d']).toBeCloseTo(2 * 0.15 + 3 * 0.4)
    expect(totals.every((e) => e.amount > 0)).toBe(true)
  })
})

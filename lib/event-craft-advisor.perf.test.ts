import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  computeEventCraftPlan,
  solveEventCraftAllocation,
} from './event-craft-advisor'
import type { Drops } from './get-drops'
import type { IngredientCounts } from '../data/event-craft-recipes'

describe('event-craft allocation user-story scale', () => {
  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'mocks', 'all.json'), 'utf8'),
  ) as Drops
  const drops: Drops = {
    items: raw.items,
    quests: raw.quests,
    drop_rates: raw.drop_rates,
    campaigns: raw.campaigns ?? [],
  }
  const questIds = drops.quests.map((q) => q.id)
  const uniqueItemIds = Array.from(
    new Set(drops.drop_rates.map((dr) => dr.item_id)),
  )
  const fullNeed: Record<string, number> = Object.fromEntries(
    uniqueItemIds.map((id) => [id, 1000]),
  )
  const owned: IngredientCounts = {
    seafood: 100_000,
    meat: 100_000,
    vegetable: 100_000,
  }

  it('completes within 10s for catalog-wide need=1000 and 100k ingredients', () => {
    solveEventCraftAllocation(drops, fullNeed, owned, 'turn', questIds)
    const times: number[] = []
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now()
      const res = solveEventCraftAllocation(
        drops,
        fullNeed,
        owned,
        'turn',
        questIds,
      )
      times.push(performance.now() - t0)
      expect(res.totalCrafted).toBeGreaterThan(0)
    }
    times.sort((a, b) => a - b)
    expect(times[1]).toBeLessThan(10_000)
  })

  it('computes all plan patterns within 500ms without exhaust MILP', () => {
    computeEventCraftPlan(drops, fullNeed, owned, questIds)
    const times: number[] = []
    for (let i = 0; i < 3; i++) {
      const startedAt = performance.now()
      const plan = computeEventCraftPlan(drops, fullNeed, owned, questIds)
      times.push(performance.now() - startedAt)
      expect(plan.patterns.some((pattern) => pattern.id === 'runs')).toBe(true)
      for (const pattern of plan.patterns) {
        expect(['runs', 'ap', 'even-turn', 'even-ap']).toContain(pattern.id)
      }
    }
    times.sort((a, b) => a - b)
    expect(times[1]).toBeLessThan(500)
  })
})

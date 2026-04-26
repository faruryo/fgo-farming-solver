import { describe, it, expect } from 'vitest'
import { solve } from './solver'
import { Drops } from './get-drops'
import { Params } from '../interfaces/api'
import { performance } from 'perf_hooks'

describe('Solver Performance and Correctness', () => {
  const generateMockDrops = (): Drops => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `${6000 + i}`,
      name: `Material ${i}`,
      category: i < 50 ? 'bronze' : i < 100 ? 'silver' : i < 150 ? 'gold' : 'skill'
    }))

    const quests = Array.from({ length: 1000 }, (_, i) => ({
      id: `quest_${i}`,
      name: `Quest ${i}`,
      area: `Area ${Math.floor(i / 100)}`,
      section: 'Story',
      ap: 10 + (i % 31)
    }))

    const drop_rates = []
    for (let q = 0; q < 1000; q++) {
      const numDrops = 3 + (q % 6)
      for (let d = 0; d < numDrops; d++) {
        const itemIdx = (q + d * 13) % 200
        drop_rates.push({
          quest_id: `quest_${q}`,
          item_id: items[itemIdx].id,
          drop_rate: 0.05 + (Math.random() * 0.45),
        })
      }
    }

    return { items, quests, drop_rates } as unknown as Drops
  }

  const drops = generateMockDrops()
  const allQuestIds = drops.quests.map(q => q.id)

  it('should handle standard optimization for 1000 quests', () => {
    const params: Params = {
      objective: 'ap',
      items: { '6001': 10, '6050': 20, '6150': 5 },
      quests: allQuestIds,
    }

    const start = performance.now()
    const result = solve(drops, params)
    const duration = performance.now() - start

    console.log(`Standard solver execution time: ${duration.toFixed(2)}ms`)
    expect(duration).toBeLessThan(500)
    expect(result.quests.length).toBeGreaterThan(0)
  })

  it('should handle heavy stress test with 30 items requested simultaneously', () => {
    const targetItems: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      targetItems[`${6000 + (i * 6) % 200}`] = 30
    }

    const params: Params = {
      objective: 'lap',
      items: targetItems,
      quests: allQuestIds,
    }

    const start = performance.now()
    const result = solve(drops, params)
    const duration = performance.now() - start

    console.log(`Stress test (30 items) execution time: ${duration.toFixed(2)}ms`)
    expect(duration).toBeLessThan(200)
    expect(result.quests.length).toBeGreaterThan(0)
  })

  it('should verify accuracy: total obtained >= requested', () => {
    const params: Params = {
      objective: 'ap',
      items: { '6010': 100, '6020': 50 },
      quests: allQuestIds,
    }

    const result = solve(drops, params)
    expect(result.quests.length).toBeGreaterThan(0)

    const item10 = result.items.find(i => i.id === '6010')
    expect(item10!.count).toBeGreaterThanOrEqual(100 - 1e-5)

    const item20 = result.items.find(i => i.id === '6020')
    expect(item20!.count).toBeGreaterThanOrEqual(50 - 1e-5)
  })

  it('should skip items with no drop data instead of returning infeasible', () => {
    const params: Params = {
      objective: 'ap',
      items: { '6001': 10, 'unknown_item': 99 },
      quests: allQuestIds,
    }

    const result = solve(drops, params)
    expect(result.quests.length).toBeGreaterThan(0)
    expect(result.skipped_items).toContain('unknown_item')
    expect(result.skipped_items).not.toContain('6001')
  })
})

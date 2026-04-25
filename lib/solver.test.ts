import { describe, it, expect } from 'vitest'
import { solve } from './solver'
import { Drops } from './get-drops'
import { Params } from '../interfaces/api'
import { performance } from 'perf_hooks'

describe('Solver Performance and Correctness', () => {
  // Generate a massive dataset with 1000 quests and 200 items
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
      ap: 10 + (i % 31) // 10-40 AP
    }))

    const drop_rates = []
    for (let q = 0; q < 1000; q++) {
      // Each quest drops 3-8 random items (higher density for stress test)
      const numDrops = 3 + (q % 6)
      for (let d = 0; d < numDrops; d++) {
        // Distribute items across quests
        const itemIdx = (q + d * 13) % 200
        drop_rates.push({
          quest_id: `quest_${q}`,
          item_id: items[itemIdx].id,
          drop_rate_1: 0.05 + (Math.random() * 0.45), // 5-50%
          drop_rate_2: 0
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
      items: {
        '6001': 10,
        '6050': 20,
        '6150': 5,
      },
      quests: allQuestIds,
    }

    const start = performance.now()
    const result = solve(drops, params, 'add')
    const end = performance.now()
    const duration = end - start

    console.log(`Standard solver execution time: ${duration.toFixed(2)}ms for 1000 quests`)
    
    expect(duration).toBeLessThan(500)
    expect(result.quests.length).toBeGreaterThan(0)
  })

  it('should handle heavy stress test with 30 items requested simultaneously', () => {
    const targetItems: Record<string, number> = {}
    // Select 30 items across all categories
    for (let i = 0; i < 30; i++) {
      targetItems[`${6000 + (i * 6) % 200}`] = 30
    }

    const params: Params = {
      objective: 'lap',
      items: targetItems,
      quests: allQuestIds,
    }

    const start = performance.now()
    const result = solve(drops, params, 'add')
    const end = performance.now()
    const duration = end - start

    console.log(`Stress test (30 items) execution time: ${duration.toFixed(2)}ms`)
    
    expect(duration).toBeLessThan(200) // 200ms for extreme cases
    expect(result.quests.length).toBeGreaterThan(0)
  })

  it('should return results with drop_merge_method=2 even when drop_rate_2 is always 0', () => {
    // Regression test: drop_rate_2 is always 0 in current data source.
    // Method '2' must fall back to drop_rate_1 rather than leaving all rates at 0.
    const params: Params = {
      objective: 'ap',
      items: { '6001': 10 },
      quests: allQuestIds,
    }

    const result = solve(drops, params, '2')

    expect(result.quests.length).toBeGreaterThan(0)
    expect(result.items.find(i => i.id === '6001')!.count).toBeGreaterThanOrEqual(10 - 1e-5)
  })

  it('should use drop_rate_2 when it is non-zero with method=2', () => {
    const specialDrops: Drops = {
      items: [{ id: 'item1', name: 'Item 1', category: 'material' }],
      quests: [{ id: 'q1', name: 'Quest 1', area: 'Area', section: 'Free', ap: 20, samples_1: 100, samples_2: 0 }],
      drop_rates: [{ quest_id: 'q1', item_id: 'item1', drop_rate_1: 0.1, drop_rate_2: 0.5 }],
    }

    const params: Params = {
      objective: 'ap',
      items: { 'item1': 5 },
      quests: ['q1'],
    }

    const result2 = solve(specialDrops, params, '2')
    const result1 = solve(specialDrops, params, '1')

    // method='2' uses drop_rate_2=0.5, needs 10 laps; method='1' uses drop_rate_1=0.1, needs 50 laps
    expect(result2.quests[0].lap).toBeLessThan(result1.quests[0].lap)
  })

  it('should verify accuracy: total obtained >= requested', () => {
    const params: Params = {
      objective: 'ap',
      items: {
        '6010': 100,
        '6020': 50,
      },
      quests: allQuestIds,
    }

    const result = solve(drops, params, 'add')
    
    expect(result.quests.length).toBeGreaterThan(0)
    
    // Check item 6010 (allowing small floating point error)
    const item10 = result.items.find(i => i.id === '6010')
    expect(item10!.count).toBeGreaterThanOrEqual(100 - 1e-5)
    
    // Check item 6020
    const item20 = result.items.find(i => i.id === '6020')
    expect(item20!.count).toBeGreaterThanOrEqual(50 - 1e-5)
  })
})

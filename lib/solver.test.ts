import { describe, it, expect } from 'vitest'
import { solve, solveBoth, computeEffectiveAp, filterActiveCampaigns } from './solver'
import { Drops } from './get-drops'
import { Params } from '../interfaces/api'
import { Campaign } from '../interfaces/fgodrop'
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
    expect(duration).toBeLessThan(500)
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

describe('computeEffectiveAp', () => {
  const campaigns: Campaign[] = [
    { id: 1, calcType: 'multiplication', value: 500, validFrom: 0, validTo: 1, questIds: ['q1'] },
    { id: 2, calcType: 'fixedValue',     value: 0,   validFrom: 0, validTo: 1, questIds: ['q2'] },
    { id: 3, calcType: 'multiplication', value: 334, validFrom: 0, validTo: 1, questIds: ['q3'] },
    { id: 4, calcType: 'addition',       value: 5,   validFrom: 0, validTo: 1, questIds: ['q4'] },
  ]

  it('applies multiplication via value/1000', () => {
    expect(computeEffectiveAp(40, 'q1', campaigns)).toBe(20)  // 50%DOWN
    expect(computeEffectiveAp(30, 'q3', campaigns)).toBe(10)  // 66%DOWN → 30 × 0.334 ≈ 10
  })

  it('applies fixedValue as the AP', () => {
    expect(computeEffectiveAp(40, 'q2', campaigns)).toBe(0)
  })

  it('returns original AP when no campaign matches', () => {
    expect(computeEffectiveAp(40, 'qz', campaigns)).toBe(40)
  })

  it('ignores unsupported calcType (addition / none / unknown)', () => {
    expect(computeEffectiveAp(40, 'q4', campaigns)).toBe(40)
  })

  it('picks the smallest result when multiple campaigns overlap', () => {
    const overlapping: Campaign[] = [
      { id: 10, calcType: 'multiplication', value: 500, validFrom: 0, validTo: 1, questIds: ['x'] },
      { id: 11, calcType: 'multiplication', value: 250, validFrom: 0, validTo: 1, questIds: ['x'] },
    ]
    expect(computeEffectiveAp(40, 'x', overlapping)).toBe(10)  // ×0.25 wins
  })
})

describe('filterActiveCampaigns', () => {
  const campaigns: Campaign[] = [
    { id: 1, calcType: 'multiplication', value: 500, validFrom: 100, validTo: 200, questIds: [] },
    { id: 2, calcType: 'multiplication', value: 500, validFrom: 300, validTo: 400, questIds: [] },
  ]
  it('returns campaigns covering the timestamp', () => {
    expect(filterActiveCampaigns(campaigns, 150).map(c => c.id)).toEqual([1])
    expect(filterActiveCampaigns(campaigns, 350).map(c => c.id)).toEqual([2])
  })
  it('returns empty when no campaign is active', () => {
    expect(filterActiveCampaigns(campaigns, 250)).toEqual([])
  })
  it('treats boundaries as inclusive', () => {
    expect(filterActiveCampaigns(campaigns, 100)).toHaveLength(1)
    expect(filterActiveCampaigns(campaigns, 200)).toHaveLength(1)
  })
})

describe('solver applyCampaigns option', () => {
  const buildDrops = (): Drops => {
    const items = [
      { id: 'a', name: 'A', category: 'bronze' },
      { id: 'b', name: 'B', category: 'bronze' },
    ]
    const quests = [
      { id: 'cheap', section: 'Free', area: 'X', name: 'cheap quest', ap: 40 },
      { id: 'fancy', section: 'Free', area: 'X', name: 'fancy quest', ap: 50 },
    ]
    // cheap drops a@0.5 only. fancy drops a@0.4 and b@0.5.
    const drop_rates = [
      { quest_id: 'cheap', item_id: 'a', drop_rate: 0.5 },
      { quest_id: 'fancy', item_id: 'a', drop_rate: 0.4 },
      { quest_id: 'fancy', item_id: 'b', drop_rate: 0.5 },
    ]
    return { items, quests, drop_rates, campaigns: [] } as unknown as Drops
  }

  const baseParams: Params = {
    objective: 'ap',
    items: { a: 10, b: 5 },
    quests: ['cheap', 'fancy'],
  }

  it('falls back to nominal AP when options omitted (existing call sites unchanged)', () => {
    const drops = buildDrops()
    const r1 = solve(drops, baseParams)
    const r2 = solve(drops, baseParams, { applyCampaigns: false })
    expect(r1.total_ap).toBe(r2.total_ap)
    expect(r1.quests.find(q => q.id === 'cheap')?.ap).toBe(40)
    expect(r1.quests.find(q => q.id === 'fancy')?.ap).toBe(50)
  })

  it('returns identical result when applyCampaigns=true but no campaigns are active', () => {
    const drops = buildDrops()
    drops.campaigns = [
      // expired
      { id: 1, calcType: 'multiplication', value: 500, validFrom: 0, validTo: 1, questIds: ['cheap'] },
    ]
    const nominal = solve(drops, baseParams, { applyCampaigns: false })
    const effective = solve(drops, baseParams, { applyCampaigns: true, nowSec: 100 })
    expect(effective.total_ap).toBe(nominal.total_ap)
    expect(effective.quests.find(q => q.id === 'cheap')?.ap).toBe(40)
  })

  it('reduces displayed AP and total_ap when applyCampaigns=true with active multiplication campaign', () => {
    const drops = buildDrops()
    drops.campaigns = [
      { id: 1, calcType: 'multiplication', value: 500, validFrom: 0, validTo: 1000, questIds: ['cheap'] },
    ]
    const effective = solve(drops, baseParams, { applyCampaigns: true, nowSec: 500 })
    const cheap = effective.quests.find(q => q.id === 'cheap')
    expect(cheap?.ap).toBe(20)  // 40 × 0.5
    // fancy unaffected
    expect(effective.quests.find(q => q.id === 'fancy')?.ap).toBe(50)
  })

  it('applyCampaigns can change the optimal quest mix when AP objective is used', () => {
    const drops = buildDrops()
    // Make fancy drastically cheaper under campaign → it should now be preferred
    // for obtaining item a despite lower drop rate (because effective ap-per-drop wins)
    drops.campaigns = [
      { id: 1, calcType: 'fixedValue', value: 1, validFrom: 0, validTo: 1000, questIds: ['fancy'] },
    ]
    const apParams: Params = { ...baseParams, items: { a: 10 } }
    const nominal = solve(drops, apParams, { applyCampaigns: false })
    const effective = solve(drops, apParams, { applyCampaigns: true, nowSec: 500 })
    const nominalCheapLap = nominal.quests.find(q => q.id === 'cheap')?.lap ?? 0
    const effectiveFancyLap = effective.quests.find(q => q.id === 'fancy')?.lap ?? 0
    expect(nominalCheapLap).toBeGreaterThan(0)
    expect(effectiveFancyLap).toBeGreaterThan(0)
    expect(effective.total_ap).toBeLessThan(nominal.total_ap)
  })

  it('solveBoth threads options through to both objectives', () => {
    const drops = buildDrops()
    drops.campaigns = [
      { id: 1, calcType: 'multiplication', value: 500, validFrom: 0, validTo: 1000, questIds: ['cheap', 'fancy'] },
    ]
    const both = solveBoth(drops, baseParams, { applyCampaigns: true, nowSec: 500 })
    expect(both.ap.quests.find(q => q.id === 'cheap')?.ap).toBe(20)
    expect(both.lap.quests.find(q => q.id === 'fancy')?.ap).toBe(25)
  })
})

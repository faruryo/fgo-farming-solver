import { describe, it, expect } from 'vitest'
import { performance } from 'perf_hooks'
import fs from 'fs'
import path from 'path'
import { solve } from './solver'
import type { Drops } from './get-drops'
import type { Params } from '../interfaces/api'

// Regression benchmarks for the solver.
//
// Observed reference (M1 MacBook, Node 22, vitest, real mocks/all.json
// — 297 quests / 1954 drop_rates):
//   small (3 items):    ~4ms
//   medium (10 items):  ~4-5ms
//   large (30 items):   ~10-12ms
//   xl (60 items):      ~20ms
//   lap obj (30 items): ~4ms
//
// CI environments are typically slower and noisier than the reference
// machine. Thresholds are set to ~5× the reference median so the suite
// catches gross regressions (an O(n²)-introducing change, a hidden JSON
// re-parse, etc.) without flaking on slow runners. Tighten if the suite
// stays comfortably below limits on the standard CI runner.
const SLOW_FACTOR = 5
const THRESHOLDS = {
  small: 5 * SLOW_FACTOR,    // ~25ms
  medium: 6 * SLOW_FACTOR,   // ~30ms
  large: 12 * SLOW_FACTOR,   // ~60ms
  xl: 25 * SLOW_FACTOR,      // ~125ms
  lapObj: 5 * SLOW_FACTOR,   // ~25ms
  jsonParse: 2 * SLOW_FACTOR // ~10ms
} as const

describe('Solver perf with real mock data', () => {
  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'mocks', 'all.json'), 'utf8')
  )
  const drops: Drops = {
    items: raw.items,
    quests: raw.quests,
    drop_rates: raw.drop_rates,
    campaigns: raw.campaigns ?? [],
  }
  const allQuestIds = drops.quests.map((q: any) => q.id)

  const measure = (label: string, fn: () => unknown, runs = 10) => {
    fn()
    const times: number[] = []
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now()
      fn()
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    const min = times[0]
    const median = times[Math.floor(runs / 2)]
    const max = times[runs - 1]
    console.log(
      `${label}: min=${min.toFixed(2)}ms median=${median.toFixed(2)}ms max=${max.toFixed(2)}ms`
    )
    return { min, median, max }
  }

  it('small target (3 items)', () => {
    const params: Params = {
      objective: 'ap',
      items: { '6001': 30, '6101': 10, '7001': 5 },
      quests: allQuestIds,
    } as any
    // pick first 3 valid items
    const validIds = Array.from(
      new Set(drops.drop_rates.map((dr) => dr.item_id))
    ).slice(0, 3)
    params.items = Object.fromEntries(validIds.map((id, i) => [id, [30, 10, 5][i]]))
    const { median } = measure('small (3 items)', () => solve(drops, params))
    expect(median).toBeLessThan(THRESHOLDS.small)
  })

  it('medium target (10 items)', () => {
    const validIds = Array.from(
      new Set(drops.drop_rates.map((dr) => dr.item_id))
    ).slice(0, 10)
    const params: Params = {
      objective: 'ap',
      items: Object.fromEntries(validIds.map((id) => [id, 20])),
      quests: allQuestIds,
    } as any
    const { median } = measure('medium (10 items)', () => solve(drops, params))
    expect(median).toBeLessThan(THRESHOLDS.medium)
  })

  it('large target (30 items)', () => {
    const validIds = Array.from(
      new Set(drops.drop_rates.map((dr) => dr.item_id))
    ).slice(0, 30)
    const params: Params = {
      objective: 'ap',
      items: Object.fromEntries(validIds.map((id) => [id, 30])),
      quests: allQuestIds,
    } as any
    const { median } = measure('large (30 items)', () => solve(drops, params))
    expect(median).toBeLessThan(THRESHOLDS.large)
  })

  it('xl target (60 items - typical full grind plan)', () => {
    const validIds = Array.from(
      new Set(drops.drop_rates.map((dr) => dr.item_id))
    ).slice(0, 60)
    const params: Params = {
      objective: 'ap',
      items: Object.fromEntries(validIds.map((id) => [id, 50])),
      quests: allQuestIds,
    } as any
    const { median } = measure('xl (60 items)', () => solve(drops, params))
    expect(median).toBeLessThan(THRESHOLDS.xl)
  })

  it('lap objective with large target', () => {
    const validIds = Array.from(
      new Set(drops.drop_rates.map((dr) => dr.item_id))
    ).slice(0, 30)
    const params: Params = {
      objective: 'lap',
      items: Object.fromEntries(validIds.map((id) => [id, 30])),
      quests: allQuestIds,
    } as any
    const { median } = measure('lap obj (30 items)', () => solve(drops, params))
    expect(median).toBeLessThan(THRESHOLDS.lapObj)
  })

  it('JSON.parse cost for drops payload', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'mocks', 'all.json'), 'utf8')
    console.log(`drops payload size: ${(text.length / 1024).toFixed(1)} KB`)
    const { median } = measure('JSON.parse(drops)', () => JSON.parse(text), 20)
    expect(median).toBeLessThan(THRESHOLDS.jsonParse)
  })
})

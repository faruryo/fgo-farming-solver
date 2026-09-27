import { describe, expect, it } from 'vitest'
import type { Result } from '../../interfaces/api'
import { plannedLapsByQuest, splitByPlan } from './plan'

const result = (laps: Record<string, number>): Result => ({
  params: { objective: 'ap', items: {}, quests: [] },
  quests: Object.entries(laps).map(([id, lap]) => ({ id, section: '', area: '', name: '', ap: 40, lap })),
  items: [],
  drop_rates: [],
  total_lap: 0,
  total_ap: 0,
})

describe('plannedLapsByQuest', () => {
  it('結果がない・空なら空', () => {
    expect(plannedLapsByQuest(null).size).toBe(0)
    expect(plannedLapsByQuest(undefined).size).toBe(0)
    expect(plannedLapsByQuest(result({})).size).toBe(0)
  })
  it('Result からクエストごとの周回数を取る', () => {
    expect([...plannedLapsByQuest(result({ a: 60, b: 3 }))]).toEqual([['a', 60], ['b', 3]])
  })
  it('BothResult は周回数側を使う', () => {
    const map = plannedLapsByQuest({ ap: result({ a: 10 }), lap: result({ a: 7 }) })
    expect(map.get('a')).toBe(7)
  })
})

describe('splitByPlan', () => {
  const base = { runs: 0, teapotRuns: 0, perRun: 1000, remaining: 0 }
  it('予定なし・0周は null', () => {
    expect(splitByPlan({ ...base, runs: 5, remaining: 5000 }, undefined)).toBeNull()
    expect(splitByPlan({ ...base, runs: 5, remaining: 5000 }, 0)).toBeNull()
  })
  it('残り < N は予定内で達成', () => {
    expect(splitByPlan({ ...base, runs: 80, remaining: 80_000 }, 100)).toEqual({
      planned: 100, inPlanRuns: 80, inPlanBond: 80_000, overRuns: 0, achieved: true,
    })
  })
  it('残り == N は予定内で達成', () => {
    expect(splitByPlan({ ...base, runs: 100, remaining: 99_500 }, 100)).toMatchObject({
      inPlanRuns: 100, inPlanBond: 99_500, overRuns: 0, achieved: true,
    })
  })
  it('残り > N は予定超過を分ける', () => {
    expect(splitByPlan({ ...base, runs: 150, remaining: 150_000 }, 100)).toMatchObject({
      inPlanRuns: 100, inPlanBond: 100_000, overRuns: 50, achieved: false,
    })
  })
  it('ティーポット周回を予定内に先に充てる', () => {
    expect(splitByPlan({ runs: 12, teapotRuns: 5, perRun: 1000, remaining: 17_000 }, 10)).toMatchObject({
      inPlanRuns: 10, inPlanBond: 15_000, overRuns: 2,
    })
  })
})

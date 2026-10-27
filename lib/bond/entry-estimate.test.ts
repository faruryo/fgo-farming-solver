import { describe, expect, it } from 'vitest'
import type { Quest } from '../../interfaces/fgodrop'
import { estimateEntry } from './entry-estimate'
import { bondQuestCandidates } from './quest-candidates'
import type { BondTrackerEntry } from './state'

const GROWTH = [
  3000, 9125, 15250, 21375, 27500, 310000, 610000, 930000, 1270000, 1640000, 2730000, 3960000,
  5320000, 6820000, 8460000, 13460000,
]
const QUESTS: Quest[] = [
  { id: 'grand', section: 'Free', area: '冠位研鑽戦', name: '〔キャスター〕 Ⅶ', ap: 40, bondPoints: 4748 },
  { id: 'ordeal', section: 'Free', area: 'オーディール・コール', name: '月光採掘場', ap: 40, bondPoints: 3797 },
]
const questsById = new Map(QUESTS.map(q => [q.id, q]))
const candidates = bondQuestCandidates(QUESTS, [], 'caster')
const ENTRY: BondTrackerEntry = {
  servantId: 1,
  questId: 'ordeal',
  currentLevel: 14,
  remainingToNext: 100000,
  targetLevel: 15,
  observedPerRun: 5240,
  observedTeapotRun: false,
  measuredQuestId: 'ordeal',
}
const run = (entry: Partial<BondTrackerEntry>, growth: number[] | undefined = GROWTH, teapotStock: number | null = null) =>
  estimateEntry({ entry: { ...ENTRY, ...entry }, growth, candidates, questsById, teapotStock })

describe('estimateEntry', () => {
  it('estimates runs, AP and pods on the measured quest', () => {
    expect(run({}).result).toMatchObject({
      remaining: 100000,
      perRun: 5240,
      estimated: false,
      runs: { runs: 20, runsWithoutTeapot: 20, teapotRuns: 0 },
      ap: 800,
      pods: 20,
    })
  })

  it('converts to another quest and marks the value as estimated', () => {
    expect(run({ questId: 'grand' }).result).toMatchObject({ perRun: 6552, estimated: true, measuredQuest: QUESTS[1] })
  })

  it('applies teapot stock', () => {
    expect(run({}, GROWTH, 5).result?.runs).toEqual({ runs: 15, runsWithoutTeapot: 20, teapotRuns: 5 })
  })

  it('hides the estimate on an out-of-range field even when observedPerRun is unset', () => {
    const estimate = run({ remainingToNext: 2000000, observedPerRun: 0 })
    expect(estimate.result).toBeNull()
    expect(estimate.errors).toEqual([{ kind: 'range', field: 'remainingToNext', min: 1, max: 1640000 }])
  })

  it('reports missing bond data', () => {
    expect(estimateEntry({ entry: ENTRY, growth: undefined, candidates, questsById, teapotStock: null }).errors).toEqual([{ kind: 'no-bond-data' }])
  })

  it('falls back to the quest base when unmeasured (observedPerRun 0)', () => {
    expect(run({ observedPerRun: 0 }).result).toMatchObject({ perRun: 3797, estimated: true, basis: 'base' })
  })

  it('follows the newly selected quest base while unmeasured', () => {
    expect(run({ observedPerRun: 0, questId: 'grand', measuredQuestId: 'ordeal' }).result).toMatchObject({
      perRun: 4748,
      estimated: true,
      basis: 'base',
    })
  })

  it('falls back to the quest base when the measured quest disappeared instead of blocking', () => {
    const estimate = run({ measuredQuestId: 'gone' })
    expect(estimate.errors).toEqual([])
    expect(estimate.result).toMatchObject({ perRun: 3797, estimated: true, basis: 'base' })
  })

  it('moves a quest that is no longer a candidate to the first confirmed candidate', () => {
    expect(run({ questId: 'saber-only', measuredQuestId: 'grand' }).entry.questId).toBe('grand')
  })
})

describe('estimateEntry during a pod-free period', () => {
  const DAY = 24 * 60 * 60
  const NOW = 1_800_000_000
  // 残り絆 12 × 5,000 を 1周 5,000 で回すと12周
  const entry = { questId: 'grand', measuredQuestId: 'grand', remainingToNext: 60000, observedPerRun: 5000 }
  const runWith = (days: number | null, useApples = false, overrides: Partial<BondTrackerEntry> = entry) =>
    estimateEntry({
      entry: { ...ENTRY, ...overrides },
      growth: GROWTH,
      candidates,
      questsById,
      teapotStock: null,
      podFree: {
        podFreeEndsAt: new Map(days === null ? [] : [[overrides.questId ?? ENTRY.questId, NOW + days * DAY]]),
        nowSec: NOW,
        useApples,
      },
    }).result

  it('is unchanged with an empty input', () => {
    expect(runWith(null)).toEqual(run(entry).result)
    expect(runWith(null)).toMatchObject({ pods: 12, consumesPod: true })
  })

  it.each([
    ['5 days left', 5, 0],
    ['1 day left', 1, 5],
  ])('counts natural AP runs free: %s', (_label, days, pods) => {
    expect(runWith(days)).toMatchObject({ runs: { runs: 12 }, ap: 480, pods, consumesPod: true })
  })

  it('counts every run free when using apples without changing AP', () => {
    expect(runWith(1, true)).toMatchObject({ runs: { runs: 12 }, ap: 480, pods: 0, consumesPod: true })
  })

  it('reports quests that consume no pods', () => {
    const quests: Quest[] = [{ id: 'daily', section: 'Free', area: '修練場（月）', name: '初級', ap: 40, bondPoints: 1000 }]
    expect(
      estimateEntry({
        entry: { ...ENTRY, questId: 'daily', measuredQuestId: 'daily' },
        growth: GROWTH,
        candidates: bondQuestCandidates(quests, [], 'caster'),
        questsById: new Map(quests.map(q => [q.id, q])),
        teapotStock: null,
      }).result,
    ).toMatchObject({ pods: 0, consumesPod: false })
  })
})

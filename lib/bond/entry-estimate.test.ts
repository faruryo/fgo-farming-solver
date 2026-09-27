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

  it('hides the estimate and lists every out-of-range field', () => {
    const estimate = run({ remainingToNext: 2000000, observedPerRun: 0 })
    expect(estimate.result).toBeNull()
    expect(estimate.errors).toEqual([
      { kind: 'range', field: 'remainingToNext', min: 1, max: 1640000 },
      { kind: 'range', field: 'observedPerRun', min: 1 },
    ])
  })

  it('reports missing bond data', () => {
    expect(estimateEntry({ entry: ENTRY, growth: undefined, candidates, questsById, teapotStock: null }).errors).toEqual([{ kind: 'no-bond-data' }])
  })

  it('asks to re-measure when the measured quest disappeared', () => {
    const estimate = run({ measuredQuestId: 'gone' })
    expect(estimate.result).toBeNull()
    expect(estimate.errors).toEqual([{ kind: 'remeasure' }])
  })

  it('moves a quest that is no longer a candidate to the first confirmed candidate', () => {
    expect(run({ questId: 'saber-only', measuredQuestId: 'grand' }).entry.questId).toBe('grand')
  })
})

import { describe, expect, it } from 'vitest'
import { bondIncrement, bondPerRun, estimateRuns, groupByQuest, remainingBond } from './estimate'

// アルトリア・ペンドラゴンの実データ(Lv15→16 が 5,000,000)
const GROWTH = [
  3000, 9125, 15250, 21375, 27500, 310000, 610000, 930000, 1270000, 1640000, 2730000, 3960000,
  5320000, 6820000, 8460000, 13460000,
]

describe('bondIncrement', () => {
  it.each([
    [0, 3000],
    [1, 6125],
    [14, 1640000],
    [15, 5000000],
    [16, null],
    [-1, null],
  ])('Lv%i → next', (level, expected) => {
    expect(bondIncrement(GROWTH, level)).toBe(expected)
  })

  it('returns null without data', () => {
    expect(bondIncrement(undefined, 0)).toBeNull()
  })
})

describe('remainingBond', () => {
  it.each([
    ['target is the next level', { currentLevel: 14, remainingToNext: 100000, targetLevel: 15 }, 100000],
    ['target is several levels ahead', { currentLevel: 14, remainingToNext: 100000, targetLevel: 16 }, 5100000],
    ['from Lv0', { currentLevel: 0, remainingToNext: 1000, targetLevel: 2 }, 1000 + 6125],
    ['remaining equals the whole increment', { currentLevel: 0, remainingToNext: 3000, targetLevel: 1 }, 3000],
  ])('%s', (_label, input, expected) => {
    expect(remainingBond(GROWTH, input)).toEqual({ ok: true, remaining: expected })
  })

  it.each([
    ['remaining above increment', { currentLevel: 14, remainingToNext: 1640001, targetLevel: 15 }, { kind: 'range', field: 'remainingToNext', min: 1, max: 1640000 }],
    ['remaining zero', { currentLevel: 14, remainingToNext: 0, targetLevel: 15 }, { kind: 'range', field: 'remainingToNext', min: 1, max: 1640000 }],
    ['target equals current', { currentLevel: 14, remainingToNext: 1, targetLevel: 14 }, { kind: 'range', field: 'targetLevel', min: 15, max: 16 }],
    ['target above 16', { currentLevel: 14, remainingToNext: 1, targetLevel: 17 }, { kind: 'range', field: 'targetLevel', min: 15, max: 16 }],
    ['current above 15', { currentLevel: 16, remainingToNext: 1, targetLevel: 16 }, { kind: 'range', field: 'currentLevel', min: 0, max: 15 }],
  ])('rejects %s', (_label, input, error) => {
    expect(remainingBond(GROWTH, input)).toEqual({ ok: false, error })
  })

  it.each([
    ['15 elements with target 16', GROWTH.slice(0, 15)],
    ['no data', undefined],
  ])('reports missing bond data: %s', (_label, growth) => {
    expect(remainingBond(growth, { currentLevel: 14, remainingToNext: 100000, targetLevel: 16 })).toEqual({
      ok: false,
      error: { kind: 'no-bond-data' },
    })
  })

  it('accepts 15 elements when the target is 15', () => {
    expect(remainingBond(GROWTH.slice(0, 15), { currentLevel: 14, remainingToNext: 100000, targetLevel: 15 }).ok).toBe(true)
  })
})

describe('bondPerRun', () => {
  const base = { measuredBase: 3797, questBase: 3797, isMeasuredQuest: true }
  it.each([
    ['measured quest', { ...base, observed: 5240, teapotRun: false }, { ok: true, perRun: 5240, estimated: false }],
    ['teapot run is halved', { ...base, observed: 10480, teapotRun: true }, { ok: true, perRun: 5240, estimated: false }],
    ['teapot halving floors', { ...base, observed: 10481, teapotRun: true }, { ok: true, perRun: 5240, estimated: false }],
    ['converted to another quest', { observed: 5240, teapotRun: false, measuredBase: 3797, questBase: 4748, isMeasuredQuest: false }, { ok: true, perRun: 6552, estimated: true }],
    ['teapot halves before conversion', { observed: 10480, teapotRun: true, measuredBase: 3797, questBase: 4748, isMeasuredQuest: false }, { ok: true, perRun: 6552, estimated: true }],
    // 換算→半減の順だと floor(floor(10481*4748/3797)/2) = 6553 になる
    ['halving happens before conversion', { observed: 10481, teapotRun: true, measuredBase: 3797, questBase: 4748, isMeasuredQuest: false }, { ok: true, perRun: 6552, estimated: true }],
    ['different quest with same base is still estimated', { observed: 5240, teapotRun: false, measuredBase: 3797, questBase: 3797, isMeasuredQuest: false }, { ok: true, perRun: 5240, estimated: true }],
  ])('%s', (_label, input, expected) => {
    expect(bondPerRun(input)).toEqual(expected)
  })

  it.each([
    ['1 on a teapot run', { ...base, observed: 1, teapotRun: true }, { kind: 'range', field: 'observedPerRun', min: 2 }],
    ['0 on a normal run', { ...base, observed: 0, teapotRun: false }, { kind: 'range', field: 'observedPerRun', min: 1 }],
    ['missing measured quest', { ...base, observed: 5240, teapotRun: false, measuredBase: undefined }, { kind: 'remeasure' }],
  ])('rejects %s', (_label, input, error) => {
    expect(bondPerRun(input)).toEqual({ ok: false, error })
  })

  it('accepts 1 on a normal run', () => {
    expect(bondPerRun({ ...base, observed: 1, teapotRun: false }).ok).toBe(true)
  })
})

describe('estimateRuns', () => {
  it.each([
    ['rounds up a fraction', 2500, 1200, null, { runs: 3, runsWithoutTeapot: 3, teapotRuns: 0 }],
    ['exact division', 2400, 1200, null, { runs: 2, runsWithoutTeapot: 2, teapotRuns: 0 }],
    ['teapot stock is enough', 4000, 1000, 5, { runs: 2, runsWithoutTeapot: 4, teapotRuns: 2 }],
    ['teapot stock runs out', 5000, 1000, 2, { runs: 3, runsWithoutTeapot: 5, teapotRuns: 2 }],
    ['last teapot run overshoots', 4500, 1000, 5, { runs: 3, runsWithoutTeapot: 5, teapotRuns: 3 }],
    ['zero stock', 5000, 1000, 0, { runs: 5, runsWithoutTeapot: 5, teapotRuns: 0 }],
    ['nothing remaining', 0, 1000, 5, { runs: 0, runsWithoutTeapot: 0, teapotRuns: 0 }],
    ['negative remaining', -10, 1000, null, { runs: 0, runsWithoutTeapot: 0, teapotRuns: 0 }],
  ])('%s', (_label, remaining, perRun, stock, expected) => {
    expect(estimateRuns(remaining, perRun, stock)).toEqual(expected)
  })
})

describe('groupByQuest', () => {
  it('uses the max runs for servants on the same quest and sums totals', () => {
    const result = groupByQuest([
      { questId: 'grand', area: '冠位研鑽戦', effectiveAp: 40, runs: 150 },
      { questId: 'grand', area: '冠位研鑽戦', effectiveAp: 40, runs: 90 },
      { questId: 'ordeal', area: 'オーディール・コール', effectiveAp: 40, runs: 800 },
      { questId: 'daily', area: '修練場（月）', effectiveAp: 40, runs: 10 },
      { questId: 'broken', area: '冠位研鑽戦', effectiveAp: 40, runs: null },
    ])
    expect(result.groups).toEqual([
      { questId: 'grand', runs: 150, ap: 6000, pods: 150, servantCount: 2 },
      { questId: 'ordeal', runs: 800, ap: 32000, pods: 800, servantCount: 1 },
      { questId: 'daily', runs: 10, ap: 400, pods: 0, servantCount: 1 },
    ])
    expect(result.total).toEqual({ runs: 960, ap: 38400, pods: 950 })
  })

  it('keeps the max regardless of order', () => {
    const { groups } = groupByQuest([
      { questId: 'q', area: 'a', effectiveAp: 20, runs: 90 },
      { questId: 'q', area: 'a', effectiveAp: 20, runs: 150 },
    ])
    expect(groups[0].runs).toBe(150)
  })

  it('returns empty totals when every entry has an error', () => {
    expect(groupByQuest([{ questId: 'q', area: 'a', effectiveAp: 20, runs: null }])).toEqual({
      groups: [],
      total: { runs: 0, ap: 0, pods: 0 },
    })
  })
})

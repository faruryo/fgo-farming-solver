import { describe, expect, it } from 'vitest'
import type { BondQuestCandidate } from './quest-candidates'
import { defaultBondQuestId, parseBondTrackerState, reconcileEntry, type BondTrackerEntry } from './state'

const ENTRY: BondTrackerEntry = {
  servantId: 100100,
  questId: 'q1',
  currentLevel: 14,
  remainingToNext: 100000,
  targetLevel: 16,
  observedPerRun: 5240,
  observedTeapotRun: false,
  measuredQuestId: 'q1',
}
const VALID = { entries: [ENTRY], teapot: { enabled: true, stock: 3 } }
const EMPTY = { entries: [], teapot: { enabled: false, stock: 0 } }

describe('parseBondTrackerState', () => {
  it('accepts a valid state', () => {
    expect(parseBondTrackerState(VALID)).toEqual(VALID)
  })

  it('drops unknown fields', () => {
    expect(parseBondTrackerState({ ...VALID, extra: 1, entries: [{ ...ENTRY, extra: 1 }] })).toEqual(VALID)
  })

  it('keeps dependent out-of-range values for the screen to explain', () => {
    const entry = { ...ENTRY, remainingToNext: 0, observedPerRun: 0 }
    expect(parseBondTrackerState({ ...VALID, entries: [entry] }).entries).toEqual([entry])
  })

  it.each([
    ['unparseable JSON string', 'not json{'],
    ['null', null],
    ['array', []],
    ['entries missing', { teapot: VALID.teapot }],
    ['teapot missing', { entries: [ENTRY] }],
    ['teapot.enabled wrong type', { ...VALID, teapot: { enabled: 'yes', stock: 3 } }],
    ['negative teapot stock', { ...VALID, teapot: { enabled: true, stock: -1 } }],
    ['entry field missing', { ...VALID, entries: [{ ...ENTRY, questId: undefined }] }],
    ['servantId as string', { ...VALID, entries: [{ ...ENTRY, servantId: '100100' }] }],
    ['currentLevel above 15', { ...VALID, entries: [{ ...ENTRY, currentLevel: 16 }] }],
    ['targetLevel above 16', { ...VALID, entries: [{ ...ENTRY, targetLevel: 17 }] }],
    ['targetLevel 0', { ...VALID, entries: [{ ...ENTRY, targetLevel: 0 }] }],
    ['negative remaining', { ...VALID, entries: [{ ...ENTRY, remainingToNext: -1 }] }],
    ['fractional observed', { ...VALID, entries: [{ ...ENTRY, observedPerRun: 1.5 }] }],
    ['NaN level', { ...VALID, entries: [{ ...ENTRY, currentLevel: Number.NaN }] }],
    ['duplicate servants', { ...VALID, entries: [ENTRY, ENTRY] }],
  ])('returns the empty state for %s', (_label, value) => {
    expect(parseBondTrackerState(value)).toEqual(EMPTY)
  })
})

const candidate = (id: string, unconfirmedClass = false): BondQuestCandidate => ({
  quest: { id, section: 'Free', area: 'a', name: id, ap: 40, bondPoints: 1000 },
  effectiveAp: 40,
  unconfirmedClass,
})

describe('reconcileEntry', () => {
  const candidates = [candidate('extra', true), candidate('q2'), candidate('q1')]
  const questIds = new Set(['extra', 'q1', 'q2'])

  it('keeps a quest that is still a candidate', () => {
    expect(reconcileEntry(ENTRY, candidates, questIds)).toEqual({ entry: ENTRY, needsRemeasure: false })
  })

  it('replaces a non-candidate quest with the first confirmed candidate', () => {
    const result = reconcileEntry({ ...ENTRY, questId: 'gone', measuredQuestId: 'q1' }, candidates, questIds)
    expect(result.entry.questId).toBe('q2')
    expect(result.entry.measuredQuestId).toBe('q1')
    expect(result.needsRemeasure).toBe(false)
  })

  it('requires a new measurement when the measured quest is gone', () => {
    const result = reconcileEntry({ ...ENTRY, measuredQuestId: 'gone' }, candidates, questIds)
    expect(result).toEqual({ entry: { ...ENTRY, measuredQuestId: 'gone' }, needsRemeasure: true })
  })

  it('keeps the quest when no confirmed candidate exists', () => {
    const result = reconcileEntry({ ...ENTRY, questId: 'gone' }, [candidate('extra', true)], questIds)
    expect(result.entry.questId).toBe('gone')
  })

  it('never defaults to an unconfirmed-class candidate', () => {
    expect(defaultBondQuestId(candidates)).toBe('q2')
    expect(defaultBondQuestId([candidate('extra', true)])).toBeUndefined()
  })
})

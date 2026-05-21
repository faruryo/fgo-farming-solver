import { describe, it, expect } from 'vitest'
import { computePodFreeQuestsState } from './use-pod-free-quests'
import type { PodFreePeriod } from '../lib/master-data/types'

describe('computePodFreeQuestsState', () => {
  const NOW = 1779000000

  it('returns inactive state when periods is undefined (legacy data)', () => {
    const result = computePodFreeQuestsState(undefined, NOW)
    expect(result.isActive).toBe(false)
    expect(result.questIds.size).toBe(0)
    expect(result.currentPeriod).toBeUndefined()
  })

  it('returns inactive state when periods is empty', () => {
    const result = computePodFreeQuestsState([], NOW)
    expect(result.isActive).toBe(false)
    expect(result.questIds.size).toBe(0)
  })

  it('returns active state with union of questIds when periods are active', () => {
    const periods: PodFreePeriod[] = [
      { id: 1, name: 'A', startedAt: NOW - 100, endedAt: NOW + 100, questIds: ['Q1', 'Q2'] },
      { id: 2, name: 'B', startedAt: NOW - 200, endedAt: NOW + 200, questIds: ['Q2', 'Q3'] },
    ]
    const result = computePodFreeQuestsState(periods, NOW)
    expect(result.isActive).toBe(true)
    expect([...result.questIds].sort()).toEqual(['Q1', 'Q2', 'Q3'])
    expect(result.currentPeriod?.id).toBe(1) // shorter endedAt
  })

  it('ignores periods outside [startedAt, endedAt]', () => {
    const periods: PodFreePeriod[] = [
      { id: 1, name: 'past', startedAt: NOW - 200, endedAt: NOW - 100, questIds: ['Q1'] },
      { id: 2, name: 'future', startedAt: NOW + 100, endedAt: NOW + 200, questIds: ['Q2'] },
    ]
    const result = computePodFreeQuestsState(periods, NOW)
    expect(result.isActive).toBe(false)
  })
})

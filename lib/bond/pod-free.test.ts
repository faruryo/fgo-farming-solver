import { describe, expect, it } from 'vitest'
import type { PodFreePeriod } from '../master-data/types'
import { allocatePodFreeRuns, podFreeEndsAtByQuest, podFreeRuns } from './pod-free'

const DAY = 24 * 60 * 60
const NOW = 1_800_000_000

describe('podFreeRuns', () => {
  it.each([
    ['5 days left covers all 12 runs', 5 * DAY, 40, 12, 12],
    ['1 day left covers 7 of 12 runs', DAY, 40, 12, 7],
    ['a fractional day counts', 1.5 * DAY, 40, 100, 10],
    ['no runs left', DAY, 40, 0, 0],
  ])('%s', (_label, remainingSec, effectiveAp, runs, expected) => {
    expect(podFreeRuns({ remainingSec, effectiveAp, runs, useApples: false })).toBe(expected)
  })

  it('counts every run free on a 0 AP quest without dividing', () => {
    const free = podFreeRuns({ remainingSec: DAY, effectiveAp: 0, runs: 12, useApples: false })
    expect(free).toBe(12)
    expect(Number.isNaN(free)).toBe(false)
  })

  it('counts every run free when using apples', () => {
    expect(12 - podFreeRuns({ remainingSec: DAY, effectiveAp: 40, runs: 12, useApples: true })).toBe(0)
  })
})

describe('allocatePodFreeRuns', () => {
  const demand = (questId: string, days: number, runs: number, effectiveAp = 40) => ({
    questId,
    remainingSec: days * DAY,
    effectiveAp,
    runs,
  })

  it('splits 2,880 AP by required AP 6,000:2,000', () => {
    const free = allocatePodFreeRuns([demand('grand', 10, 150), demand('ordeal', 10, 50)], false)
    expect(free).toEqual(new Map([['grand', 54], ['ordeal', 18]]))
  })

  it('gives the earlier-ending period its AP first and the rest to the later one', () => {
    const free = allocatePodFreeRuns([demand('ordeal', 10, 100), demand('grand', 2, 100)], false)
    expect(free).toEqual(new Map([['grand', 14], ['ordeal', 57]]))
  })

  it('carries unused AP of a short demand over to the later period', () => {
    const free = allocatePodFreeRuns([demand('grand', 2, 10), demand('ordeal', 10, 100)], false)
    expect(free).toEqual(new Map([['grand', 10], ['ordeal', 62]]))
  })

  it('keeps 0 AP quests out of the split and counts all their runs free', () => {
    const free = allocatePodFreeRuns([demand('free', 10, 30, 0), demand('grand', 10, 150), demand('ordeal', 10, 50)], false)
    expect(free).toEqual(new Map([['free', 30], ['grand', 54], ['ordeal', 18]]))
    expect([...free.values()].some(Number.isNaN)).toBe(false)
  })

  it('counts every run free without splitting when using apples', () => {
    const free = allocatePodFreeRuns([demand('grand', 10, 150), demand('ordeal', 10, 50)], true)
    expect(free).toEqual(new Map([['grand', 150], ['ordeal', 50]]))
    expect(150 - (free.get('grand') as number) + 50 - (free.get('ordeal') as number)).toBe(0)
  })
})

describe('podFreeEndsAtByQuest', () => {
  const period = (id: number, startedAt: number, endedAt: number, questIds: string[]): PodFreePeriod => ({
    id,
    name: `period ${id}`,
    startedAt,
    endedAt,
    questIds,
  })

  it('maps quests in an active period to its end', () => {
    expect(podFreeEndsAtByQuest([period(1, NOW - DAY, NOW + DAY, ['grand', 'ordeal'])], NOW)).toEqual(
      new Map([['grand', NOW + DAY], ['ordeal', NOW + DAY]]),
    )
  })

  it('ignores a period that has not started', () => {
    expect(podFreeEndsAtByQuest([period(1, NOW + 1, NOW + DAY, ['grand'])], NOW).size).toBe(0)
  })

  it('treats endedAt === nowSec as outside the period', () => {
    expect(podFreeEndsAtByQuest([period(1, NOW - DAY, NOW, ['grand'])], NOW).size).toBe(0)
  })

  it('uses the later end when a quest is in two overlapping periods', () => {
    const periods = [period(1, NOW - DAY, NOW + 3 * DAY, ['grand']), period(2, NOW - DAY, NOW + DAY, ['grand'])]
    expect(podFreeEndsAtByQuest(periods, NOW)).toEqual(new Map([['grand', NOW + 3 * DAY]]))
  })

  it('returns an empty map without period data', () => {
    expect(podFreeEndsAtByQuest(undefined, NOW).size).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import {
  getJstDayKey,
  getDailyTaskDeadlineMs,
  getJstWeekKey,
  getWeeklyTaskDeadlineMs,
  buildDailyTaskId,
  buildWeeklyTaskId,
  buildEventShopTaskId,
  isEventActiveForShop,
} from './period'

// JST wall-clock ISO helper: interprets the given local time as JST (UTC+9) and
// returns the corresponding real UTC unix-ms instant.
const jst = (iso: string): number => new Date(`${iso}+09:00`).getTime()

describe('getJstDayKey', () => {
  it('the 0:00-3:59 JST tail belongs to the new day (formerly the previous day under the old 4:00 AM boundary)', () => {
    expect(getJstDayKey(jst('2026-06-23T00:00:00'))).toBe('20260623')
    expect(getJstDayKey(jst('2026-06-23T00:30:00'))).toBe('20260623')
    expect(getJstDayKey(jst('2026-06-23T03:59:00'))).toBe('20260623')
  })

  it('the last instant of the previous day still belongs to the previous day', () => {
    expect(getJstDayKey(jst('2026-06-22T23:59:00'))).toBe('20260622')
  })

  it('stays the same day through the rest of the day', () => {
    expect(getJstDayKey(jst('2026-06-23T04:00:00'))).toBe('20260623')
    expect(getJstDayKey(jst('2026-06-23T23:59:00'))).toBe('20260623')
  })

  it('handles a month/year rollover', () => {
    expect(getJstDayKey(jst('2026-01-01T00:00:00'))).toBe('20260101')
    expect(getJstDayKey(jst('2026-01-01T00:30:00'))).toBe('20260101')
    expect(getJstDayKey(jst('2025-12-31T23:59:00'))).toBe('20251231')
  })
})

describe('getDailyTaskDeadlineMs', () => {
  it('resolves to 23:59 JST of the same calendar day for a time within the period', () => {
    const now = jst('2026-06-23T10:00:00')
    expect(getDailyTaskDeadlineMs(now)).toBe(jst('2026-06-23T23:59:00'))
  })

  it('the deadline for the early-morning (0:00-3:59) tail of a day is the same-day 23:59', () => {
    const now = jst('2026-06-23T02:00:00')
    expect(getDailyTaskDeadlineMs(now)).toBe(jst('2026-06-23T23:59:00'))
  })
})

describe('buildDailyTaskId', () => {
  it('brands the id with the JST day key', () => {
    expect(buildDailyTaskId(jst('2026-06-23T10:00:00'))).toBe('daily-20260623')
    expect(buildDailyTaskId(jst('2026-06-23T02:00:00'))).toBe('daily-20260623')
  })
})

describe('getJstWeekKey', () => {
  it('Monday 0:00 JST starts a new week', () => {
    // 2026-06-22 is a Monday.
    expect(getJstWeekKey(jst('2026-06-22T00:00:00'))).toBe(getJstWeekKey(jst('2026-06-22T00:00:01')))
  })

  it('Sunday 23:59 JST still belongs to the previous week (before Monday 0:00 boundary)', () => {
    expect(getJstWeekKey(jst('2026-06-21T23:59:00'))).not.toBe(getJstWeekKey(jst('2026-06-22T00:00:00')))
  })

  it('is stable across the whole week (Mon..Sun)', () => {
    const monday = getJstWeekKey(jst('2026-06-22T00:00:00'))
    expect(getJstWeekKey(jst('2026-06-23T12:00:00'))).toBe(monday)
    expect(getJstWeekKey(jst('2026-06-28T23:58:00'))).toBe(monday)
  })

  it('a late-December week belongs to ISO week 1 of the following year', () => {
    // 2024-12-30 is a Monday whose Thursday (2025-01-02) falls in 2025, so
    // it's ISO week 1 of 2025, not week 53 of 2024.
    expect(getJstWeekKey(jst('2024-12-30T00:00:00'))).toBe('2025W01')
  })

  it('the preceding week (same December) still belongs to the old year', () => {
    expect(getJstWeekKey(jst('2024-12-23T00:00:00'))).toBe('2024W52')
  })

  it('an early-January week can still belong to the previous ISO year', () => {
    // 2017-01-01 is a Sunday, so it's part of the week starting Monday
    // 2016-12-26, whose Thursday (2016-12-29) falls in 2016 -> ISO week 52 of 2016.
    expect(getJstWeekKey(jst('2017-01-01T00:00:00'))).toBe('2016W52')
  })

  it('handles a 53-ISO-week year', () => {
    // 2026-12-28 is a Monday whose Thursday (2026-12-31) is still in 2026,
    // and 2026 has 53 ISO weeks.
    expect(getJstWeekKey(jst('2026-12-28T00:00:00'))).toBe('2026W53')
  })
})

describe('getWeeklyTaskDeadlineMs', () => {
  it('resolves to Sunday 23:59 JST of the current week', () => {
    const now = jst('2026-06-23T12:00:00') // Tuesday within the week starting Mon 2026-06-22
    expect(getWeeklyTaskDeadlineMs(now)).toBe(jst('2026-06-28T23:59:00'))
  })

  it('a time right after the Monday 0:00 boundary deadlines that same week`s Sunday', () => {
    expect(getWeeklyTaskDeadlineMs(jst('2026-06-22T00:00:00'))).toBe(jst('2026-06-28T23:59:00'))
  })
})

describe('buildWeeklyTaskId', () => {
  it('brands the id with the JST week key', () => {
    expect(buildWeeklyTaskId(jst('2026-06-23T12:00:00'))).toBe(`weekly-${getJstWeekKey(jst('2026-06-23T12:00:00'))}`)
  })
})

describe('buildEventShopTaskId', () => {
  it('brands the id with the event id', () => {
    expect(buildEventShopTaskId(90123)).toBe('event-shop-90123')
  })
})

describe('isEventActiveForShop', () => {
  const event = {
    startedAt: Math.floor(jst('2026-06-01T00:00:00') / 1000),
    endedAt: Math.floor(jst('2026-06-15T23:59:00') / 1000),
    shopFinishedAt: Math.floor(jst('2026-06-15T23:59:00') / 1000),
  }

  it('is false before the event starts', () => {
    expect(isEventActiveForShop(event, jst('2026-05-31T23:59:00'))).toBe(false)
  })

  it('is true at the start instant and while running', () => {
    expect(isEventActiveForShop(event, jst('2026-06-01T00:00:00'))).toBe(true)
    expect(isEventActiveForShop(event, jst('2026-06-10T00:00:00'))).toBe(true)
  })

  it('is false at/after shopFinishedAt', () => {
    expect(isEventActiveForShop(event, jst('2026-06-15T23:59:00'))).toBe(false)
    expect(isEventActiveForShop(event, jst('2026-06-16T00:00:00'))).toBe(false)
  })

  it('stays active past endedAt as long as shopFinishedAt has not passed (shop extension)', () => {
    const shopExtended = {
      startedAt: Math.floor(jst('2026-06-01T00:00:00') / 1000),
      endedAt: Math.floor(jst('2026-06-10T23:59:00') / 1000),
      shopFinishedAt: Math.floor(jst('2026-06-15T23:59:00') / 1000),
    }
    expect(isEventActiveForShop(shopExtended, jst('2026-06-12T00:00:00'))).toBe(true)
  })
})

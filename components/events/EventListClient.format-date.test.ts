import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatDate } from './EventListClient'

describe('formatDate', () => {
  const originalTz = process.env.TZ
  beforeEach(() => {
    process.env.TZ = 'America/Los_Angeles'
  })
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  it.each([
    ['80614 の終了(JST 9/2 12:59)は端末のタイムゾーンによらず 9/2', 1788321599, '2026/09/02'],
    ['80614 の開始(JST 8/12 20:00)', 1786532400, '2026/08/12'],
    ['JST の 0 時台は UTC では前日でも JST の日付', 1788274800, '2026/09/02'],
  ])('%s', (_label, sec, expected) => {
    expect(formatDate(sec)).toBe(expected)
  })
})

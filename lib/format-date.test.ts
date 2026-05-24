import { describe, it, expect } from 'vitest'
import { formatDate } from './format-date'

const JST = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const expected = (isoStr: string) => {
  const parts = JST.formatToParts(new Date(isoStr))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}月${get('day')}日 ${get('hour')}:${get('minute')}`
}

describe('formatDate', () => {
  it('formats ISO Z string to M月D日 HH:MM (JST)', () => {
    const iso = '2026-05-24T03:00:00Z'
    expect(formatDate(iso)).toBe(expected(iso))
  })

  it('formats SQLite DATETIME format (space separator, no Z)', () => {
    // SQLite CURRENT_TIMESTAMP stores UTC as "YYYY-MM-DD HH:MM:SS"
    const result = formatDate('2026-05-24 03:00:00')
    expect(result).toBe(expected('2026-05-24T03:00:00Z'))
  })

  it('output matches M月D日 HH:MM pattern', () => {
    expect(formatDate('2026-01-05T00:00:00Z')).toMatch(/^\d+月\d+日 \d{2}:\d{2}$/)
  })

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(formatDate('')).toBe('')
  })

  it('returns empty string for unparseable string', () => {
    expect(formatDate('not-a-date')).toBe('')
  })

  it('does not double-append Z when already present', () => {
    const iso = '2026-06-01T09:00:00Z'
    expect(formatDate(iso)).toBe(expected(iso))
  })
})

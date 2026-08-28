import { describe, it, expect } from 'vitest'
import { formatDate, parseUtcDate } from './format-date'

describe('parseUtcDate', () => {
  it('parses valid UTC date strings', () => {
    expect(parseUtcDate('2026-05-24T03:00:00Z')?.toISOString()).toBe('2026-05-24T03:00:00.000Z')
    expect(parseUtcDate('2026-05-24 03:00:00')?.toISOString()).toBe('2026-05-24T03:00:00.000Z')
    expect(parseUtcDate('2026-05-24T12:00:00+09:00')?.toISOString()).toBe('2026-05-24T03:00:00.000Z')
    expect(parseUtcDate('2026-05-24T03:00:00.500Z')?.toISOString()).toBe('2026-05-24T03:00:00.500Z')
  })

  it('handles empty or invalid date strings', () => {
    expect(parseUtcDate()).toBeNull()
    expect(parseUtcDate(null)).toBeNull()
    expect(parseUtcDate('')).toBeNull()
    expect(parseUtcDate('   ')).toBeNull()
    expect(parseUtcDate('not-a-date')).toBeNull()
  })
})

describe('formatDate', () => {
  const localFormatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const expectedLocal = (isoStr: string) => {
    const d = parseUtcDate(isoStr)
    if (!d) return ''
    const parts = localFormatter.formatToParts(d)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('month')}月${get('day')}日 ${get('hour')}:${get('minute')}`
  }

  it('formats ISO Z and SQLite DATETIME strings identically using client local time', () => {
    const iso = '2026-05-24T03:00:00Z'
    const sqlite = '2026-05-24 03:00:00'
    expect(formatDate(iso)).toBe(expectedLocal(iso))
    expect(formatDate(sqlite)).toBe(expectedLocal(iso))
    expect(formatDate('2026-01-05T00:00:00Z')).toMatch(/^\d+月\d+日 \d{2}:\d{2}$/)
  })

  it('returns empty string for missing or invalid input', () => {
    expect(formatDate()).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
    expect(formatDate('not-a-date')).toBe('')
  })
})

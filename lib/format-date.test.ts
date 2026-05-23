import { describe, it, expect } from 'vitest'
import { formatDate } from './format-date'

describe('formatDate', () => {
  it('formats ISO Z string to local time M月D日 HH:MM', () => {
    // 2026-05-24T03:00:00Z = JST 12:00
    const result = formatDate('2026-05-24T03:00:00Z')
    expect(result).toBe('5月24日 12:00')
  })

  it('formats SQLite DATETIME format (no T, no Z)', () => {
    // SQLite CURRENT_TIMESTAMP stores UTC as "YYYY-MM-DD HH:MM:SS"
    // 2026-05-24 03:00:00 UTC = JST 12:00
    const result = formatDate('2026-05-24 03:00:00')
    expect(result).toBe('5月24日 12:00')
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
    const r1 = formatDate('2026-01-01T00:00:00Z')
    const r2 = formatDate('2026-01-01T00:00:00Z')
    expect(r1).toBe(r2)
  })
})

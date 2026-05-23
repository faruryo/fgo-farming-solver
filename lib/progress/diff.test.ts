import { describe, it, expect } from 'vitest'
import { extractItemCounts, extractCheckedQuests } from './diff'

describe('extractItemCounts', () => {
  it('handles JSON objects correctly', () => {
    const snapshot = {
      items: {
        '10': 746,
        '11': 48,
      },
    }
    const res = extractItemCounts(snapshot)
    expect(res).toEqual({ '10': 746, '11': 48 })
  })

  it('handles JSON strings correctly', () => {
    const snapshot = {
      items: '{"10": 746, "11": 48}',
    }
    const res = extractItemCounts(snapshot)
    expect(res).toEqual({ '10': 746, '11': 48 })
  })

  it('handles comma-separated key-value strings from solver redirect correctly', () => {
    const snapshot = {
      items: '10:746,11:48',
    }
    const res = extractItemCounts(snapshot)
    expect(res).toEqual({ '10': 746, '11': 48 })
  })

  it('tolerates extra spaces in CSV item format', () => {
    const snapshot = {
      items: ' 10:746, 11:48 ',
    }
    const res = extractItemCounts(snapshot)
    expect(res).toEqual({ '10': 746, '11': 48 })
  })

  it('returns null on invalid formats', () => {
    expect(extractItemCounts(null)).toBeNull()
    expect(extractItemCounts(undefined)).toBeNull()
    expect(extractItemCounts({})).toBeNull()
    expect(extractItemCounts({ items: 'not-json-and-no-colons' })).toBeNull()
  })
})

describe('extractCheckedQuests', () => {
  it('handles JSON arrays correctly', () => {
    const snapshot = {
      quests: ['101', '102'],
    }
    const res = extractCheckedQuests(snapshot)
    expect(res).toEqual(['101', '102'])
  })

  it('handles JSON array strings correctly', () => {
    const snapshot = {
      quests: '["101", "102"]',
    }
    const res = extractCheckedQuests(snapshot)
    expect(res).toEqual(['101', '102'])
  })

  it('handles comma-separated strings correctly', () => {
    const snapshot = {
      quests: '101,102',
    }
    const res = extractCheckedQuests(snapshot)
    expect(res).toEqual(['101', '102'])
  })
})

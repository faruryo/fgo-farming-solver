import { describe, it, expect } from 'vitest'
import {
  classifyQuantityChange,
  signedDelta,
  reviewSection,
  toReviewRow,
  sortReviewRows,
  matchesReviewFilter,
  isReviewRowVisible,
  countBySection,
  groupReviewRows,
  type ReviewRowSource,
} from './review-presentation'

const source = (overrides: Partial<ReviewRowSource> & Pick<ReviewRowSource, 'atlasId' | 'name'>): ReviewRowSource => ({
  currentQuantity: 10,
  parsedProposed: 10,
  needsReview: false,
  hasConflict: false,
  ...overrides,
})

describe('classifyQuantityChange', () => {
  it.each([
    [10, 12, 'increase'],
    [10, 8, 'decrease'],
    [10, 10, 'unchanged'],
    [0, 0, 'unchanged'],
    [0, 5, 'increase'],
    [10, null, 'unknown'],
  ] as const)('current=%s proposed=%s → %s', (current, proposed, expected) => {
    expect(classifyQuantityChange(current, proposed)).toBe(expected)
  })
})

describe('signedDelta', () => {
  it.each([
    [10, 12, 2],
    [10, 8, -2],
    [10, 10, 0],
    [10, null, null],
  ] as const)('current=%s proposed=%s → %s', (current, proposed, expected) => {
    expect(signedDelta(current, proposed)).toBe(expected)
  })
})

describe('reviewSection', () => {
  it('puts needsReview ahead of an increase', () => {
    expect(
      reviewSection(source({ atlasId: 1, name: 'a', parsedProposed: 20, needsReview: true }))
    ).toBe('needs-review')
  })

  it('puts hasConflict ahead of a decrease', () => {
    expect(
      reviewSection(source({ atlasId: 1, name: 'a', parsedProposed: 1, hasConflict: true }))
    ).toBe('needs-review')
  })

  it('treats unknown proposed as needs-review even without flags', () => {
    expect(
      reviewSection(source({ atlasId: 1, name: 'a', parsedProposed: null }))
    ).toBe('needs-review')
  })

  it.each([
    [20, 'increase'],
    [1, 'decrease'],
    [10, 'unchanged'],
  ] as const)('proposed=%s without flags → %s', (parsedProposed, expected) => {
    expect(reviewSection(source({ atlasId: 1, name: 'a', parsedProposed }))).toBe(expected)
  })
})

describe('sortReviewRows', () => {
  it('orders needs-review → increase → decrease → unchanged', () => {
    const rows = sortReviewRows(
      [
        source({ atlasId: 1, name: 'unchanged', parsedProposed: 10 }),
        source({ atlasId: 2, name: 'decrease', parsedProposed: 5 }),
        source({ atlasId: 3, name: 'increase', parsedProposed: 15 }),
        source({ atlasId: 4, name: 'review', parsedProposed: 15, needsReview: true }),
      ].map(toReviewRow)
    )
    expect(rows.map((r) => r.section)).toEqual([
      'needs-review',
      'increase',
      'decrease',
      'unchanged',
    ])
  })

  it('sorts increases and decreases by |delta| descending, then name', () => {
    const rows = sortReviewRows(
      [
        source({ atlasId: 1, name: 'アイテムB', parsedProposed: 11 }),
        source({ atlasId: 2, name: 'アイテムA', parsedProposed: 11 }),
        source({ atlasId: 3, name: '大きい増', parsedProposed: 50 }),
        source({ atlasId: 4, name: '小さい減', parsedProposed: 9 }),
        source({ atlasId: 5, name: '大きい減', parsedProposed: 1 }),
      ].map(toReviewRow)
    )
    expect(rows.map((r) => r.name)).toEqual([
      '大きい増',
      'アイテムA',
      'アイテムB',
      '大きい減',
      '小さい減',
    ])
  })
})

describe('matchesReviewFilter / groupReviewRows / countBySection', () => {
  const rows = [
    source({ atlasId: 1, name: 'review', parsedProposed: null }),
    source({ atlasId: 2, name: 'up', parsedProposed: 20 }),
    source({ atlasId: 3, name: 'down', parsedProposed: 1 }),
    source({ atlasId: 4, name: 'same', parsedProposed: 10 }),
  ].map(toReviewRow)

  it('counts every section from the full list', () => {
    expect(countBySection(rows)).toEqual({
      'needs-review': 1,
      increase: 1,
      decrease: 1,
      unchanged: 1,
    })
  })

  it('keeps unchanged in the all filter and drops it for changed', () => {
    expect(matchesReviewFilter('unchanged', 'all')).toBe(true)
    expect(matchesReviewFilter('unchanged', 'changed')).toBe(false)
    expect(matchesReviewFilter('increase', 'changed')).toBe(true)
    expect(matchesReviewFilter('needs-review', 'changed')).toBe(true)
    expect(matchesReviewFilter('increase', 'needs-review')).toBe(false)
    expect(matchesReviewFilter('needs-review', 'needs-review')).toBe(true)
  })

  it('keeps the row being edited even when the filter would hide its new section', () => {
    expect(isReviewRowVisible('increase', 'needs-review', 101, 101)).toBe(true)
    expect(isReviewRowVisible('increase', 'needs-review', 101, 202)).toBe(false)
    expect(isReviewRowVisible('increase', 'needs-review', 101, null)).toBe(false)
    expect(isReviewRowVisible('unchanged', 'changed', 101, 101)).toBe(true)
  })

  it('groups visible sections in display order', () => {
    const grouped = groupReviewRows(sortReviewRows(rows), 'all')
    expect(grouped.map((g) => g.section)).toEqual([
      'needs-review',
      'increase',
      'decrease',
      'unchanged',
    ])
    expect(groupReviewRows(sortReviewRows(rows), 'changed').map((g) => g.section)).toEqual([
      'needs-review',
      'increase',
      'decrease',
    ])
    expect(groupReviewRows(sortReviewRows(rows), 'needs-review').map((g) => g.section)).toEqual([
      'needs-review',
    ])
  })
})

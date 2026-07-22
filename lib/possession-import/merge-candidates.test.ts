import { describe, it, expect } from 'vitest'
import { mergeCandidates } from './merge-candidates'
import { CardCandidate } from './types'

const card = (overrides: Partial<CardCandidate>): CardCandidate => ({
  sourceImageIndex: 0,
  region: { x: 0, y: 0, width: 100, height: 100, clipped: false },
  ocrLines: [],
  atlasId: null,
  matchedName: null,
  matchScore: 0,
  quantity: null,
  clipped: false,
  cropDataUrl: '',
  ...overrides,
})

const nameById = new Map([
  [1, '狂の魔石'],
  [2, '剣の秘石'],
])

describe('mergeCandidates', () => {
  it('drops candidates that were never identified', () => {
    const result = mergeCandidates([card({ atlasId: null })], {}, nameById)
    expect(result).toHaveLength(0)
  })

  it('collapses duplicate candidates with the same quantity into one entry', () => {
    const candidates = [
      card({ atlasId: 1, quantity: 3052, sourceImageIndex: 0 }),
      card({ atlasId: 1, quantity: 3052, sourceImageIndex: 1 }),
    ]
    const result = mergeCandidates(candidates, {}, nameById)
    expect(result).toHaveLength(1)
    expect(result[0].proposedQuantity).toBe(3052)
    expect(result[0].hasConflict).toBe(false)
    expect(result[0].needsReview).toBe(false)
    expect(result[0].sources).toHaveLength(2)
  })

  it('flags a conflict when the same item has different quantities across images', () => {
    const candidates = [
      card({ atlasId: 1, quantity: 3052 }),
      card({ atlasId: 1, quantity: 3000 }),
    ]
    const result = mergeCandidates(candidates, {}, nameById)
    expect(result[0].hasConflict).toBe(true)
    expect(result[0].proposedQuantity).toBeNull()
    expect(result[0].needsReview).toBe(true)
  })

  it('prefers a fully-visible card over a clipped duplicate of the same item', () => {
    const candidates = [
      card({ atlasId: 1, quantity: 305, clipped: true }), // truncated read at an image edge
      card({ atlasId: 1, quantity: 3052, clipped: false }),
    ]
    const result = mergeCandidates(candidates, {}, nameById)
    expect(result[0].proposedQuantity).toBe(3052)
    expect(result[0].needsReview).toBe(false)
  })

  it('marks an item as needing review when only a clipped card was found', () => {
    const candidates = [card({ atlasId: 1, quantity: 3052, clipped: true })]
    const result = mergeCandidates(candidates, {}, nameById)
    expect(result[0].needsReview).toBe(true)
  })

  it('carries the current posession value through for diffing', () => {
    const candidates = [card({ atlasId: 2, quantity: 100 })]
    const result = mergeCandidates(candidates, { 2: 81 }, nameById)
    expect(result[0].currentQuantity).toBe(81)
    expect(result[0].proposedQuantity).toBe(100)
  })

  it('marks needsReview when quantity could not be read at all', () => {
    const candidates = [card({ atlasId: 1, quantity: null })]
    const result = mergeCandidates(candidates, {}, nameById)
    expect(result[0].needsReview).toBe(true)
    expect(result[0].proposedQuantity).toBeNull()
  })
})

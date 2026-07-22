import { describe, it, expect } from 'vitest'
import { nameSimilarity, findBestNameMatch, MatchTarget } from './fuzzy-match'

describe('nameSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(nameSimilarity('狂の魔石', '狂の魔石')).toBe(1)
  })

  it('returns a high score for a single-character OCR misread', () => {
    // Real spike misread: 剣の秘石 -> 刘の秘石
    expect(nameSimilarity('刘の秘石', '剣の秘石')).toBeGreaterThan(0.7)
  })

  it('returns a low score for unrelated strings', () => {
    expect(nameSimilarity('狂の魔石', '愚者の鎖')).toBeLessThan(0.3)
  })
})

describe('findBestNameMatch', () => {
  const targets: MatchTarget[] = [
    { atlasId: 1, name: '剣の秘石' },
    { atlasId: 2, name: '弓の秘石' },
    { atlasId: 3, name: '狂の魔石' },
  ]

  it('finds the exact match', () => {
    const result = findBestNameMatch('狂の魔石', targets)
    expect(result?.atlasId).toBe(3)
    expect(result?.score).toBe(1)
  })

  it('finds the closest match despite an OCR misread character', () => {
    const result = findBestNameMatch('刘の秘石', targets)
    expect(result?.atlasId).toBe(1)
  })

  it('returns null when the target list is empty', () => {
    expect(findBestNameMatch('狂の魔石', [])).toBeNull()
  })
})

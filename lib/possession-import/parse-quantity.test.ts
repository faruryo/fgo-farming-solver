import { describe, it, expect } from 'vitest'
import { parseQuantityLine, guessItemNameLine, guessQuantityLine, isPossessionLabelLine } from './parse-quantity'

describe('parseQuantityLine', () => {
  it('parses a plain comma-separated quantity', () => {
    expect(parseQuantityLine('3,052個')).toBe(3052)
  })

  it('normalizes a fullwidth comma misread as a period-like separator', () => {
    expect(parseQuantityLine('3，052個')).toBe(3052)
  })

  it('normalizes a period misread of the digit separator (does not truncate to 3)', () => {
    expect(parseQuantityLine('3.052個')).toBe(3052)
  })

  it('parses a small unformatted quantity', () => {
    expect(parseQuantityLine('81個')).toBe(81)
  })

  it('returns null for non-quantity text', () => {
    expect(parseQuantityLine('狂の魔石')).toBeNull()
    expect(parseQuantityLine('所持')).toBeNull()
    expect(parseQuantityLine('')).toBeNull()
  })
})

describe('isPossessionLabelLine', () => {
  it('matches the exact label', () => {
    expect(isPossessionLabelLine('所持')).toBe(true)
  })
  it('tolerates the OCR misread 所持 -> 所特', () => {
    expect(isPossessionLabelLine('所特')).toBe(true)
  })
  it('rejects unrelated text', () => {
    expect(isPossessionLabelLine('狂の魔石')).toBe(false)
  })
})

describe('guessItemNameLine', () => {
  it('picks the item name over the Item badge and possession label', () => {
    expect(guessItemNameLine(['Item', '狂の魔石', '所持', '3,052個'])).toBe('狂の魔石')
  })

  it('ignores stray single-character noise mixed into the label line', () => {
    expect(guessItemNameLine(['Item', '剣の秘石', 'S 所持', '81個'])).toBe('剣の秘石')
  })

  it('returns null when no candidate line remains', () => {
    expect(guessItemNameLine(['Item', '所持', '81個'])).toBeNull()
  })
})

describe('guessQuantityLine', () => {
  it('prefers the quantity line following the possession label', () => {
    expect(guessQuantityLine(['所特', '1,66', 'Item', '愚者の鎖', '所持', '687個'])).toBe(687)
  })

  it('falls back to any quantity-shaped line when no label is present', () => {
    expect(guessQuantityLine(['狂の魔石', '3,052個'])).toBe(3052)
  })

  it('returns null when nothing matches', () => {
    expect(guessQuantityLine(['狂の魔石', '所持'])).toBeNull()
  })
})

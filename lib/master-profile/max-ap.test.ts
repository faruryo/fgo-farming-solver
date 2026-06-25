import { describe, it, expect } from 'vitest'
import {
  maxApForLevel,
  MAX_MASTER_LEVEL,
  DEFAULT_MAX_AP,
} from './max-ap'

describe('maxApForLevel', () => {
  it('低レベル帯の既知値', () => {
    expect(maxApForLevel(1)).toBe(20)
    expect(maxApForLevel(9)).toBe(28)
    expect(maxApForLevel(10)).toBe(31)
    expect(maxApForLevel(15)).toBe(38)
    expect(maxApForLevel(20)).toBe(45)
    expect(maxApForLevel(50)).toBe(75)
  })

  it('中レベル帯は level+25（L20〜L101）', () => {
    expect(maxApForLevel(75)).toBe(100)
    expect(maxApForLevel(100)).toBe(125)
    expect(maxApForLevel(101)).toBe(126)
  })

  it('設計アンカー（出典検証）', () => {
    expect(maxApForLevel(170)).toBe(146)
    expect(maxApForLevel(180)).toBe(148)
    expect(maxApForLevel(MAX_MASTER_LEVEL)).toBe(152)
  })

  it('鈍化区間の据え置き', () => {
    // 142 は L147〜L152 据え置き
    expect(maxApForLevel(147)).toBe(142)
    expect(maxApForLevel(150)).toBe(142)
    expect(maxApForLevel(152)).toBe(142)
    expect(maxApForLevel(153)).toBe(143)
  })

  it('単調非減少（全レベル）', () => {
    for (let lv = 2; lv <= MAX_MASTER_LEVEL; lv++) {
      expect(maxApForLevel(lv)).toBeGreaterThanOrEqual(maxApForLevel(lv - 1))
    }
  })

  it('範囲外はクランプ', () => {
    expect(maxApForLevel(0)).toBe(maxApForLevel(1))
    expect(maxApForLevel(-5)).toBe(maxApForLevel(1))
    expect(maxApForLevel(999)).toBe(maxApForLevel(MAX_MASTER_LEVEL))
  })

  it('DEFAULT_MAX_AP は最大レベルの最大AP', () => {
    expect(DEFAULT_MAX_AP).toBe(152)
  })
})

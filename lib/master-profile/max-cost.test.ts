import { describe, it, expect } from 'vitest'
import { maxCostForLevel } from './max-cost'
import { MAX_MASTER_LEVEL } from './max-ap'

describe('maxCostForLevel', () => {
  it('最小レベルと最大レベル', () => {
    expect(maxCostForLevel(1)).toBe(56)
    expect(maxCostForLevel(MAX_MASTER_LEVEL)).toBe(118)
  })

  it('変化点の間は直前の変化点の値のまま', () => {
    expect(maxCostForLevel(2)).toBe(56)
    expect(maxCostForLevel(3)).toBe(57)
    expect(maxCostForLevel(127)).toBe(111)
    expect(maxCostForLevel(130)).toBe(111)
    expect(maxCostForLevel(139)).toBe(111)
    expect(maxCostForLevel(140)).toBe(112)
    expect(maxCostForLevel(199)).toBe(117)
  })

  it('単調非減少（全レベル）', () => {
    for (let lv = 2; lv <= MAX_MASTER_LEVEL; lv++) {
      expect(maxCostForLevel(lv)).toBeGreaterThanOrEqual(maxCostForLevel(lv - 1))
    }
  })

  it('範囲外はクランプし、小数は切り捨てる', () => {
    expect(maxCostForLevel(0)).toBe(56)
    expect(maxCostForLevel(-5)).toBe(56)
    expect(maxCostForLevel(999)).toBe(118)
    expect(maxCostForLevel(130.9)).toBe(111)
  })
})

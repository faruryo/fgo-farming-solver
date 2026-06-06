import { describe, it, expect } from 'vitest'
import {
  computeItemThroughput,
  classifyTierByThroughput,
} from './throughput'

describe('computeItemThroughput', () => {
  it('所持が増えた分を itemsFarmed に集計する', () => {
    const t = computeItemThroughput({ '6503': 10 }, { '6503': 25 })
    expect(t).toEqual({ itemsFarmed: 15, itemsConsumed: 0 })
  })

  it('所持が減った分(育成投入)を itemsConsumed に集計する', () => {
    const t = computeItemThroughput({ '6502': 336 }, { '6502': 297 })
    expect(t).toEqual({ itemsFarmed: 0, itemsConsumed: 39 })
  })

  it('増減混在を farm/投入に振り分ける', () => {
    const t = computeItemThroughput(
      { '6503': 10, '6502': 336, '6564': 0 },
      { '6503': 13, '6502': 297, '6564': 18 }
    )
    // farm: 6503 +3, 6564 +18 = 21 / 投入: 6502 -39 = 39
    expect(t).toEqual({ itemsFarmed: 21, itemsConsumed: 39 })
  })

  it('QP(atlasId 1)は除外する', () => {
    const t = computeItemThroughput(
      { '1': 100000000, '6503': 10 },
      { '1': 51560448, '6503': 13 }
    )
    expect(t).toEqual({ itemsFarmed: 3, itemsConsumed: 0 })
  })

  it('文字列の所持数も数値として扱う', () => {
    const t = computeItemThroughput({ '6503': '10' }, { '6503': '13' })
    expect(t.itemsFarmed).toBe(3)
  })

  it('null/undefined を安全に扱う', () => {
    expect(computeItemThroughput(null, null)).toEqual({
      itemsFarmed: 0,
      itemsConsumed: 0,
    })
    expect(computeItemThroughput(undefined, { '6503': 5 })).toEqual({
      itemsFarmed: 5,
      itemsConsumed: 0,
    })
  })
})

describe('classifyTierByThroughput', () => {
  const DAY = 1440
  it('スループット 0 は none', () => {
    expect(classifyTierByThroughput(0, DAY)).toBe('none')
  })
  it('少量(perDay<10)は small', () => {
    expect(classifyTierByThroughput(5, DAY)).toBe('small')
  })
  it('中量(10<=perDay<50)は medium', () => {
    expect(classifyTierByThroughput(20, DAY)).toBe('medium')
  })
  it('多量(perDay>=50)は large', () => {
    expect(classifyTierByThroughput(60, DAY)).toBe('large')
  })
  it('経過日数でならす(同じ総量でも長期間なら控えめ)', () => {
    // 100個を1日 → 100/日 → large、100個を20日 → 5/日 → small
    expect(classifyTierByThroughput(100, DAY)).toBe('large')
    expect(classifyTierByThroughput(100, DAY * 20)).toBe('small')
  })
  it('本番相当(336個 / 約3.13日 ≈ 107/日)は large', () => {
    expect(classifyTierByThroughput(336, Math.round(DAY * 3.13))).toBe('large')
  })
})

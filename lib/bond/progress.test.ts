import { describe, expect, it } from 'vitest'
import { bondProgress, timeToGoal } from './progress'

const GROWTH = [3000, 9125, 15250]

describe('timeToGoal', () => {
  it('AP が律速なら AP をボトルネックにする', () => {
    expect(timeToGoal({ ap: 288 * 10, pods: 0 })).toEqual({ days: 10, bottleneck: 'ap' })
  })
  it('ポッドが律速ならポッドをボトルネックにする', () => {
    // 1日あたり 3 + 40/30 = 13/3 個
    expect(timeToGoal({ ap: 288, pods: 130 })).toEqual({ days: 30, bottleneck: 'pods' })
  })
  it('何も要らなければ0日でボトルネックなし', () => {
    expect(timeToGoal({ ap: 0, pods: 0 })).toEqual({ days: 0, bottleneck: null })
  })
})

describe('bondProgress', () => {
  it('Lv0 で何も稼いでいなければ0', () => {
    expect(bondProgress(GROWTH, { currentLevel: 0, remainingToNext: 3000, targetLevel: 3 })).toBe(0)
  })
  it('累計絆で目標までの割合を返す', () => {
    // Lv1 到達済み(3000) + 次Lvまで 6125 のうち 125 稼いだ → 3125 / 15250
    expect(bondProgress(GROWTH, { currentLevel: 1, remainingToNext: 6000, targetLevel: 3 })).toBeCloseTo(3125 / 15250)
  })
  it('絆データがなければ null', () => {
    expect(bondProgress(undefined, { currentLevel: 0, remainingToNext: 1, targetLevel: 3 })).toBeNull()
    expect(bondProgress(GROWTH, { currentLevel: 0, remainingToNext: 1, targetLevel: 5 })).toBeNull()
  })
})

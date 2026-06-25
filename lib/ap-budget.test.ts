import { describe, it, expect } from 'vitest'
import { computeApBudget, QUARTZ_UNIT_YEN } from './ap-budget'

describe('computeApBudget', () => {
  it('需要0なら全て0', () => {
    const b = computeApBudget(0, 152, 5)
    expect(b.totalRestores).toBe(0)
    expect(b.goldenFruitUsed).toBe(0)
    expect(b.quartzCount).toBe(0)
    expect(b.yen).toBe(0)
  })

  it('所持果実0 → 全て聖晶石', () => {
    // needAp=300, maxAp=150 → 2全回復, 果実0 → 聖晶石2
    const b = computeApBudget(300, 150, 0)
    expect(b.totalRestores).toBe(2)
    expect(b.goldenFruitUsed).toBe(0)
    expect(b.quartzCount).toBe(2)
    expect(b.yen).toBe(Math.round(2 * QUARTZ_UNIT_YEN))
  })

  it('端数は切り上げ（全回復単位）', () => {
    // needAp=301, maxAp=150 → ceil(301/150)=3
    expect(computeApBudget(301, 150, 0).totalRestores).toBe(3)
  })

  it('果実が一部充当、残りを聖晶石', () => {
    // needAp=600, maxAp=150 → 4全回復, 果実1 → 聖晶石3
    const b = computeApBudget(600, 150, 1)
    expect(b.totalRestores).toBe(4)
    expect(b.goldenFruitUsed).toBe(1)
    expect(b.quartzCount).toBe(3)
  })

  it('果実が過剰なら聖晶石0（充当は必要数まで）', () => {
    const b = computeApBudget(300, 150, 10)
    expect(b.totalRestores).toBe(2)
    expect(b.goldenFruitUsed).toBe(2)
    expect(b.quartzCount).toBe(0)
    expect(b.yen).toBe(0)
  })

  it('過不足ちょうど（needAp が maxAp の倍数）', () => {
    const b = computeApBudget(450, 150, 0)
    expect(b.totalRestores).toBe(3)
    expect(b.quartzCount).toBe(3)
  })

  it('maxAp 不正値はクランプ', () => {
    expect(computeApBudget(100, 0, 0).maxAp).toBe(1)
    expect(computeApBudget(100, -10, 0).maxAp).toBe(1)
  })
})

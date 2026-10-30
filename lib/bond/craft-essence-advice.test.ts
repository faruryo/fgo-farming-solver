import { describe, expect, it } from 'vitest'
import type { MaterialCatalogBondUpCraftEssence } from '../material-catalog'
import { adviseBondCraftEssences } from './craft-essence-advice'

let nextId = 1
const essence = (
  cost: number,
  target: MaterialCatalogBondUpCraftEssence['target'],
  rate: number,
  add: number,
  collectionNo = nextId,
): MaterialCatalogBondUpCraftEssence => {
  const id = nextId++
  return { id, collectionNo, name: `礼装${id}`, rarity: 4, cost, face: `f_${id}.png`, target, rate, add }
}

const many = (count: number, make: (collectionNo: number) => MaterialCatalogBondUpCraftEssence, from: number) =>
  Array.from({ length: count }, (_, i) => make(from + i))

// 実データ(イベント限定を除く)の8種類と件数
const REAL_ESSENCES = [
  ...many(9, no => essence(5, 'party', 0, 50, no), 100),
  essence(5, 'self', 0, 50, 200),
  ...many(21, no => essence(9, 'party', 20, 0, no), 300),
  ...many(7, no => essence(9, 'party', 100, 0, no), 400),
  ...many(3, no => essence(12, 'party', 25, 0, no), 500),
  ...many(5, no => essence(12, 'party', 50, 0, no), 600),
  essence(12, 'party', 100, 0, 700),
  ...many(12, no => essence(12, 'party', 200, 0, no), 800),
]

const fiveStars = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1, cost: 16 }))

describe('adviseBondCraftEssences', () => {
  it('puts a 20% party essence on each servant when cost allows', () => {
    const advice = adviseBondCraftEssences({ servants: fiveStars(3), basePoints: 3797, maxCost: 118, essences: REAL_ESSENCES })
    expect(advice.kind).toBe('ok')
    if (advice.kind !== 'ok') return
    expect(advice.assignments.map(a => [a.essence?.cost, a.essence?.rate, a.points])).toEqual([
      [12, 200, 6075],
      [12, 200, 6075],
      [12, 200, 6075],
    ])
    expect(advice.total).toBe(18225)
    expect(advice.baseTotal).toBe(11391)
    expect(advice.usedCost).toBe(84)
    expect(advice.maxCost).toBe(118)
  })

  it('fits only a cheap fixed party essence when cost is tight', () => {
    const advice = adviseBondCraftEssences({ servants: fiveStars(3), basePoints: 3797, maxCost: 56, essences: REAL_ESSENCES })
    if (advice.kind !== 'ok') throw new Error(advice.kind)
    expect(advice.assignments.map(a => a.points)).toEqual([3847, 3847, 3847])
    expect(advice.assignments[0].essence).toMatchObject({ cost: 5, target: 'party', add: 50 })
    expect(advice.assignments.slice(1).map(a => a.essence)).toEqual([null, null])
    expect(advice.total).toBe(11541)
    expect(advice.usedCost).toBe(53)
  })

  it('reports the servant cost when servants alone exceed the limit', () => {
    expect(adviseBondCraftEssences({ servants: fiveStars(4), basePoints: 3797, maxCost: 56, essences: REAL_ESSENCES }))
      .toEqual({ kind: 'overCost', servantCost: 64, maxCost: 56 })
  })

  it('reports servants whose cost is unknown', () => {
    const servants = [{ id: 1, cost: 16 }, { id: 2 }, { id: 3, cost: undefined }]
    expect(adviseBondCraftEssences({ servants, basePoints: 3797, maxCost: 118, essences: REAL_ESSENCES }))
      .toEqual({ kind: 'unknownCost', servantIds: [2, 3] })
  })

  it('suggests no essence when servant cost equals the limit', () => {
    const advice = adviseBondCraftEssences({ servants: fiveStars(3), basePoints: 3797, maxCost: 48, essences: REAL_ESSENCES })
    if (advice.kind !== 'ok') throw new Error(advice.kind)
    expect(advice.assignments.map(a => a.essence)).toEqual([null, null, null])
    expect(advice.total).toBe(advice.baseTotal)
    expect(advice.usedCost).toBe(48)
  })

  it('uses the lowest collection numbers of the same effect and lists the rest as alternatives', () => {
    const advice = adviseBondCraftEssences({ servants: fiveStars(3), basePoints: 3797, maxCost: 118, essences: REAL_ESSENCES })
    if (advice.kind !== 'ok') throw new Error(advice.kind)
    expect(advice.assignments.map(a => a.essence?.collectionNo)).toEqual([800, 801, 802])
    for (const assignment of advice.assignments) {
      expect(assignment.alternatives.map(e => e.collectionNo)).toEqual([803, 804, 805, 806, 807, 808, 809, 810, 811])
    }
  })

  it('prefers the cheaper combination when totals tie, then the one with fewer essences', () => {
    // 基本10では 20%(+2) と 固定+2 が同じ合計になる
    const cheaper = adviseBondCraftEssences({
      servants: [{ id: 1, cost: 0 }],
      basePoints: 10,
      maxCost: 100,
      essences: [essence(12, 'party', 200, 0), essence(5, 'party', 0, 2)],
    })
    if (cheaper.kind !== 'ok') throw new Error(cheaper.kind)
    expect(cheaper.assignments[0].essence).toMatchObject({ cost: 5 })

    // 増加率 4 は基本 10 では切り捨てで 0 になり、付けても付けなくても同じ
    const fewer = adviseBondCraftEssences({
      servants: [{ id: 1, cost: 0 }],
      basePoints: 10,
      maxCost: 100,
      essences: [essence(5, 'party', 4, 0)],
    })
    if (fewer.kind !== 'ok') throw new Error(fewer.kind)
    expect(fewer.assignments[0].essence).toBeNull()
    expect(fewer.usedCost).toBe(0)
  })

  it('prefers fewer essences when total and cost both tie', () => {
    const tie = adviseBondCraftEssences({
      servants: [{ id: 1, cost: 0 }, { id: 2, cost: 0 }],
      basePoints: 10,
      maxCost: 100,
      // 増加率10%×1枚(コスト10) と 5%×2枚(コスト5×2) は合計もコストも同じ
      essences: [essence(10, 'party', 100, 0), essence(5, 'party', 50, 0), essence(5, 'party', 50, 0)],
    })
    if (tie.kind !== 'ok') throw new Error(tie.kind)
    expect(tie.assignments.map(a => a.essence?.cost ?? null)).toEqual([10, null])
    expect(tie.total).toBe(22)
  })

  it('attaches a self essence to the first servant and counts its amount only there', () => {
    const advice = adviseBondCraftEssences({
      servants: [{ id: 1, cost: 16 }, { id: 2, cost: 16 }],
      basePoints: 1000,
      maxCost: 50,
      essences: [essence(9, 'party', 20, 0), essence(5, 'self', 0, 50)],
    })
    if (advice.kind !== 'ok') throw new Error(advice.kind)
    expect(advice.assignments.map(a => [a.servantId, a.essence?.target, a.points])).toEqual([
      [1, 'self', 1070],
      [2, 'party', 1020],
    ])
    expect(advice.total).toBe(2090)
    expect(advice.usedCost).toBe(46)
  })
})

import { describe, expect, it } from 'vitest'
import type { MaterialCatalogBondUpCraftEssence } from '../material-catalog'
import { adviseBondCraftEssences, type CraftEssenceAdviceServant } from './craft-essence-advice'

type Essence = MaterialCatalogBondUpCraftEssence

let nextId = 1
const essence = (
  cost: number,
  target: Essence['target'],
  rate: number,
  add: number,
  collectionNo = nextId,
  { appliesTo = [], name = `礼装${collectionNo}` }: { appliesTo?: number[][]; name?: string } = {},
): Essence => {
  const id = nextId++
  return {
    id,
    collectionNo,
    name,
    rarity: 4,
    cost,
    face: `f_${id}.png`,
    target,
    rate,
    add,
    appliesTo,
    ...(appliesTo.length ? { appliesToLabel: `〔${name}〕` } : {}),
  }
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i)

const CASTER = 104
const SABER = 100
const NEUTRAL = 302
const BEAST = 2821

// 実データ(イベント限定を除く59件)の効果・コスト・条件と図鑑番号
const REAL_ESSENCES: Essence[] = [
  ...range(99, 9).map(no => essence(5, 'party', 0, 50, no)),
  essence(5, 'self', 0, 50, 108, { name: '英霊肖像:ダレイオス三世' }),
  essence(12, 'party', 100, 0, 330, { name: 'カルデア・ランチタイム' }),
  ...[910, 1080, 1121, 1149, 1410].map(no => essence(12, 'party', 50, 0, no, { name: no === 910 ? 'カルデア・ティータイム' : undefined })),
  ...[1565, 1605, 1726].map(no => essence(12, 'party', 25, 0, no)),
  essence(12, 'party', 200, 0, 1949, { appliesTo: [[BEAST]], name: 'ＮＦＦから愛をこめて' }),
  essence(12, 'party', 200, 0, 2020, { appliesTo: [[2654]] }),
  essence(12, 'party', 200, 0, 2052, { appliesTo: [[300, 303]] }),
  essence(12, 'party', 200, 0, 2124, { appliesTo: [[CASTER]], name: '手稿の翼' }),
  essence(12, 'party', 200, 0, 2142, { appliesTo: [[103]] }),
  essence(12, 'party', 200, 0, 2209, { appliesTo: [[2780]] }),
  essence(12, 'party', 200, 0, 2233, { appliesTo: [[300, 2]] }),
  essence(12, 'party', 200, 0, 2437, { appliesTo: [[304], [203]] }),
  essence(12, 'party', 200, 0, 2509, { appliesTo: [[301, 2858], [2801200]] }),
  essence(12, 'party', 200, 0, 2583, { appliesTo: [[NEUTRAL]], name: '記憶の大図書館' }),
  essence(12, 'party', 200, 0, 2607, { appliesTo: [[SABER]], name: '流転の剣聖' }),
  essence(12, 'party', 200, 0, 2701, { appliesTo: [[105]] }),
  ...range(1973, 7).map(no => essence(9, 'party', 100, 0, no, { appliesTo: [[2883]] })),
  ...range(2512, 21).map(no => essence(9, 'party', 20, 0, no)),
]

const servant = (id: number, traits?: number[], ascensionTraits?: number[][]): CraftEssenceAdviceServant => ({
  id,
  cost: 16,
  ...(traits ? { traits } : {}),
  ...(ascensionTraits ? { ascensionTraits } : {}),
})

const okAdvice = (...args: Parameters<typeof adviseBondCraftEssences>) => {
  const advice = adviseBondCraftEssences(...args)
  if (advice.kind !== 'ok') throw new Error(advice.kind)
  return advice
}

const chosenNames = (advice: ReturnType<typeof okAdvice>) =>
  advice.assignments.flatMap(a => (a.essence ? [a.essence.name] : [])).sort((a, b) => a.localeCompare(b))

describe('adviseBondCraftEssences', () => {
  it('puts the caster essence and the best party essences on casters when cost allows', () => {
    const advice = okAdvice({
      servants: [1, 2, 3].map(id => servant(id, [CASTER])),
      basePoints: 3797,
      maxCost: 118,
      essences: REAL_ESSENCES,
    })
    expect(chosenNames(advice)).toEqual(['カルデア・ティータイム', 'カルデア・ランチタイム', '手稿の翼'])
    expect(advice.assignments.map(a => a.points)).toEqual([5125, 5125, 5125])
    expect(advice.total).toBe(15375)
    expect(advice.baseTotal).toBe(11391)
    expect(advice.usedCost).toBe(84)
    expect(advice.maxCost).toBe(118)
    expect(advice.assignments.map(a => a.countedStage)).toEqual([null, null, null])
  })

  it('counts a conditional essence only for the servants it applies to', () => {
    const advice = okAdvice({
      servants: [servant(1, [CASTER]), servant(2, [CASTER]), servant(3, [SABER])],
      basePoints: 3797,
      maxCost: 72,
      essences: REAL_ESSENCES,
    })
    expect(chosenNames(advice)).toEqual(['カルデア・ランチタイム', '手稿の翼'])
    expect(advice.assignments.map(a => a.points)).toEqual([4936, 4936, 4176])
    expect(advice.total).toBe(14048)
  })

  it('never uses or lists an essence that applies to none of the servants', () => {
    const advice = okAdvice({ servants: [servant(1, [SABER])], basePoints: 3797, maxCost: 118, essences: REAL_ESSENCES })
    const listed = advice.assignments.flatMap(a => [a.essence, ...a.alternatives]).map(e => e?.name)
    expect(listed).not.toContain('手稿の翼')
    expect(advice.assignments[0].essence?.name).toBe('流転の剣聖')
  })

  it('counts only essences for everyone on a servant without traits', () => {
    const advice = okAdvice({
      servants: [servant(1, [CASTER]), servant(2)],
      basePoints: 3797,
      maxCost: 118,
      essences: REAL_ESSENCES,
    })
    expect(chosenNames(advice)).toEqual(['カルデア・ランチタイム', '手稿の翼'])
    // 特性のないサーヴァントは全員に効く10%だけ
    expect(advice.assignments.map(a => a.points)).toEqual([4936, 4176])
  })

  it('skips essences without a condition', () => {
    const advice = okAdvice({
      servants: [servant(1, [CASTER])],
      basePoints: 1000,
      maxCost: 100,
      essences: [{ ...essence(12, 'party', 200, 0), appliesTo: undefined }],
    })
    expect(advice.assignments[0].essence).toBeNull()
  })

  it('fits only a cheap fixed party essence when cost is tight', () => {
    const advice = okAdvice({ servants: [1, 2, 3].map(id => servant(id)), basePoints: 3797, maxCost: 56, essences: REAL_ESSENCES })
    expect(advice.assignments.map(a => a.points)).toEqual([3847, 3847, 3847])
    expect(advice.assignments[0].essence).toMatchObject({ cost: 5, target: 'party', add: 50 })
    expect(advice.assignments.slice(1).map(a => a.essence)).toEqual([null, null])
    expect(advice.total).toBe(11541)
    expect(advice.usedCost).toBe(53)
  })

  it('lists essences with another condition as alternatives only when they apply to the same servants', () => {
    const advice = okAdvice({
      servants: [servant(1, [CASTER, NEUTRAL]), servant(2, [SABER])],
      basePoints: 3797,
      maxCost: 56,
      essences: REAL_ESSENCES,
    })
    expect(advice.total).toBe(9112)
    expect(advice.usedCost).toBe(56)
    expect(chosenNames(advice)).toEqual(['カルデア・ランチタイム', '手稿の翼'])
    const manuscript = advice.assignments.find(a => a.essence?.name === '手稿の翼')
    expect(manuscript?.alternatives.map(e => e.name)).toEqual(['記憶の大図書館'])
    expect(advice.assignments.flatMap(a => a.alternatives).map(e => e.name)).not.toContain('流転の剣聖')
  })

  it('picks the lowest collection numbers when total, cost and count tie', () => {
    // 基本1000では〔キャスター〕20%+〔セイバー〕20%、全員10%+〔キャスター〕20%、全員10%+〔セイバー〕20% が同じ合計になる
    const a = essence(12, 'party', 200, 0, 30, { appliesTo: [[CASTER]] })
    const b = essence(12, 'party', 100, 0, 5)
    const c = essence(12, 'party', 200, 0, 20, { appliesTo: [[SABER]] })
    const d = essence(12, 'party', 100, 0, 10, { appliesTo: [[SABER]] })
    const advice = okAdvice({
      servants: [servant(1, [CASTER]), servant(2, [SABER])],
      basePoints: 1000,
      maxCost: 100,
      essences: [a, c, d, b],
    })
    expect(advice.assignments.map(x => x.essence?.collectionNo).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([5, 20])
  })

  it('reports the servant cost when servants alone exceed the limit', () => {
    expect(adviseBondCraftEssences({ servants: [1, 2, 3, 4].map(id => servant(id)), basePoints: 3797, maxCost: 56, essences: REAL_ESSENCES }))
      .toEqual({ kind: 'overCost', servantCost: 64, maxCost: 56 })
  })

  it('reports servants whose cost is unknown', () => {
    const servants = [{ id: 1, cost: 16 }, { id: 2 }, { id: 3, cost: undefined }]
    expect(adviseBondCraftEssences({ servants, basePoints: 3797, maxCost: 118, essences: REAL_ESSENCES }))
      .toEqual({ kind: 'unknownCost', servantIds: [2, 3] })
  })

  it('suggests no essence when servant cost equals the limit', () => {
    const advice = okAdvice({ servants: [1, 2, 3].map(id => servant(id)), basePoints: 3797, maxCost: 48, essences: REAL_ESSENCES })
    expect(advice.assignments.map(a => a.essence)).toEqual([null, null, null])
    expect(advice.total).toBe(advice.baseTotal)
    expect(advice.usedCost).toBe(48)
  })

  it('uses the lowest collection numbers of the same effect and lists the rest as alternatives', () => {
    const advice = okAdvice({ servants: [1, 2, 3].map(id => servant(id)), basePoints: 3797, maxCost: 118, essences: REAL_ESSENCES })
    // 全員に効く10%と5%×2枚。5%は図鑑番号の小さい2枚を使う
    expect(advice.assignments.map(a => a.essence?.collectionNo)).toEqual([330, 910, 1080])
    expect(advice.assignments.slice(1).map(a => a.alternatives.map(e => e.collectionNo))).toEqual([
      [1121, 1149, 1410],
      [1121, 1149, 1410],
    ])
  })

  it('prefers the cheaper combination when totals tie, then the one with fewer essences', () => {
    // 基本10では 20%(+2) と 固定+2 が同じ合計になる
    const cheaper = okAdvice({
      servants: [{ id: 1, cost: 0 }],
      basePoints: 10,
      maxCost: 100,
      essences: [essence(12, 'party', 200, 0), essence(5, 'party', 0, 2)],
    })
    expect(cheaper.assignments[0].essence).toMatchObject({ cost: 5 })

    // 増加率 4 は基本 10 では切り捨てで 0 になり、付けても付けなくても同じ
    const fewer = okAdvice({ servants: [{ id: 1, cost: 0 }], basePoints: 10, maxCost: 100, essences: [essence(5, 'party', 4, 0)] })
    expect(fewer.assignments[0].essence).toBeNull()
    expect(fewer.usedCost).toBe(0)
  })

  it('prefers fewer essences when total and cost both tie', () => {
    const tie = okAdvice({
      servants: [{ id: 1, cost: 0 }, { id: 2, cost: 0 }],
      basePoints: 10,
      maxCost: 100,
      // 増加率10%×1枚(コスト10) と 5%×2枚(コスト5×2) は合計もコストも同じ
      essences: [essence(10, 'party', 100, 0), essence(5, 'party', 50, 0), essence(5, 'party', 50, 0)],
    })
    expect(tie.assignments.map(a => a.essence?.cost ?? null)).toEqual([10, null])
    expect(tie.total).toBe(22)
  })

  it('attaches a self essence to the first servant and counts its amount only there', () => {
    const advice = okAdvice({
      servants: [{ id: 1, cost: 16 }, { id: 2, cost: 16 }],
      basePoints: 1000,
      maxCost: 50,
      essences: [essence(9, 'party', 20, 0), essence(5, 'self', 0, 50)],
    })
    expect(advice.assignments.map(a => [a.servantId, a.essence?.target, a.points])).toEqual([
      [1, 'self', 1070],
      [2, 'party', 1020],
    ])
    expect(advice.total).toBe(2090)
    expect(advice.usedCost).toBe(46)
  })

  it('attaches a conditional self essence only to a matching servant, no more times than it applies', () => {
    const selfCasters = [essence(5, 'self', 0, 50, 1, { appliesTo: [[CASTER]] }), essence(5, 'self', 0, 50, 2, { appliesTo: [[CASTER]] })]
    const advice = okAdvice({
      servants: [servant(1, [SABER]), servant(2, [CASTER])],
      basePoints: 1000,
      maxCost: 100,
      essences: selfCasters,
    })
    expect(advice.assignments.map(a => [a.servantId, a.essence?.collectionNo ?? null, a.points])).toEqual([
      [1, null, 1000],
      [2, 1, 1050],
    ])
    expect(advice.assignments[1].alternatives.map(e => e.collectionNo)).toEqual([2])
  })

  describe('ascension stages', () => {
    // A は第1・第2再臨で〔中立〕、第3・最終再臨で〔ケモノ科〕
    const UNRELATED = 9001
    const servantA = servant(1, [UNRELATED], [
      [UNRELATED, NEUTRAL],
      [UNRELATED, NEUTRAL],
      [UNRELATED, BEAST],
      [UNRELATED, BEAST],
    ])
    const others = [servant(2, [UNRELATED]), servant(3, [UNRELATED])]

    it('counts each servant at its single best stage', () => {
      const advice = okAdvice({ servants: [servantA, ...others], basePoints: 3797, maxCost: 118, essences: REAL_ESSENCES })
      expect(chosenNames(advice)).toEqual(['ＮＦＦから愛をこめて', 'カルデア・ティータイム', 'カルデア・ランチタイム'])
      expect(advice.assignments.map(a => a.points)).toEqual([5125, 4366, 4366])
      // 〔中立〕と〔ケモノ科〕の両方を A に数えた 14,047 にはならない
      expect(advice.total).toBe(13857)
      expect(advice.assignments.map(a => a.countedStage)).toEqual([2, null, null])
      const nff = advice.assignments.find(a => a.essence?.name === 'ＮＦＦから愛をこめて')
      expect(nff?.stageNotes).toEqual([{ servantId: 1, stages: [2, 3] }])
      const lunch = advice.assignments.find(a => a.essence?.name === 'カルデア・ランチタイム')
      expect(lunch?.stageNotes).toEqual([])
    })

    it('does not list an essence with the same condition but other stages as an alternative', () => {
      const early = essence(12, 'party', 200, 0, 1, { appliesTo: [[NEUTRAL]] })
      const late = essence(12, 'party', 200, 0, 2, { appliesTo: [[BEAST]] })
      const advice = okAdvice({ servants: [servantA], basePoints: 1000, maxCost: 100, essences: [late, early] })
      expect(advice.assignments[0].essence?.collectionNo).toBe(1)
      expect(advice.assignments[0].alternatives).toEqual([])
      expect(advice.assignments[0].countedStage).toBe(0)
      expect(advice.assignments[0].stageNotes).toEqual([{ servantId: 1, stages: [0, 1] }])
    })

    it('treats the stages of a servant without stage traits as its base traits', () => {
      const advice = okAdvice({
        servants: [servant(1, [CASTER])],
        basePoints: 1000,
        maxCost: 100,
        essences: [essence(12, 'party', 200, 0, 1, { appliesTo: [[CASTER]] })],
      })
      expect(advice.assignments[0]).toMatchObject({ points: 1200, countedStage: null, stageNotes: [] })
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  continuousOptimalCost,
  priceCandidates,
  allocateAndMeasure,
  allocateGreedy,
  CandidateRef,
} from './material-selection-advisor'
import { Drops } from './get-drops'
import { Localized } from './get-local-items'
import { Item, Quest } from '../interfaces/fgodrop'

const item = (id: string, atlasId?: number): Localized<Item> => ({
  id,
  category: '銅素材',
  name: `item-${id}`,
  largeCategory: '強化素材',
  shortName: id,
  atlasId,
})

const quest = (id: string, ap: number): Quest => ({
  id,
  section: 'Daily',
  area: 'area',
  name: `quest-${id}`,
  ap,
})

const drops = (overrides: Partial<Drops> = {}): Drops => ({
  items: [],
  quests: [],
  drop_rates: [],
  campaigns: [],
  ...overrides,
})

// シナリオ: Q1 は a と b を 1.0/周 で落とす。a の唯一の供給源。
// need a=10, b=5 を周回最小化すると Q1×10 → a10/b10。b は a 集めのついでに揃う(余剰5)。
//   - a を 1 減らす → Q1×9 → 周回 9。a は拘束 → 1個あたり 1 周回削減。
//   - b を 1 減らす → 依然 Q1×10(a が拘束)→ 周回 10。b は非拘束 → 削減 0(byproduct)。
const scenario = () =>
  drops({
    items: [item('a', 1), item('b', 2)],
    quests: [quest('Q1', 20)],
    drop_rates: [
      { quest_id: 'Q1', item_id: 'a', drop_rate: 1.0 },
      { quest_id: 'Q1', item_id: 'b', drop_rate: 1.0 },
    ],
  })

const QIDS = ['Q1']

describe('continuousOptimalCost', () => {
  it('周回モードは総周回数(連続解)を返す', () => {
    const d = scenario()
    expect(continuousOptimalCost(d, { a: 10, b: 5 }, QIDS, 'turn')).toBeCloseTo(10)
    expect(continuousOptimalCost(d, { a: 9, b: 5 }, QIDS, 'turn')).toBeCloseTo(9)
  })

  it('AP モードは総AP(連続解)を返す', () => {
    const d = scenario()
    expect(continuousOptimalCost(d, { a: 10, b: 5 }, QIDS, 'ap')).toBeCloseTo(200)
  })

  it('need が空なら 0', () => {
    expect(continuousOptimalCost(scenario(), {}, QIDS, 'turn')).toBe(0)
  })

  it('ドロップデータの無いアイテムは制約から除外する', () => {
    // b のみ need かつ b にドロップ無し → 制約が無くなり 0(infeasible にしない)。
    const d = drops({
      items: [item('a', 1)],
      quests: [quest('Q1', 20)],
      drop_rates: [{ quest_id: 'Q1', item_id: 'a', drop_rate: 1.0 }],
    })
    expect(continuousOptimalCost(d, { z: 5 }, QIDS, 'turn')).toBe(0)
  })
})

describe('priceCandidates (限界削減量 = シャドウプライス)', () => {
  it('拘束素材は正、ついで充足の素材は 0 と評価する', () => {
    const d = scenario()
    const candidates: CandidateRef[] = [
      { id: '1', shortId: 'a', deficiency: 10 },
      { id: '2', shortId: 'b', deficiency: 5 },
    ]
    const pricing = priceCandidates(d, { a: 10, b: 5 }, candidates, 'turn', QIDS)
    expect(pricing.baseline).toBeCloseTo(10)
    expect(pricing.valueByShortId['a']).toBeCloseTo(1) // 拘束 → 1周回/個
    expect(pricing.valueByShortId['b']).toBeCloseTo(0) // 非拘束(ついで)→ 0
  })

  it('ドロップデータが無い素材は hasDropData=false・価値0', () => {
    const d = scenario()
    const candidates: CandidateRef[] = [{ id: '9', shortId: 'qp', deficiency: 3 }]
    const pricing = priceCandidates(d, { a: 10, b: 5, qp: 3 }, candidates, 'turn', QIDS)
    expect(pricing.hasDropData['qp']).toBe(false)
    expect(pricing.valueByShortId['qp']).toBe(0)
  })
})

describe('allocateAndMeasure', () => {
  const d = scenario()
  const candidates: CandidateRef[] = [
    { id: '1', shortId: 'a', deficiency: 10 },
    { id: '2', shortId: 'b', deficiency: 5 },
  ]
  const fullNeed = { a: 10, b: 5 }

  it('ついで充足の素材を避け、拘束素材へ配分する', () => {
    const pricing = priceCandidates(d, fullNeed, candidates, 'turn', QIDS)
    const res = allocateAndMeasure(d, fullNeed, candidates, pricing, 3, 'turn', QIDS)
    const a = res.allocations.find(x => x.shortId === 'a')!
    const b = res.allocations.find(x => x.shortId === 'b')!
    expect(a.allocated).toBe(3) // 拘束 a に 3 個
    expect(b.allocated).toBe(0) // byproduct b には 0
    expect(b.byproduct).toBe(true)
    // 厳密な合算削減: baseline 10 − optimal(a=7,b=5)=7 → 3 周回。
    expect(res.totalSaved).toBeCloseTo(3)
  })

  it('byproduct のみを候補にすると配分 0・削減 0', () => {
    const onlyB: CandidateRef[] = [{ id: '2', shortId: 'b', deficiency: 5 }]
    const pricing = priceCandidates(d, fullNeed, onlyB, 'turn', QIDS)
    const res = allocateAndMeasure(d, fullNeed, onlyB, pricing, 5, 'turn', QIDS)
    expect(res.totalAllocated).toBe(0)
    expect(res.totalSaved).toBe(0)
    expect(res.allocations[0].byproduct).toBe(true)
  })
})

describe('allocateGreedy', () => {
  it('コストが高い素材から不足分を上限に割り当てる', () => {
    const result = allocateGreedy(
      [
        { id: 'cheap', deficiency: 10, cost: 30 },
        { id: 'expensive', deficiency: 5, cost: 100 },
      ],
      8,
    )
    const expensive = result.allocations.find(a => a.id === 'expensive')!
    const cheap = result.allocations.find(a => a.id === 'cheap')!
    expect(expensive.allocated).toBe(5)
    expect(cheap.allocated).toBe(3)
    expect(result.totalAllocated).toBe(8)
    expect(result.totalSaved).toBeCloseTo(5 * 100 + 3 * 30)
    expect(result.leftover).toBe(0)
  })

  it('総数が不足合計を上回ると余りが leftover になる', () => {
    const result = allocateGreedy([{ id: 'a', deficiency: 3, cost: 50 }], 10)
    expect(result.allocations[0].allocated).toBe(3)
    expect(result.leftover).toBe(7)
  })

  it('コスト0/null は割り当て対象外', () => {
    const result = allocateGreedy(
      [
        { id: 'zero', deficiency: 5, cost: 0 },
        { id: 'ok', deficiency: 5, cost: 20 },
      ],
      4,
    )
    expect(result.allocations.find(a => a.id === 'zero')!.allocated).toBe(0)
    expect(result.allocations.find(a => a.id === 'ok')!.allocated).toBe(4)
  })

  it('総数は0以上の整数にクランプされる', () => {
    expect(allocateGreedy([{ id: 'a', deficiency: 5, cost: 10 }], -3).totalAllocated).toBe(0)
    expect(allocateGreedy([{ id: 'a', deficiency: 5, cost: 10 }], 2.9).totalAllocated).toBe(2)
  })
})

import { describe, it, expect } from 'vitest'
import {
  computeItemEfficiencies,
  allocateGreedy,
  computeAllocation,
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

const quest = (id: string, ap: number, waveCount: number): Quest => ({
  id,
  section: 'Daily',
  area: 'area',
  name: `quest-${id}`,
  ap,
  waveCount,
})

const drops = (overrides: Partial<Drops> = {}): Drops => ({
  items: [],
  quests: [],
  drop_rates: [],
  campaigns: [],
  ...overrides,
})

describe('computeItemEfficiencies', () => {
  it('各アイテムの最良コスト(AP/個・周回/個)を逆算し atlasId キーで返す', () => {
    const data = drops({
      items: [item('a', 100)],
      quests: [quest('q1', 40, 3), quest('q2', 20, 1)],
      drop_rates: [
        { quest_id: 'q1', item_id: 'a', drop_rate: 0.4 }, // ap: 100/個, turn: 7.5/個
        { quest_id: 'q2', item_id: 'a', drop_rate: 0.5 }, // ap: 40/個,  turn: 2/個
      ],
    })
    const eff = computeItemEfficiencies(data)
    const a = eff.get('100')
    expect(a).toBeDefined()
    // AP/個 は最小(=効率最大)を採用: q2 の 20/0.5 = 40
    expect(a?.apCost).toBeCloseTo(40)
    // 周回/個 も最小を採用: q2 の 1/0.5 = 2
    expect(a?.turnCost).toBeCloseTo(2)
  })

  it('ドロップデータが存在しないアイテムは null を返す', () => {
    const data = drops({
      items: [item('qp', 5)],
      quests: [quest('q1', 40, 3)],
      drop_rates: [],
    })
    const eff = computeItemEfficiencies(data)
    expect(eff.get('5')).toEqual({ apCost: null, turnCost: null })
  })

  it('atlasId が無いアイテムは短縮IDをキーにフォールバックする', () => {
    const data = drops({
      items: [item('x')],
      quests: [quest('q1', 30, 2)],
      drop_rates: [{ quest_id: 'q1', item_id: 'x', drop_rate: 0.3 }],
    })
    const eff = computeItemEfficiencies(data)
    expect(eff.has('x')).toBe(true)
    expect(eff.get('x')?.apCost).toBeCloseTo(100)
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
    // 高コスト(expensive)を不足上限(5)まで優先 → 残り3を cheap へ
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

  it('ドロップデータ無し(cost=null)は割り当て対象外で excluded になる', () => {
    const result = allocateGreedy(
      [
        { id: 'noData', deficiency: 5, cost: null },
        { id: 'ok', deficiency: 5, cost: 20 },
      ],
      4,
    )
    const noData = result.allocations.find(a => a.id === 'noData')!
    const ok = result.allocations.find(a => a.id === 'ok')!
    expect(noData.excluded).toBe(true)
    expect(noData.allocated).toBe(0)
    expect(ok.allocated).toBe(4)
  })

  it('不足が0の素材には割り当てない', () => {
    const result = allocateGreedy([{ id: 'a', deficiency: 0, cost: 50 }], 5)
    expect(result.allocations[0].allocated).toBe(0)
    expect(result.totalAllocated).toBe(0)
  })

  it('総数は0以上の整数にクランプされる', () => {
    expect(allocateGreedy([{ id: 'a', deficiency: 5, cost: 10 }], -3).totalAllocated).toBe(0)
    expect(allocateGreedy([{ id: 'a', deficiency: 5, cost: 10 }], 2.9).totalAllocated).toBe(2)
  })
})

describe('computeAllocation', () => {
  const candidates = [
    { id: 'a', deficiency: 5, apCost: 100, turnCost: 2 },
    { id: 'b', deficiency: 5, apCost: 40, turnCost: 9 },
  ]

  it('AP モードでは apCost が高い方を優先する', () => {
    const result = computeAllocation(candidates, 5, 'ap')
    expect(result.allocations.find(a => a.id === 'a')!.allocated).toBe(5)
    expect(result.allocations.find(a => a.id === 'b')!.allocated).toBe(0)
  })

  it('周回モードでは turnCost が高い方を優先する', () => {
    const result = computeAllocation(candidates, 5, 'turn')
    expect(result.allocations.find(a => a.id === 'b')!.allocated).toBe(5)
    expect(result.allocations.find(a => a.id === 'a')!.allocated).toBe(0)
  })
})

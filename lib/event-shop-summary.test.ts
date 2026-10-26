import { describe, it, expect } from 'vitest'
import type { EventShopItem } from './master-data/types'
import {
  clampExchangeCount,
  computeShopCurrencyNeeds,
  formatEfficiency,
  groupShopByCurrency,
  orderShopByEfficiency,
  selectAllCurrenciesUpToLimit,
  selectAllUpToLimit,
} from './event-shop-summary'

const entry = (
  itemId: number,
  costItemId: number,
  costAmount: number,
  limitNum: number,
  extra: Partial<EventShopItem> = {},
): EventShopItem => ({ itemId, qty: 1, costItemId, costAmount, limitNum, ...extra })

describe('groupShopByCurrency', () => {
  it('通貨ごとにまとめ、costAmount × limitNum の和を合計にする（通貨は最初に現れた順）', () => {
    const groups = groupShopByCurrency([
      entry(1, 10, 20, 3, { costName: 'うどん', costIcon: 'u.png' }),
      entry(2, 11, 5, 10, { costName: 'むすび' }),
      entry(3, 10, 100, 2, { costName: 'うどん', costIcon: 'u.png' }),
    ])
    expect(groups.map(g => [g.costItemId, g.costName, g.totalCost, g.unlimitedCount])).toEqual([
      [10, 'うどん', 260, 0],
      [11, 'むすび', 50, 0],
    ])
    expect(groups[0]?.costIcon).toBe('u.png')
    expect(groups[0]?.items.map(i => i.itemId)).toEqual([1, 3])
  })

  it('limitNum が 0 の品目は合計に含めず上限なしとして数える', () => {
    const [group] = groupShopByCurrency([entry(1, 10, 20, 3), entry(2, 10, 50, 0), entry(3, 10, 1, 0)])
    expect(group?.totalCost).toBe(60)
    expect(group?.unlimitedCount).toBe(2)
    expect(group?.items).toHaveLength(3)
  })

  it('通貨名が無いエントリーでもまとめられ、costName は undefined', () => {
    const [group] = groupShopByCurrency([entry(1, 10, 20, 3)])
    expect(group?.costItemId).toBe(10)
    expect(group?.costName).toBeUndefined()
    expect(group?.totalCost).toBe(60)
  })

  it('空なら空', () => {
    expect(groupShopByCurrency([])).toEqual([])
  })
})

describe('clampExchangeCount', () => {
  it('在庫上限を超える回数は上限で頭打ち、上限の無い品目は入れた回数', () => {
    expect(clampExchangeCount(entry(1, 10, 20, 3), 5)).toBe(3)
    expect(clampExchangeCount(entry(1, 10, 20, 0), 50)).toBe(50)
    expect(clampExchangeCount(entry(1, 10, 20, 3), -1)).toBe(0)
    expect(clampExchangeCount(entry(1, 10, 20, 3), Number.NaN)).toBe(0)
  })
})

describe('computeShopCurrencyNeeds', () => {
  const shop = [entry(1, 10, 20, 3), entry(2, 11, 5, 0), entry(3, 10, 100, 2)]

  it('品目ごとの回数（上限で頭打ち）から通貨ごとの対価の合計を出し、所持数を引く', () => {
    const needs = computeShopCurrencyNeeds(
      shop,
      new Map([[0, 10], [1, 7], [2, 1]]),
      new Map([[10, 50]]),
    )
    expect(needs).toEqual([
      { costItemId: 10, selectedCost: 160, need: 110 },
      { costItemId: 11, selectedCost: 35, need: 35 },
    ])
  })

  it('所持数で足りると必要量は0', () => {
    const needs = computeShopCurrencyNeeds(shop, new Map([[0, 3], [1, 2]]), new Map([[10, 1000], [11, 10]]))
    expect(needs.map(n => n.need)).toEqual([0, 0])
  })

  it('何も選ばなければ合計も必要量も0', () => {
    expect(computeShopCurrencyNeeds(shop, new Map(), new Map())).toEqual([
      { costItemId: 10, selectedCost: 0, need: 0 },
      { costItemId: 11, selectedCost: 0, need: 0 },
    ])
  })
})

describe('selectAllUpToLimit', () => {
  it('その通貨で在庫上限のある品目を上限にし、上限の無い品目とほかの通貨は変えない', () => {
    const shop = [entry(1, 10, 20, 3), entry(2, 10, 5, 0), entry(3, 11, 100, 2), entry(4, 10, 1, 4)]
    const next = selectAllUpToLimit(shop, new Map([[2, 1]]), 10)
    expect(next.get(0)).toBe(3)
    expect(next.get(1) ?? 0).toBe(0)
    expect(next.get(2)).toBe(1)
    expect(next.get(3)).toBe(4)
  })
})

describe('selectAllCurrenciesUpToLimit', () => {
  const shop = [entry(1, 10, 20, 5), entry(2, 11, 5, 10), entry(3, 10, 1, 0), entry(4, 11, 100, 2), entry(5, 11, 3, 0)]

  it('2通貨の在庫上限のある品目をすべて上限にする', () => {
    const next = selectAllCurrenciesUpToLimit(shop, new Map([[0, 1]]))
    expect(next.get(0)).toBe(5)
    expect(next.get(1)).toBe(10)
    expect(next.get(3)).toBe(2)
  })

  it('在庫上限の無い品目の回数は入れた値のまま', () => {
    const next = selectAllCurrenciesUpToLimit(shop, new Map([[2, 3]]))
    expect(next.get(2)).toBe(3)
    expect(next.has(4)).toBe(false)
  })

  it('鍵は交換所の配列全体の添字で、通貨ごとに selectAllUpToLimit を当てた結果と同じ', () => {
    const counts = new Map([[2, 3], [4, 7], [1, 4]])
    const expected = selectAllUpToLimit(shop, selectAllUpToLimit(shop, counts, 10), 11)
    const next = selectAllCurrenciesUpToLimit(shop, counts)
    expect(next).toEqual(expected)
    expect([...next.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('orderShopByEfficiency', () => {
  const priced = (itemId: number, costAmount: number, qty = 1) => entry(itemId, 10, costAmount, 5, { qty })

  it('効率は qty × AP 換算値 ÷ costAmount', () => {
    const items = [priced(1, 5, 2)]
    const { ranked } = orderShopByEfficiency({ items }, { 1: 50 })
    expect(ranked).toEqual([{ item: items[0], rank: 1, efficiency: 20 }])
  })

  it('効率の高い順に1からの順位を付け、同じ効率は元の順を保つ。品目は配列の要素の参照のまま', () => {
    const items = [priced(1, 1), priced(2, 1), priced(3, 1), priced(4, 1)]
    const { unpriced, ranked } = orderShopByEfficiency({ items }, { 1: 20, 2: 35, 3: 10, 4: 20 })
    expect(unpriced).toEqual([])
    expect(ranked.map(r => [r.item.itemId, r.rank])).toEqual([[2, 1], [1, 2], [4, 3], [3, 4]])
    expect(ranked[0]?.item).toBe(items[1])
  })

  it('AP 換算値の無い品目と costAmount が 0 の品目は元の順で unpriced に入る', () => {
    const items = [priced(1, 1), entry(9, 10, 1, 1), priced(2, 0), entry(8, 10, 1, 1)]
    const { unpriced, ranked } = orderShopByEfficiency({ items }, { 1: 10, 2: 10 })
    expect(unpriced).toEqual([items[1], items[2], items[3]])
    expect(ranked.map(r => r.item)).toEqual([items[0]])
  })

  it('AP 換算値のある品目が無ければ順位を返さない', () => {
    const items = [entry(9, 10, 1, 1), entry(8, 10, 1, 1)]
    expect(orderShopByEfficiency({ items }, {})).toEqual({ unpriced: items, ranked: [] })
  })

  it('同じ itemId で対価の違う品目を別々に扱う', () => {
    const items = [priced(1, 10), priced(1, 2)]
    const { ranked } = orderShopByEfficiency({ items }, { 1: 10 })
    expect(ranked.map(r => [r.item, r.efficiency])).toEqual([[items[1], 5], [items[0], 1]])
  })
})

describe('formatEfficiency', () => {
  it('小数2桁までにし、末尾の0は出さない', () => {
    expect(formatEfficiency(20)).toBe('20')
    expect(formatEfficiency(1.2)).toBe('1.2')
    expect(formatEfficiency(1.0645)).toBe('1.06')
    expect(formatEfficiency(1.0649)).toBe('1.06')
  })
})

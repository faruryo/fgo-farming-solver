import { describe, it, expect } from 'vitest'
import type { EventShopItem } from './master-data/types'
import {
  allocateShortfallOnly,
  clampExchangeCount,
  computeShopShortfall,
  shopItemStatus,
  summarizeShortfall,
  computeShopCurrencyNeeds,
  formatEfficiency,
  groupShopByCurrency,
  isDefaultWanted,
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

  it('サーヴァント扱いの品目も在庫上限の回数にし、通貨の必要量に対価が入る', () => {
    const svtShop = [entry(9700300, 10, 20, 40, { kind: 'svt' }), entry(100, 10, 5, 10)]
    const next = selectAllCurrenciesUpToLimit(svtShop, new Map())
    expect(next.get(0)).toBe(40)
    expect(next.get(1)).toBe(10)
    expect(computeShopCurrencyNeeds(svtShop, next, new Map())).toEqual([
      { costItemId: 10, selectedCost: 850, need: 850 },
    ])
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

  it('サーヴァント扱いの品目は同じ番号の価格があっても効率と順位を持たず、前に並ぶ', () => {
    const items = [priced(1, 1), entry(9305420, 10, 1, 1, { kind: 'svt' })]
    const { unpriced, ranked } = orderShopByEfficiency({ items }, { 1: 10, 9305420: 50 })
    expect(unpriced).toEqual([items[1]])
    expect(ranked.map(r => r.item)).toEqual([items[0]])
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

const needOf = (need: Record<number, number>) => new Map(Object.entries(need).map(([k, v]) => [Number(k), v]))

/** 不足と所持数から状態を決め、不足素材のみの回数を出す。 */
const allocate = (
  shop: EventShopItem[],
  need: Record<number, number>,
  possession: Record<string, number | undefined> = {},
  /** 「要る」の保存のキー。数はアイテムの番号の文字列として扱う。 */
  wanted: (number | string)[] = [],
  /** null は素材カタログを読めていないとき。 */
  planItemIds: ReadonlySet<number> | null = new Set(),
) => {
  const totalNeed = needOf(need)
  const shortfall = computeShopShortfall(totalNeed, possession)
  return allocateShortfallOnly(
    shop,
    shortfall,
    item => shopItemStatus(item, totalNeed, shortfall, planItemIds ?? undefined),
    new Set(wanted.map(String)),
  )
}

const countsOf = (allocation: { counts: ReadonlyMap<number, number> }) => [...allocation.counts.values()]

describe('computeShopShortfall', () => {
  it('総必要数から所持数を引き、0 未満は 0 にする。所持数が欠けている素材は所持 0', () => {
    const shortfall = computeShopShortfall(needOf({ 10: 30, 11: 30, 12: 7 }), { 10: 25, 11: 40, 13: 5 })
    expect([...shortfall]).toEqual([[10, 5], [11, 0], [12, 7]])
  })
})

describe('shopItemStatus', () => {
  const totalNeed = needOf({ 10: 30, 11: 30, 12: 0, 1: 100 })
  const shortfall = computeShopShortfall(totalNeed, { 10: 25, 11: 40 })
  const planIds = new Set([10, 11, 12])

  it('必要数があれば不足の有無で「あと N 個」と「足りている」。集合に入らなくても同じ', () => {
    expect(shopItemStatus({ itemId: 10 }, totalNeed, shortfall, planIds)).toEqual({ kind: 'short', shortfall: 5 })
    expect(shopItemStatus({ itemId: 11 }, totalNeed, shortfall, planIds)).toEqual({ kind: 'enough' })
    expect(shopItemStatus({ itemId: 10 }, totalNeed, shortfall, new Set())).toEqual({ kind: 'short', shortfall: 5 })
    expect(shopItemStatus({ itemId: 10 }, totalNeed, shortfall, undefined)).toEqual({ kind: 'short', shortfall: 5 })
  })

  it('必要数 0 で集合に入る素材は「使わない」、入らない品目は「計画の対象外」', () => {
    expect(shopItemStatus({ itemId: 12 }, totalNeed, shortfall, planIds)).toEqual({ kind: 'unused' })
    expect(shopItemStatus({ itemId: 4001 }, totalNeed, shortfall, planIds)).toEqual({ kind: 'outside' })
  })

  it('集合が undefined なら必要数 0 の品目は状態なし', () => {
    expect(shopItemStatus({ itemId: 12 }, totalNeed, shortfall, undefined)).toBeUndefined()
    expect(shopItemStatus({ itemId: 4001 }, totalNeed, shortfall, undefined)).toBeUndefined()
  })

  it('QP は必要数があっても状態なし', () => {
    expect(shopItemStatus({ itemId: 1 }, totalNeed, shortfall, planIds)).toBeUndefined()
  })

  it('サーヴァント扱いの品目は番号が必要数や集合に入っていても「計画の対象外」、集合が undefined なら状態なし', () => {
    expect(shopItemStatus({ itemId: 10, kind: 'svt' }, totalNeed, shortfall, planIds)).toEqual({ kind: 'outside' })
    expect(shopItemStatus({ itemId: 12, kind: 'svt' }, totalNeed, shortfall, planIds)).toEqual({ kind: 'outside' })
    expect(shopItemStatus({ itemId: 10, kind: 'svt' }, totalNeed, shortfall, undefined)).toBeUndefined()
  })

  it('集合が undefined でも、必要数 0 の伝承結晶は「使わない」、夢火は「計画の対象外」', () => {
    expect(shopItemStatus({ itemId: 6999 }, totalNeed, shortfall, undefined)).toEqual({ kind: 'unused' })
    expect(shopItemStatus({ itemId: 1000 }, totalNeed, shortfall, undefined)).toEqual({ kind: 'outside' })
  })

  it('サーヴァント扱いの同じ番号の品目は既定で交換する品目に含まれない', () => {
    expect(shopItemStatus({ itemId: 6999, kind: 'svt' }, totalNeed, shortfall, undefined)).toBeUndefined()
    expect(shopItemStatus({ itemId: 1000, kind: 'svt' }, totalNeed, shortfall, undefined)).toBeUndefined()
    expect(isDefaultWanted({ itemId: 6999 })).toBe(true)
    expect(isDefaultWanted({ itemId: 1000 })).toBe(true)
    expect(isDefaultWanted({ itemId: 6999, kind: 'svt' })).toBe(false)
    expect(isDefaultWanted({ itemId: 1000, kind: 'svt' })).toBe(false)
  })
})

describe('allocateShortfallOnly', () => {
  it('不足 5・在庫上限 10・1回1個なら 5 回', () => {
    const allocation = allocate([entry(10, 90, 10, 10)], { 10: 30 }, { 10: 25 })
    expect(countsOf(allocation)).toEqual([5])
    expect(allocation.remaining.get(10)).toBe(0)
    expect(allocation.remainders.size).toBe(0)
  })

  it('1回3個なら切り上げて 2 回', () => {
    expect(countsOf(allocate([entry(10, 90, 10, 10, { qty: 3 })], { 10: 5 }))).toEqual([2])
  })

  it('同じ素材の品目が2つなら元の順に 3 と 2', () => {
    expect(countsOf(allocate([entry(10, 90, 10, 3), entry(10, 91, 10, 10)], { 10: 5 }))).toEqual([3, 2])
  })

  it('在庫上限なしなら打ち切らず 7 回', () => {
    expect(countsOf(allocate([entry(10, 90, 10, 0)], { 10: 7 }))).toEqual([7])
  })

  it('不足 15・在庫上限 10 なら残り 5', () => {
    const allocation = allocate([entry(10, 90, 10, 10)], { 10: 15 })
    expect(countsOf(allocation)).toEqual([10])
    expect(allocation.remaining.get(10)).toBe(5)
    expect([...allocation.remainders]).toEqual([[0, 5]])
  })

  it('同じ素材の品目が複数あって残りが出るとき、残りを持つのは元の順で最後の品目', () => {
    const allocation = allocate([entry(10, 90, 10, 3), entry(11, 90, 10, 0), entry(10, 91, 10, 2)], { 10: 9, 11: 1 })
    expect(countsOf(allocation)).toEqual([3, 1, 2])
    expect([...allocation.remainders]).toEqual([[2, 4]])
  })

  it('足りている品目・使わない品目は 0 回', () => {
    const allocation = allocate(
      [entry(10, 90, 10, 10), entry(12, 90, 10, 10)],
      { 10: 30 },
      { 10: 40 },
      [12],
      new Set([10, 12]),
    )
    expect(countsOf(allocation)).toEqual([0, 0])
    expect(allocation.remaining.size).toBe(0)
  })

  it('「要る」の計画の対象外の品目は在庫上限ありで上限、在庫上限なしで 0 回にして挙げる。「要らない」は 0 回', () => {
    const allocation = allocate(
      [entry(5003, 90, 10, 1), entry(94100, 90, 10, 0), entry(4001, 90, 10, 5)],
      {},
      {},
      [5003, 94100],
    )
    expect(countsOf(allocation)).toEqual([1, 0, 0])
    expect([...allocation.unlimitedWanted]).toEqual([1])
  })

  it('「要る」に入っていても、状態なし・使わない品目は 0 回、必要数のある品目は不足の分', () => {
    const shop = [entry(4001, 90, 10, 5), entry(12, 90, 10, 5), entry(10, 90, 10, 10)]
    expect(countsOf(allocate(shop, { 10: 3 }, {}, [4001, 12, 10], null))).toEqual([0, 0, 3])
    expect(countsOf(allocate(shop, { 10: 3 }, {}, [4001, 12, 10], new Set([12])))).toEqual([5, 0, 3])
  })

  it('QP の品目は 0 回で要約に数えない', () => {
    const allocation = allocate([entry(1, 90, 10, 10, { qty: 10000 })], { 1: 50000 }, {}, [1])
    expect(countsOf(allocation)).toEqual([0])
    expect(summarizeShortfall(allocation)).toEqual({ shortMaterials: 0, filledMaterials: 0 })
  })

  it('1回の個数が 0 の品目は 0 回で、割り当てから外れる', () => {
    const allocation = allocate(
      [entry(10, 90, 10, 10, { qty: 0 }), entry(10, 91, 10, 10), entry(4001, 90, 10, 0, { qty: 0 })],
      { 10: 4 },
      {},
      [4001],
    )
    expect(countsOf(allocation)).toEqual([0, 4, 0])
    expect(allocation.unlimitedWanted.size).toBe(0)
  })
})

describe('allocateShortfallOnly（既定で交換する品目）', () => {
  const LORE = 6999
  const FIRE = 1000
  const planIds = new Set([LORE])

  it('必要数 0 の伝承結晶の在庫上限 2・2・1 の3品目は 2・2・1', () => {
    const shop = [entry(LORE, 90, 10, 2), entry(LORE, 90, 10, 2), entry(LORE, 91, 10, 1)]
    expect(countsOf(allocate(shop, {}, {}, [LORE], planIds))).toEqual([2, 2, 1])
  })

  it('夢火の在庫上限 1 の品目は 1', () => {
    expect(countsOf(allocate([entry(FIRE, 90, 10, 1)], {}, {}, [FIRE], planIds))).toEqual([1])
  })

  it('伝承結晶の不足 1・在庫上限 2 なら 2 で、残りは出ない', () => {
    const allocation = allocate([entry(LORE, 90, 10, 2)], { [LORE]: 1 }, {}, [LORE], planIds)
    expect(countsOf(allocation)).toEqual([2])
    expect(allocation.remaining.get(LORE)).toBe(0)
    expect(allocation.remainders.size).toBe(0)
  })

  it('伝承結晶の不足 5・在庫上限 2 なら 2 で、残り 3', () => {
    const allocation = allocate([entry(LORE, 90, 10, 2)], { [LORE]: 5 }, {}, [LORE], planIds)
    expect(countsOf(allocation)).toEqual([2])
    expect([...allocation.remainders]).toEqual([[0, 3]])
  })

  it('必要数 0 の伝承結晶の在庫上限なしの品目は 0 回で、手入力を促す', () => {
    const allocation = allocate([entry(LORE, 90, 10, 0)], {}, {}, [LORE], planIds)
    expect(countsOf(allocation)).toEqual([0])
    expect([...allocation.unlimitedWanted]).toEqual([0])
  })

  it('不足 2 を在庫上限 2 の品目で埋めた後の在庫上限なしの品目は 0 回で、手入力を促す', () => {
    const allocation = allocate(
      [entry(LORE, 90, 10, 2), entry(LORE, 91, 10, 0)],
      { [LORE]: 2 },
      {},
      [LORE],
      planIds,
    )
    expect(countsOf(allocation)).toEqual([2, 0])
    expect([...allocation.unlimitedWanted]).toEqual([1])
    expect(allocation.remainders.size).toBe(0)
  })

  it('「不要」の伝承結晶は不足 1・在庫上限 2 なら 1', () => {
    expect(countsOf(allocate([entry(LORE, 90, 10, 2)], { [LORE]: 1 }, {}, [], planIds))).toEqual([1])
  })

  it('「不要」の伝承結晶（必要数 0）と夢火は 0', () => {
    const allocation = allocate([entry(LORE, 90, 10, 2), entry(FIRE, 90, 10, 1)], {}, {}, [], planIds)
    expect(countsOf(allocation)).toEqual([0, 0])
    expect(allocation.unlimitedWanted.size).toBe(0)
  })
})

describe('allocateShortfallOnly（サーヴァント扱いの品目）', () => {
  const svt = (itemId: number, limitNum: number): EventShopItem => entry(itemId, 90, 10, limitNum, { kind: 'svt' })

  it('在庫上限 100 の種火を「必要」、在庫上限 2 の礼装を「不要」にすると 100 と 0', () => {
    const allocation = allocate([svt(9770500, 100), svt(9306300, 2)], {}, {}, ['svt:9770500'])
    expect(countsOf(allocation)).toEqual([100, 0])
    expect(summarizeShortfall(allocation)).toEqual({ shortMaterials: 0, filledMaterials: 0 })
  })

  it('番号が同じアイテムの品目と「必要」を取り違えない', () => {
    const shop = [entry(9305420, 90, 10, 3), svt(9305420, 2)]
    expect(countsOf(allocate(shop, {}, {}, ['svt:9305420']))).toEqual([0, 2])
    expect(countsOf(allocate(shop, {}, {}, ['9305420']))).toEqual([3, 0])
  })
})

describe('summarizeShortfall', () => {
  it('交換所に品目のある不足の素材 3 つのうち 2 つが埋まる', () => {
    const allocation = allocate(
      [entry(10, 90, 10, 10), entry(11, 90, 10, 10), entry(12, 90, 10, 10), entry(13, 90, 10, 10)],
      { 10: 5, 11: 10, 12: 15, 13: 3, 14: 99 },
      { 13: 3 },
    )
    expect(summarizeShortfall(allocation)).toEqual({ shortMaterials: 3, filledMaterials: 2 })
  })
})

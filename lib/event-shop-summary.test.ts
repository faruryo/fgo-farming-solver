import { describe, it, expect } from 'vitest'
import type { EventShopItem } from './master-data/types'
import {
  allocateShortfallOnly,
  clampExchangeCount,
  computeShopShortfall,
  shopItemStatus,
  summarizeShortfall,
  computeShopCurrencyNeeds,
  countsFromItemKeys,
  countsToItemKeys,
  pickIdTable,
  readShopSavedInputs,
  shopItemKeys,
  formatEfficiency,
  groupShopByCurrency,
  isDefaultWanted,
  orderShopByEfficiency,
  buildShopListRows,
  rowCountOf,
  rowLimit,
  shopRowEntries,
  splitRowCount,
  selectAllCurrenciesUpToLimit,
  selectAllUpToLimit,
  type ShopListRow,
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

// 80632 の形: 武蔵うどん・江戸むすび・東干し柿
const UDON = 94001
const MUSUBI = 94002
const KAKI = 94003
const DANGO = 9306300
const CURRENCY_NAMES = new Map([
  [UDON, '武蔵うどん'],
  [MUSUBI, '江戸むすび'],
  [KAKI, '東干し柿'],
])
const named = (costItemId: number) => CURRENCY_NAMES.get(costItemId) ?? ''
const svt = (itemId: number, costItemId: number, costAmount: number, limitNum: number) =>
  entry(itemId, costItemId, costAmount, limitNum, { kind: 'svt', costName: named(costItemId) })
const shop80632: EventShopItem[] = [
  svt(DANGO, UDON, 100, 2),
  svt(DANGO, MUSUBI, 100, 1),
  svt(DANGO, KAKI, 100, 1),
  svt(9700100, UDON, 150, 1),
  entry(6503, UDON, 5, 3),
  svt(9700100, KAKI, 150, 1),
  entry(6505, KAKI, 5, 3),
]
const rowIndices = (shop: EventShopItem[]) => buildShopListRows(shop).map(r => r.indices)
/** 一覧の k 番目の行（無ければテストを落とす）。 */
const rowAt = (shop: EventShopItem[], k: number): ShopListRow => {
  const row = buildShopListRows(shop).at(k)
  if (!row) throw new Error(`row ${k} not found`)
  return row
}

describe('buildShopListRows', () => {
  it('80632 の形: 月より団子（3通貨）とフォウくん（2通貨）は1行にまとまり、1通貨だけの品目はそのまま。行は交換所の順', () => {
    expect(rowIndices(shop80632)).toEqual([[0, 1, 2], [3, 5], [4], [6]])
    const [dango] = buildShopListRows(shop80632)
    expect(dango?.items).toEqual([shop80632[0], shop80632[1], shop80632[2]])
  })

  it('在庫上限の無い品目（QP 3通貨）はまとめない', () => {
    const shop = [entry(1, UDON, 2, 0), entry(1, MUSUBI, 50, 0), entry(1, KAKI, 50, 0)]
    expect(rowIndices(shop)).toEqual([[0], [1], [2]])
  })

  it('同じ通貨だけで重なる品目はまとめない', () => {
    expect(rowIndices([entry(1, UDON, 10, 2), entry(1, UDON, 20, 3)])).toEqual([[0], [1]])
  })

  it('在庫上限の無い品目が混ざる組と、同じ通貨が重なる組は、どの品目もまとめない', () => {
    expect(rowIndices([entry(1, UDON, 10, 2), entry(1, MUSUBI, 10, 0)])).toEqual([[0], [1]])
    expect(rowIndices([entry(2, UDON, 10, 1), entry(2, UDON, 10, 1), entry(2, MUSUBI, 10, 1)])).toEqual([
      [0],
      [1],
      [2],
    ])
  })

  it('対価が通貨で違う品目（伝承結晶 200・400）はまとめる', () => {
    expect(rowIndices([entry(6999, UDON, 200, 1), entry(6999, MUSUBI, 400, 1)])).toEqual([[0, 1]])
  })

  it('サーヴァント扱いの品目と番号が同じアイテムの品目はまとめない', () => {
    expect(rowIndices([svt(9305420, UDON, 10, 1), entry(9305420, MUSUBI, 10, 1)])).toEqual([[0], [1]])
  })

  it('1回の個数が違う品目はまとめない', () => {
    expect(rowIndices([entry(1, UDON, 10, 1, { qty: 1 }), entry(1, MUSUBI, 10, 1, { qty: 10 })])).toEqual([[0], [1]])
  })
})

describe('splitRowCount と rowCountOf', () => {
  const dango = rowAt(shop80632, 0)
  const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0)
  const withinLimits = (row: ShopListRow, m: Map<number, number>) =>
    shopRowEntries(row).every(({ index, item }) => (m.get(index) ?? 0) <= item.limitNum)

  it('月より団子 3: 合計 3 で、どの品目も在庫上限以下', () => {
    const split = splitRowCount(dango, 3)
    expect(sum(split)).toBe(3)
    expect(withinLimits(dango, split)).toBe(true)
    expect([...split.keys()]).toEqual([0, 1, 2])
  })

  it('サーヴァントコイン（16・16・16）20: 合計 20 で、どの品目も 16 以下', () => {
    const coin = rowAt([entry(1, UDON, 10, 16), entry(1, MUSUBI, 10, 16), entry(1, KAKI, 10, 16)], 0)
    const split = splitRowCount(coin, 20)
    expect(sum(split)).toBe(20)
    expect([...split.values()].every(n => n >= 0 && n <= 16 && Number.isInteger(n))).toBe(true)
  })

  it('月より団子 9 は在庫上限の合計で頭打ちになり 2・1・1、0 はすべて 0', () => {
    expect([...splitRowCount(dango, 9).values()]).toEqual([2, 1, 1])
    expect([...splitRowCount(dango, 0).values()]).toEqual([0, 0, 0])
    expect([...splitRowCount(dango, -3).values()]).toEqual([0, 0, 0])
    expect(sum(splitRowCount(dango, 2.7))).toBe(2)
  })

  it('まとめない行は品目の在庫上限で頭打ち、上限の無い品目は入れた回数', () => {
    const shop = [entry(1, UDON, 10, 3), entry(2, UDON, 10, 0)]
    expect([...splitRowCount(rowAt(shop, 0), 5)]).toEqual([[0, 3]])
    expect([...splitRowCount(rowAt(shop, 1), 50)]).toEqual([[1, 50]])
  })

  it('保存値のような品目ごとの回数（0・1・0）は合計 1、内訳は江戸むすび 1', () => {
    const { count, parts } = rowCountOf(dango, new Map([[0, 0], [1, 1], [2, 0]]))
    expect(count).toBe(1)
    expect(parts.map(p => [p.costName, p.count])).toEqual([['江戸むすび', 1]])
  })

  it('回数の無い品目は 0 として数え、在庫上限を超える値は上限で数える', () => {
    const { count, parts } = rowCountOf(dango, new Map([[0, 5]]))
    expect(count).toBe(2)
    expect(parts.map(p => [p.costItemId, p.count])).toEqual([[UDON, 2]])
  })

  it('rowLimit はまとめた行で在庫上限の合計、上限の無い品目の行で 0', () => {
    expect(rowLimit(dango)).toBe(4)
    expect(rowLimit(rowAt([entry(1, UDON, 10, 0)], 0))).toBe(0)
  })
})

describe('orderShopByEfficiency', () => {
  const priced = (itemId: number, costAmount: number, qty = 1, costItemId = 10) =>
    entry(itemId, costItemId, costAmount, 5, { qty })
  const order = (shop: EventShopItem[], prices: Record<number, number>) =>
    orderShopByEfficiency(buildShopListRows(shop), prices)

  it('効率は qty × AP 換算値 ÷ costAmount', () => {
    const items = [priced(1, 5, 2)]
    const { ranked } = order(items, { 1: 50 })
    expect(ranked.map(r => [r.row.items, r.rank, r.efficiency])).toEqual([[[items[0]], 1, 20]])
  })

  it('通貨の違う品目（7.72・7.63・9）を通貨をまたいで 9 → 7.72 → 7.63 の順位 1・2・3 で並べる', () => {
    const shop = [priced(1, 100, 1, UDON), priced(2, 100, 1, MUSUBI), priced(3, 100, 1, KAKI)]
    const { ranked, unpriced } = order(shop, { 1: 772, 2: 763, 3: 900 })
    expect(unpriced).toEqual([])
    expect(ranked.map(r => [r.row.items[0]?.itemId, r.rank, r.efficiency])).toEqual([
      [3, 1, 9],
      [1, 2, 7.72],
      [2, 3, 7.63],
    ])
  })

  it('AP 換算値の無い品目は効率のある行の後に交換所の順で並ぶ', () => {
    const shop = [entry(9, 10, 1, 1), priced(1, 1), entry(8, 10, 1, 1), priced(2, 0)]
    const { ranked, unpriced } = order(shop, { 1: 10, 2: 10 })
    expect(ranked.map(r => r.row.indices)).toEqual([[1]])
    expect(unpriced.map(r => r.indices)).toEqual([[0], [2], [3]])
  })

  it('対価が通貨で違うまとめた行（通貨 A 対価 5・通貨 B 対価 10、AP 換算値 50）の効率は 10 で、効率 7 の行より前', () => {
    const shop = [priced(2, 1, 1, UDON), priced(1, 5, 1, UDON), priced(1, 10, 1, MUSUBI)]
    const { ranked } = order(shop, { 1: 50, 2: 7 })
    expect(ranked.map(r => [r.row.indices, r.rank, r.efficiency])).toEqual([
      [[1, 2], 1, 10],
      [[0], 2, 7],
    ])
  })

  it('効率が同じ行は交換所の順を保つ。行は配列の要素の参照のまま', () => {
    const items = [priced(1, 1), priced(2, 1), priced(3, 1), priced(4, 1)]
    const { ranked } = order(items, { 1: 20, 2: 35, 3: 10, 4: 20 })
    expect(ranked.map(r => [r.row.items[0]?.itemId, r.rank])).toEqual([[2, 1], [1, 2], [4, 3], [3, 4]])
    expect(ranked[0]?.row.items[0]).toBe(items[1])
  })

  it('効率のある行が無いときは交換所の順のままで順位が無い', () => {
    const items = [entry(9, 10, 1, 1), entry(8, 11, 1, 1)]
    const { ranked, unpriced } = order(items, {})
    expect(ranked).toEqual([])
    expect(unpriced.map(r => r.items[0])).toEqual(items)
  })

  it('サーヴァント扱いの品目は同じ番号の価格があっても効率と順位を持たず、後に並ぶ', () => {
    const items = [entry(9305420, 10, 1, 1, { kind: 'svt' }), priced(1, 1)]
    const { unpriced, ranked } = order(items, { 1: 10, 9305420: 50 })
    expect(unpriced.map(r => r.items[0])).toEqual([items[0]])
    expect(ranked.map(r => r.row.items[0])).toEqual([items[1]])
  })

  it('同じ itemId で対価の違う品目（同じ通貨）を別々の行に扱う', () => {
    const items = [priced(1, 10), priced(1, 2)]
    const { ranked } = order(items, { 1: 10 })
    expect(ranked.map(r => [r.row.items[0], r.efficiency])).toEqual([[items[1], 5], [items[0], 1]])
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

describe('交換回数の品目キー', () => {
  /** 保存して、取り込み直した交換所で読む。 */
  const roundTrip = (before: EventShopItem[], counts: [number, number][], after: EventShopItem[]) =>
    countsFromItemKeys(after, JSON.parse(JSON.stringify(countsToItemKeys(before, new Map(counts)))) as Record<string, number>)

  it('並びが変わっても同じ品目に回数を使い、前に加わった品目は 0（回数なし）', () => {
    const a = entry(1, 10, 20, 5)
    const added = entry(2, 10, 10, 5)
    expect(roundTrip([a], [[0, 3]], [added, a])).toEqual(new Map([[1, 3]]))
  })

  it('同じ獲得物で個数や対価の違う品目が前に加わっても、回数はずれない', () => {
    const one = entry(7, 10, 5, 0)
    const ten = entry(7, 10, 40, 0, { qty: 10 })
    expect(roundTrip([one], [[0, 3]], [ten, one])).toEqual(new Map([[1, 3]]))
  })

  it('同じ獲得物・個数・通貨・対価の品目が2つ並ぶときは出現順で見分け、入れ替わらない', () => {
    const shop = [entry(7, 10, 5, 3), entry(7, 10, 5, 10)]
    expect(shopItemKeys(shop)).toEqual(['item:7:1:10:5:0', 'item:7:1:10:5:1'])
    expect(roundTrip(shop, [[0, 2], [1, 5]], shop)).toEqual(new Map([[0, 2], [1, 5]]))
  })

  it('今の交換所に無い品目の保存値は使わない', () => {
    const a = entry(1, 10, 20, 5)
    const b = entry(2, 10, 20, 5)
    expect(roundTrip([a, b], [[0, 3], [1, 4]], [b])).toEqual(new Map([[0, 4]]))
  })

  it('在庫上限が減った品目は今の在庫上限で頭打ちにする', () => {
    expect(roundTrip([entry(1, 10, 20, 10)], [[0, 10]], [entry(1, 10, 20, 5)])).toEqual(new Map([[0, 5]]))
  })

  it('サーヴァント扱いとアイテムで番号が同じ品目を取り違えない', () => {
    const item = entry(9001, 10, 20, 5)
    const svt = entry(9001, 10, 20, 5, { kind: 'svt' })
    expect(shopItemKeys([item, svt])).toEqual(['item:9001:1:10:20:0', 'svt:9001:1:10:20:0'])
    expect(roundTrip([item, svt], [[1, 4]], [svt, item])).toEqual(new Map([[0, 4]]))
  })
})

describe('readShopSavedInputs', () => {
  const empty = { counts: {}, owned: {}, bonus: {}, rarity: {} }

  it('保存値全体が表でなければ空の3つの表として読む', () => {
    for (const value of [null, 'abc', 3, [1, 2], undefined]) expect(readShopSavedInputs(value)).toEqual(empty)
  })

  it('表でない表は空、有限の数でない値は捨て、小数は切り捨て、負の数は 0 にする', () => {
    expect(
      readShopSavedInputs({
        counts: { 'item:1:1:10:20:0': 'x', 'item:2:1:10:20:0': 2.7 },
        owned: { 10: -5, 11: 120, 12: Number.POSITIVE_INFINITY, 13: null },
        bonus: [2],
      }),
    ).toEqual({ counts: { 'item:2:1:10:20:0': 2 }, owned: { 10: 0, 11: 120 }, bonus: {}, rarity: {} })
  })

  it('☆ ごとの表は同じ規則で直し、フレンドの ☆ と選んだ合計枚数は 0 以上の整数（フレンドは null も）だけ使う', () => {
    expect(
      readShopSavedInputs({
        rarity: { 5: { maxBonus: 2.5, baseOwned: -1, maxOwned: 'x' }, 4: 'broken' },
        friendRarity: null,
        selectedTotal: 3,
      }),
    ).toEqual({
      ...empty,
      rarity: { 5: { maxBonus: 2, baseOwned: 0 }, 4: {} },
      friendRarity: null,
      selectedTotal: 3,
    })
    for (const bad of [-1, 2.5, '5', Number.NaN, {}]) {
      expect(readShopSavedInputs({ friendRarity: bad, selectedTotal: bad })).toEqual(empty)
    }
  })

  it('番号の表から今の欄の番号だけを取り出す', () => {
    expect(pickIdTable({ 10: 2, 99: 5 }, [10, 11])).toEqual(new Map([[10, 2]]))
  })
})

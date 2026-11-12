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
  effectiveLimit,
  normalizeRemainingInput,
  pickIdTable,
  remainingFromItemKeys,
  withRemainingValues,
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
  excludeUnwantedCounts,
  shopWantedKey,
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

describe('excludeUnwantedCounts', () => {
  it('呼符 3 回×20・伝承結晶 2 回×200 で呼符をいらないにすると選んだ交換は 400、欲しいに戻すと 460', () => {
    const shop = [entry(4001, 10, 20, 10), entry(6999, 10, 200, 2)]
    const counts = new Map([[0, 3], [1, 2]])
    const excluded = excludeUnwantedCounts(shop, counts, new Set(['4001']))
    expect(computeShopCurrencyNeeds(shop, excluded, new Map())).toEqual([{ costItemId: 10, selectedCost: 400, need: 400 }])
    expect(counts.get(0)).toBe(3)
    expect(computeShopCurrencyNeeds(shop, excludeUnwantedCounts(shop, counts, new Set()), new Map())).toEqual([
      { costItemId: 10, selectedCost: 460, need: 460 },
    ])
  })

  it('サーヴァント扱いの品目のキーと番号が同じアイテムの品目を取り違えない', () => {
    const shop = [entry(9305420, 10, 10, 3), entry(9305420, 10, 20, 2, { kind: 'svt' })]
    const counts = new Map([[0, 1], [1, 1]])
    expect([...excludeUnwantedCounts(shop, counts, new Set(['svt:9305420']))]).toEqual([[0, 1]])
    expect([...excludeUnwantedCounts(shop, counts, new Set(['9305420']))]).toEqual([[1, 1]])
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

  it('「いらない」の在庫上限 1 の聖杯は保存した 1 のままで、計算から除くと聖杯の対価は入らない', () => {
    const grailShop = [entry(7999, 10, 300, 1), entry(100, 10, 5, 10), entry(101, 10, 1, 0)]
    const unwanted = new Set([shopWantedKey({ itemId: 7999 })])
    const next = selectAllCurrenciesUpToLimit(grailShop, new Map([[0, 1], [2, 3]]), unwanted)
    expect(next.get(0)).toBe(1)
    expect(next.get(1)).toBe(10)
    expect(next.get(2)).toBe(3)
    expect(computeShopCurrencyNeeds(grailShop, excludeUnwantedCounts(grailShop, next, unwanted), new Map())).toEqual([
      { costItemId: 10, selectedCost: 53, need: 53 },
    ])
  })

  it('「いらない」の品目に回数が無ければ、全部交換しても回数を持たない', () => {
    const next = selectAllCurrenciesUpToLimit(shop, new Map(), new Set(['1']))
    expect(next.has(0)).toBe(false)
    expect(next.get(1)).toBe(10)
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

  it('rowLimit はまとめた行で在庫上限の合計、上限の無い品目の行で undefined（上限なし）', () => {
    expect(rowLimit(dango)).toBe(4)
    expect(rowLimit(rowAt([entry(1, UDON, 10, 0)], 0))).toBeUndefined()
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

/** 不足と所持数から状態を決め、優先素材の回数を出す。 */
const allocate = (
  shop: EventShopItem[],
  need: Record<number, number>,
  possession: Record<string, number | undefined> = {},
  /** 「いらない」の保存のキー。数はアイテムの番号の文字列として扱う。 */
  unwanted: (number | string)[] = [],
  /** null は素材カタログを読めていないとき。 */
  planItemIds: ReadonlySet<number> | null = new Set(),
  /** 操作の前の交換回数。 */
  counts: ReadonlyMap<number, number> = new Map(),
) => {
  const totalNeed = needOf(need)
  const shortfall = computeShopShortfall(totalNeed, possession)
  return allocateShortfallOnly(
    shop,
    shortfall,
    item => shopItemStatus(item, totalNeed, shortfall, planItemIds ?? undefined),
    new Set(unwanted.map(String)),
    counts,
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

  it('サーヴァント扱いの同じ番号の品目は番号で扱いが決まる品目に含まれない', () => {
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

  it('足りている品目・使わない品目は入れていた回数によらず 0 回', () => {
    const allocation = allocate(
      [entry(10, 90, 10, 10), entry(12, 90, 10, 10)],
      { 10: 30 },
      { 10: 40 },
      [],
      new Set([10, 12]),
      new Map([[0, 4], [1, 4]]),
    )
    expect(countsOf(allocation)).toEqual([0, 0])
    expect(allocation.remaining.size).toBe(0)
  })

  it('計画の対象外の在庫上限 1 のコード・リムーバーと夢火は 1', () => {
    expect(countsOf(allocate([entry(5003, 90, 10, 1), entry(1000, 90, 10, 1)], {}))).toEqual([1, 1])
  })

  it('手で 5 を入れた在庫上限 10 の呼符は 10', () => {
    expect(countsOf(allocate([entry(4001, 90, 10, 10)], {}, {}, [], new Set(), new Map([[0, 5]])))).toEqual([10])
  })

  it('在庫上限の無い計画の対象外の品目は 3 を入れていても 0 回にして、回数を入れるよう示す', () => {
    const allocation = allocate([entry(94100, 90, 10, 0)], {}, {}, [], new Set(), new Map([[0, 3]]))
    expect(countsOf(allocation)).toEqual([0])
    expect([...allocation.unlimitedWanted]).toEqual([0])
  })

  it('素材の一覧を読めずにラベルの無い品目とサーヴァント扱いの品目は 0 回、必要数のある品目は不足の分', () => {
    const shop = [
      entry(4001, 90, 10, 5),
      entry(12, 90, 10, 5),
      entry(9770500, 90, 10, 100, { kind: 'svt' }),
      entry(10, 90, 10, 10),
    ]
    expect(countsOf(allocate(shop, { 10: 3 }, {}, [], null))).toEqual([0, 0, 0, 3])
    expect(countsOf(allocate(shop, { 10: 3 }, {}, [], new Set([12])))).toEqual([5, 0, 100, 3])
  })

  it('QP の品目は 0 回で要約に数えない', () => {
    const allocation = allocate([entry(1, 90, 10, 10, { qty: 10000 })], { 1: 50000 })
    expect(countsOf(allocation)).toEqual([0])
    expect(summarizeShortfall(allocation)).toEqual({ shortMaterials: 0, filledMaterials: 0 })
  })

  it('1回の個数が 0 の品目は 0 回で、割り当てから外れる', () => {
    const allocation = allocate(
      [entry(10, 90, 10, 10, { qty: 0 }), entry(10, 91, 10, 10), entry(4001, 90, 10, 0, { qty: 0 })],
      { 10: 4 },
    )
    expect(countsOf(allocation)).toEqual([0, 4, 0])
    expect(allocation.unlimitedWanted.size).toBe(0)
  })
})

describe('allocateShortfallOnly（伝承結晶と夢火）', () => {
  const LORE = 6999
  const FIRE = 1000
  const planIds = new Set([LORE])

  it('育成計画で使わない伝承結晶（在庫上限 2）は 0', () => {
    expect(countsOf(allocate([entry(LORE, 90, 10, 2)], {}, {}, [], planIds))).toEqual([0])
  })

  it('不足 1 の伝承結晶（在庫上限 2）は 1 で、残りは出ない', () => {
    const allocation = allocate([entry(LORE, 90, 10, 2)], { [LORE]: 1 }, {}, [], planIds)
    expect(countsOf(allocation)).toEqual([1])
    expect(allocation.remainders.size).toBe(0)
  })

  it('素材の一覧を読めないときも、使わない伝承結晶は 0、夢火は在庫上限', () => {
    expect(countsOf(allocate([entry(LORE, 90, 10, 2), entry(FIRE, 90, 10, 1)], {}, {}, [], null))).toEqual([0, 1])
  })
})

describe('allocateShortfallOnly（いらない品目）', () => {
  it('いらない聖杯の保存した 1 は変わらず、ほかの欲しい品目だけを置き換える', () => {
    const allocation = allocate(
      [entry(7999, 90, 10, 1), entry(4001, 90, 10, 10)],
      {},
      {},
      [7999],
      new Set(),
      new Map([[0, 1]]),
    )
    expect([...allocation.counts]).toEqual([[0, 1], [1, 10]])
  })

  it('いらない品目に回数が無ければ回数を持たない', () => {
    expect(allocate([entry(7999, 90, 10, 1)], {}, {}, [7999]).counts.has(0)).toBe(false)
  })

  it('不足 5 の素材のいらない品目は 3 のまま変わらず、不足は埋まらない', () => {
    const allocation = allocate([entry(10, 90, 10, 10)], { 10: 5 }, {}, [10], new Set([10]), new Map([[0, 3]]))
    expect([...allocation.counts]).toEqual([[0, 3]])
    expect(allocation.remaining.get(10)).toBe(5)
    expect(allocation.remainders.size).toBe(0)
    expect(summarizeShortfall(allocation)).toEqual({ shortMaterials: 1, filledMaterials: 0 })
  })

  it('いらない品目しかない素材は埋まらない素材として数え、どの行にも足りない数を出さない', () => {
    const allocation = allocate([entry(10, 90, 10, 10), entry(11, 90, 10, 10)], { 10: 5, 11: 2 }, {}, [10])
    expect(summarizeShortfall(allocation)).toEqual({ shortMaterials: 2, filledMaterials: 1 })
    expect(allocation.remainders.size).toBe(0)
  })

  it('最後の品目がいらないときは、前の「欲しい」の品目に 2 個足りないを出す', () => {
    // 同じ素材の後の品目だけを「いらない」にするため、後の品目を別のキー（サーヴァント扱い）にし、状態は両方とも不足にする。
    const shop = [entry(10, 90, 10, 3), entry(10, 91, 10, 10, { kind: 'svt' })]
    const result = allocateShortfallOnly(
      shop,
      new Map([[10, 5]]),
      () => ({ kind: 'short', shortfall: 5 }),
      new Set(['svt:10']),
    )
    expect([...result.counts]).toEqual([[0, 3]])
    expect([...result.remainders]).toEqual([[0, 2]])
  })
})

describe('allocateShortfallOnly（サーヴァント扱いの品目）', () => {
  const svt = (itemId: number, limitNum: number): EventShopItem => entry(itemId, 90, 10, limitNum, { kind: 'svt' })

  it('在庫上限 100 の種火は 100、いらない在庫上限 2 の礼装は回数を変えない', () => {
    const allocation = allocate([svt(9770500, 100), svt(9306300, 2)], {}, {}, ['svt:9306300'], new Set(), new Map([[1, 2]]))
    expect(countsOf(allocation)).toEqual([100, 2])
    expect(summarizeShortfall(allocation)).toEqual({ shortMaterials: 0, filledMaterials: 0 })
  })

  it('番号が同じアイテムの品目と「いらない」を取り違えない', () => {
    const shop = [entry(9305420, 90, 10, 3), svt(9305420, 2)]
    expect([...allocate(shop, {}, {}, ['svt:9305420']).counts]).toEqual([[0, 3]])
    expect([...allocate(shop, {}, {}, ['9305420']).counts]).toEqual([[1, 2]])
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
  const empty = { counts: {}, owned: {}, bonus: {}, rarity: {}, remaining: {} }

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
    ).toEqual({ counts: { 'item:2:1:10:20:0': 2 }, owned: { 10: 0, 11: 120 }, bonus: {}, rarity: {}, remaining: {} })
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

describe('効く上限（残りを上限として使う）', () => {
  // 80632 の巡霊の葉 ×10（3通貨・対価 10・在庫上限 25）と、月より団子（在庫上限 2・1・1）
  const LEAF = 6503
  const leaf = [
    entry(LEAF, UDON, 10, 25, { qty: 10 }),
    entry(LEAF, MUSUBI, 10, 25, { qty: 10 }),
    entry(LEAF, KAKI, 10, 25, { qty: 10 }),
  ]
  const dangoShop = [svt(DANGO, UDON, 100, 2), svt(DANGO, MUSUBI, 100, 1), svt(DANGO, KAKI, 100, 1)]

  it('在庫上限の無い品目は上限なし、残りがあれば在庫上限と残りの小さいほう、残り 0 は回数の 0', () => {
    expect(effectiveLimit(entry(1, UDON, 2, 0))).toBeUndefined()
    expect(effectiveLimit(entry(1, UDON, 2, 0), 3)).toBeUndefined()
    expect(effectiveLimit(entry(1, UDON, 10, 25))).toBe(25)
    expect(effectiveLimit(entry(1, UDON, 10, 25), 10)).toBe(10)
    expect(effectiveLimit(entry(1, UDON, 10, 25), 40)).toBe(25)
    expect(effectiveLimit(entry(1, UDON, 10, 25), 0)).toBe(0)
  })

  it('残りまで全部交換する: 武蔵うどんの巡霊の葉の残り 10 なら 10 回で、武蔵うどんの必要量に 10 回分の対価が加わる', () => {
    const remaining = new Map([[0, 10]])
    const next = selectAllCurrenciesUpToLimit(leaf, new Map(), new Set(), remaining)
    expect(next.get(0)).toBe(10)
    expect(next.get(1)).toBe(25)
    const needs = computeShopCurrencyNeeds(leaf, next, new Map(), remaining)
    expect(needs.find(n => n.costItemId === UDON)?.selectedCost).toBe(100)
  })

  it('売り切れの品目: 江戸むすびのコード・リムーバーの残り 0 なら上限 0 で、全部交換しても 0 回', () => {
    const remover = [entry(5003, UDON, 20, 1), entry(5003, MUSUBI, 20, 1), entry(5003, KAKI, 20, 1)]
    const remaining = new Map([[1, 0]])
    expect(clampExchangeCount(entry(5003, MUSUBI, 20, 1), 1, 0)).toBe(0)
    const next = selectAllCurrenciesUpToLimit(remover, new Map([[1, 1]]), new Set(), remaining)
    expect([0, 1, 2].map(i => next.get(i))).toEqual([1, 0, 1])
  })

  it('まとめた行の上限: 月より団子の残りが 武蔵うどん 1・江戸むすび 0・東干し柿なし なら上限 2、全部交換で 1・0・1', () => {
    const row = rowAt(dangoShop, 0)
    const remaining = new Map([[0, 1], [1, 0]])
    expect(rowLimit(row, remaining)).toBe(2)
    const next = selectAllCurrenciesUpToLimit(dangoShop, new Map(), new Set(), remaining)
    expect([0, 1, 2].map(i => next.get(i))).toEqual([1, 0, 1])
    expect(rowCountOf(row, next, remaining).count).toBe(2)
    // 行に入れた回数も効く上限で割り振り、売り切れの品目には入れない
    expect([...splitRowCount(row, 9, remaining)]).toEqual([[0, 1], [1, 0], [2, 1]])
  })

  it('入れた回数が残りを超える: 在庫上限 30 に 20 回を入れたあと残り 5 なら、表示と必要量は 5 回分', () => {
    const shop = [entry(1, UDON, 10, 30)]
    const counts = new Map([[0, 20]])
    const remaining = new Map([[0, 5]])
    expect(rowCountOf(rowAt(shop, 0), counts, remaining).count).toBe(5)
    expect(computeShopCurrencyNeeds(shop, counts, new Map(), remaining)).toEqual([
      { costItemId: UDON, selectedCost: 50, need: 50 },
    ])
    // 保存値の読み込みは在庫上限で切り詰めるだけで、残りでは書き換えない
    expect(countsFromItemKeys(shop, countsToItemKeys(shop, counts))).toEqual(new Map([[0, 20]]))
  })

  const allocateWithRemaining = (rest: number) => {
    const totalNeed = needOf({ 10: 5 })
    const shortfall = computeShopShortfall(totalNeed, {})
    return allocateShortfallOnly(
      [entry(10, 90, 10, 10)],
      shortfall,
      item => shopItemStatus(item, totalNeed, shortfall, new Set()),
      new Set(),
      new Map(),
      new Map([[0, rest]]),
    )
  }

  it('優先素材と埋まらない不足: 不足 5・在庫上限 10・残り 3 なら 3 回で、2 個が埋まらない', () => {
    const allocation = allocateWithRemaining(3)
    expect(countsOf(allocation)).toEqual([3])
    expect(allocation.remaining.get(10)).toBe(2)
    expect([...allocation.remainders]).toEqual([[0, 2]])
  })

  it('売り切れの品目は上限なしにならない: 残り 0 なら 0 回で、5 個が埋まらず上限なしの品目に数えない', () => {
    const allocation = allocateWithRemaining(0)
    expect(countsOf(allocation)).toEqual([0])
    expect(allocation.remaining.get(10)).toBe(5)
    expect(allocation.unlimitedWanted.size).toBe(0)
  })

  it('計画の対象外の売り切れの品目は 0 回で、上限なしの品目に数えない', () => {
    const allocation = allocateShortfallOnly(
      [entry(5003, 90, 20, 1)],
      new Map(),
      () => ({ kind: 'outside' }),
      new Set(),
      new Map([[0, 1]]),
      new Map([[0, 0]]),
    )
    expect(countsOf(allocation)).toEqual([0])
    expect(allocation.unlimitedWanted.size).toBe(0)
  })

  it('全交換の合計: 対価 10・在庫上限 25・残り 10 と、対価 5・在庫上限 20 の残りの無い品目なら 200', () => {
    const shop = [entry(1, UDON, 10, 25), entry(2, UDON, 5, 20)]
    const [group] = groupShopByCurrency(shop, new Map([[0, 10]]))
    expect(group?.totalCost).toBe(200)
    expect(group?.unlimitedCount).toBe(0)
  })

  it('売り切れの品目の全交換の合計: 残り 0 なら 100 で、上限なしの品目の数は増えない', () => {
    const shop = [entry(1, UDON, 10, 25), entry(2, UDON, 5, 20)]
    const [group] = groupShopByCurrency(shop, new Map([[0, 0]]))
    expect(group?.totalCost).toBe(100)
    expect(group?.unlimitedCount).toBe(0)
  })

  it('残りの無い品目は今までどおり在庫上限を使う', () => {
    const shop = [entry(1, UDON, 10, 25), entry(2, UDON, 5, 0)]
    const none = new Map<number, number>()
    expect(groupShopByCurrency(shop, none)).toEqual(groupShopByCurrency(shop))
    expect(groupShopByCurrency(shop, none)[0]?.totalCost).toBe(250)
    expect(selectAllCurrenciesUpToLimit(shop, new Map(), new Set(), none)).toEqual(new Map([[0, 25]]))
    expect(rowLimit(rowAt(shop, 0), none)).toBe(25)
    // 在庫上限の無い品目は残りがあっても上限なし
    expect(rowLimit(rowAt(shop, 1), new Map([[1, 3]]))).toBeUndefined()
    expect(clampExchangeCount(entry(1, UDON, 10, 25), 40)).toBe(25)
  })

  it('残りで行の形（どの品目をまとめるか）は変わらない: すべて売り切れでもまとめたまま', () => {
    expect(rowIndices(dangoShop)).toEqual([[0, 1, 2]])
    const row = rowAt(dangoShop, 0)
    const soldOut = new Map([[0, 0], [1, 0], [2, 0]])
    expect(rowLimit(row, soldOut)).toBe(0)
    expect([...splitRowCount(row, 3, soldOut)]).toEqual([[0, 0], [1, 0], [2, 0]])
  })
})

describe('保存した残り', () => {
  it('残りの値が壊れている: 文字列と -1 の品目は残りが無く、4.7 は 4 として読む。0 は売り切れとして残す', () => {
    const read = readShopSavedInputs({
      remaining: { 'item:1:1:10:20:0': 'x', 'item:2:1:10:20:0': -1, 'item:3:1:10:20:0': 4.7, 'item:4:1:10:20:0': 0 },
    })
    expect(read.remaining).toEqual({ 'item:3:1:10:20:0': 4, 'item:4:1:10:20:0': 0 })
    const shop = [entry(1, 10, 20, 30), entry(2, 10, 20, 30), entry(3, 10, 20, 30), entry(4, 10, 20, 30)]
    const remaining = remainingFromItemKeys(shop, read.remaining)
    expect(shop.map((item, i) => effectiveLimit(item, remaining.get(i)))).toEqual([30, 30, 4, 0])
    for (const bad of [Number.POSITIVE_INFINITY, Number.NaN, null, '3']) {
      expect(readShopSavedInputs({ remaining: { a: bad } }).remaining).toEqual({})
    }
  })

  it('保存値全体や残りの表が壊れていれば、どの品目にも残りが無い', () => {
    for (const value of [null, 'abc', 3, [1, 2], { remaining: 'abc' }, { remaining: [3] }]) {
      expect(readShopSavedInputs(value).remaining).toEqual({})
    }
  })

  it('並びが変わっても同じ品目に使う: 前に加わった品目には残りが無く、今の交換所に無い品目の残りは使わない', () => {
    const a = entry(1, 10, 20, 5)
    const added = entry(2, 10, 10, 5)
    const gone = entry(3, 10, 10, 5)
    const saved = JSON.parse(JSON.stringify(countsToItemKeys([a, gone], new Map([[0, 3], [1, 2]])))) as Record<
      string,
      number
    >
    expect(remainingFromItemKeys([added, a], saved)).toEqual(new Map([[1, 3]]))
  })

  it('残りの書き換えは指定した品目だけを変え、undefined は除き、ほかの品目と今の交換所に無い品目の残りは残す', () => {
    const shop = [entry(1, 10, 20, 5), entry(2, 10, 20, 5), entry(3, 10, 20, 5)]
    const [k1, k2, k3] = shopItemKeys(shop)
    const saved = { [k1 ?? '']: 3, [k2 ?? '']: 4, 'item:99:1:10:20:0': 1 }
    expect(withRemainingValues(shop, saved, new Map([[0, undefined], [2, 0]]))).toEqual({
      [k2 ?? '']: 4,
      [k3 ?? '']: 0,
      'item:99:1:10:20:0': 1,
    })
  })

  it('入れた残りは小数を切り捨て、在庫上限で頭打ちにし、負の数や上限の無い品目は残りにしない', () => {
    const leaf = entry(6503, 10, 10, 25)
    expect(normalizeRemainingInput(leaf, 40)).toBe(25)
    expect(normalizeRemainingInput(leaf, 4.7)).toBe(4)
    expect(normalizeRemainingInput(leaf, 0)).toBe(0)
    expect(normalizeRemainingInput(leaf, -1)).toBeUndefined()
    expect(normalizeRemainingInput(leaf, Number.NaN)).toBeUndefined()
    expect(normalizeRemainingInput(entry(1, 10, 2, 0), 3)).toBeUndefined()
  })
})

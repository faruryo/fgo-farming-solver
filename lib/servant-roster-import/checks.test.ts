import { describe, expect, it } from 'vitest'
import {
  checkReadingValues,
  checkSortOrder,
  compareOwnedCount,
  countCards,
  estimateFromNeighbours,
  findSortViolations,
  isSameRow,
  keyValueOf,
  lvCapsForRarity,
  readingKey,
  stitchImages,
  withSortChecks,
  type ReadingCheck,
} from './checks'
import { card, image, type CardSpec } from './test-fixtures'
import type { CardReading, ImageReading, SortKey, SortOrder } from './types'
import { isPossibleLvCap } from './values'

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)
const GRAIL_2 = range(92, 120, 2)
const fives = (length: number) => Array.from({ length }, () => 5)
const sorted = (set: ReadonlySet<number> | null) => (set ? [...set].sort((a, b) => a - b) : null)

const baseChecks = (images: readonly ImageReading[], rarityOf: (id: number) => number | undefined = () => undefined) =>
  new Map(images.flatMap((img) => img.rows.flat()).map((r) => [readingKey(r), checkReadingValues(r, rarityOf)]))

/** 1枚の画像（または同じ並びの複数の画像）をつないで並び順の検査をする */
const sortCheck = (images: ImageReading[], key: SortKey, order: SortOrder) => {
  const checks = baseChecks(images)
  const rows = stitchImages(images, keyValueOf(key, checks), order)
  return { rows, result: checkSortOrder(rows, key, order, checks) }
}

/** 1つの段に7枚ずつ詰めた画像（宝具Lv の今の値の列から） */
const npImage = (imageIndex: number, nps: number[], order: SortOrder = 'desc', servantBase = 100): ImageReading => {
  const specs: CardSpec[] = nps.map((np, i) => ({ servant: servantBase + i, np: [np, 5], lv: [80, 80] }))
  const rows: CardSpec[][] = []
  for (let i = 0; i < specs.length; i += 7) rows.push(specs.slice(i, i + 7))
  return image(imageIndex, rows, { key: 'npLv', order })
}

const violationsOf = (result: Map<string, { violation: boolean }>, readings: CardReading[]) =>
  readings.filter((r) => result.get(readingKey(r))?.violation).map((r) => r.values.npLv?.current ?? r.values.lv?.current)

describe('lvCapsForRarity', () => {
  it('星5: 再臨の段階ごとの 50〜90 と、92 から 120 まで 2 刻み', () => {
    expect(sorted(lvCapsForRarity(5))).toEqual([50, 60, 70, 80, 90, ...GRAIL_2])
  })
  it('星4: 40〜80 と 85・90 と、92 から 120 まで 2 刻み', () => {
    expect(sorted(lvCapsForRarity(4))).toEqual([40, 50, 60, 70, 80, 85, 90, ...GRAIL_2])
  })
  it('星3: 30〜70 と 75・80・85・90 と、92 から 120 まで 2 刻み', () => {
    expect(sorted(lvCapsForRarity(3))).toEqual([30, 40, 50, 60, 70, 75, 80, 85, 90, ...GRAIL_2])
  })
  it.each([2, 0])('星%i: 25〜65 と 70・75・80・85・90 と、92 から 120 まで 2 刻み', (rarity) => {
    expect(sorted(lvCapsForRarity(rarity))).toEqual([25, 35, 45, 55, 65, 70, 75, 80, 85, 90, ...GRAIL_2])
  })
  it('星1: 20〜60 と 70・75・80・85・90 と、92 から 120 まで 2 刻み（65 は無い）', () => {
    expect(sorted(lvCapsForRarity(1))).toEqual([20, 30, 40, 50, 60, 70, 75, 80, 85, 90, ...GRAIL_2])
  })
  it('知らないレア度は null', () => {
    expect(lvCapsForRarity(6)).toBeNull()
    expect(lvCapsForRarity(-1)).toBeNull()
  })
  it('全部のレア度を合わせると、上限になりうる数と同じになる', () => {
    const union = new Set([0, 1, 2, 3, 4, 5].flatMap((r) => [...(lvCapsForRarity(r) ?? [])]))
    expect(sorted(union)).toEqual(range(0, 130, 1).filter(isPossibleLvCap))
  })
})

describe('checkReadingValues', () => {
  const rarityOf = (id: number) => new Map([[1, 5], [2, 1]]).get(id)

  it('星5 のサーヴァントの「85/85」はレア度に合わない', () => {
    expect(checkReadingValues(card(0, 0, 0, { servant: 1, lv: [85, 85] }), rarityOf)).toEqual({
      reasons: ['rarity-mismatch'],
      failedKinds: ['lv'],
      estimate: null,
    })
  })

  it('星1 の「116/118」「60/60」と星5 の「1/50」は通る', () => {
    expect(checkReadingValues(card(0, 0, 0, { servant: 2, lv: [116, 118] }), rarityOf).reasons).toEqual([])
    expect(checkReadingValues(card(0, 0, 0, { servant: 2, lv: [60, 60] }), rarityOf).reasons).toEqual([])
    expect(checkReadingValues(card(0, 0, 0, { servant: 1, lv: [1, 50] }), rarityOf).reasons).toEqual([])
  })

  it('顔が「要確認」のカードではレア度を見ない', () => {
    expect(checkReadingValues(card(0, 0, 0, { servant: null, lv: [85, 85] }), () => 5).reasons).toEqual([])
  })

  it('レア度を知らないサーヴァントではレア度を見ない', () => {
    expect(checkReadingValues(card(0, 0, 0, { servant: 9, lv: [85, 85] }), rarityOf).reasons).toEqual([])
  })

  it('値を決めなかった読みは値の範囲で通らない', () => {
    const reading = card(0, 0, 0, { servant: 1, np: [5, 5], failures: [{ kind: 'lv', current: 83, max: 87 }] })
    expect(checkReadingValues(reading, rarityOf)).toEqual({
      reasons: ['out-of-range'],
      failedKinds: ['lv'],
      estimate: null,
    })
  })
})

describe('findSortViolations', () => {
  it.each([
    [[5, 5, 3, 5, 5], 'desc', [2]],
    [[3, 5], 'desc', [0, 1]],
    [[5, 3], 'desc', []],
    [[5, 5, 1, 1], 'desc', []],
    [[60, 65, 1, 70], 'asc', [2]],
    [[], 'desc', []],
    [[4], 'desc', []],
    [[5, 4, 5, 4], 'desc', [1, 2]],
  ] as [number[], SortOrder, number[]][])('%j（%s）で外すのは %j', (values, order, expected) => {
    expect([...findSortViolations(values, order)].sort((a, b) => a - b)).toEqual(expected)
  })
})

describe('checkSortOrder', () => {
  it('降順の「5・5・3・5・5」は 3 だけを外し、前後の 5 を推定した値にする', () => {
    const img = npImage(0, [5, 5, 3, 5, 5])
    const { result } = sortCheck([img], 'npLv', 'desc')
    expect(violationsOf(result, img.rows.flat())).toEqual([3])
    expect(result.get(readingKey(img.rows[0][2]))?.estimate).toEqual({ kind: 'npLv', value: 5, range: null })
  })

  it('降順の「3・5」は両方を外す（外す読みが1つに決まらない）', () => {
    const img = npImage(0, [3, 5])
    const { result } = sortCheck([img], 'npLv', 'desc')
    expect(violationsOf(result, img.rows.flat())).toEqual([3, 5])
  })

  it('降順の「5・3」と「5・5・1・1」は1枚も外さない', () => {
    expect(sortCheck([npImage(0, [5, 3])], 'npLv', 'desc').result.size).toBe(0)
    expect(sortCheck([npImage(0, [5, 5, 1, 1])], 'npLv', 'desc').result.size).toBe(0)
  })

  it('段をまたいでも読んだ順（上の段から、段の中は左から）で見る', () => {
    const img = npImage(0, [5, 5, 5, 5, 5, 5, 5, 3, 5, 5])
    const { result } = sortCheck([img], 'npLv', 'desc')
    expect(violationsOf(result, img.rows.flat())).toEqual([3])
    // 「…5・3・5」の末尾は、3 を外しても 5 を外しても1枚で合うので、両方を外す
    const tail = npImage(1, [5, 5, 5, 5, 5, 5, 5, 3, 5])
    expect(violationsOf(sortCheck([tail], 'npLv', 'desc').result, tail.rows.flat())).toEqual([3, 5])
  })

  it('並びの項目でない値には掛けない（宝具Lv.順で Lv が 90・120・80）', () => {
    const img = image(0, [
      [
        { servant: 1, np: [5, 5], lv: [90, 90] },
        { servant: 2, np: [5, 5], lv: [120, 120] },
        { servant: 3, np: [5, 5], lv: [80, 80] },
      ],
    ])
    expect(sortCheck([img], 'npLv', 'desc').result.size).toBe(0)
  })

  it('Lv.順・昇順の「60・65・1・70」は 1 を外し、65〜70 の範囲を添える', () => {
    const img = image(0, [[60, 65, 1, 70].map((lv, i) => ({ servant: i + 1, lv: [lv, lv === 1 ? 50 : lv] }))], {
      key: 'lv',
      order: 'asc',
    })
    const { result } = sortCheck([img], 'lv', 'asc')
    expect(violationsOf(result, img.rows.flat())).toEqual([1])
    expect(result.get(readingKey(img.rows[0][2]))?.estimate).toEqual({
      kind: 'lv',
      value: null,
      range: { min: 65, max: 70 },
    })
  })

  it('値の範囲で通らなかった読みにも前後から推定を添える（前後が違えば範囲、同じなら値）', () => {
    const fail = { kind: 'npLv' as const, current: 9, max: 5 }
    const img = image(0, [
      [
        { servant: 1, np: [5, 5] },
        { servant: 2, failures: [fail] },
        { servant: 3, np: [3, 5] },
        { servant: 4, np: [3, 5] },
        { servant: 5, failures: [fail] },
        { servant: 6, np: [3, 5] },
      ],
    ])
    const { result } = sortCheck([img], 'npLv', 'desc')
    expect(result.get(readingKey(img.rows[0][1]))).toEqual({
      violation: false,
      estimate: { kind: 'npLv', value: null, range: { min: 3, max: 5 } },
    })
    expect(result.get(readingKey(img.rows[0][4]))?.estimate).toEqual({ kind: 'npLv', value: 3, range: null })
  })

  it('並びの端では片側だけの範囲を添える', () => {
    const fail = { kind: 'npLv' as const, current: 9, max: 5 }
    const img = image(0, [[{ servant: 1, failures: [fail] }, { servant: 2, np: [4, 5] }, { servant: 3, failures: [fail] }]])
    const { result } = sortCheck([img], 'npLv', 'desc')
    expect(result.get(readingKey(img.rows[0][0]))?.estimate).toEqual({ kind: 'npLv', value: null, range: { min: 4 } })
    expect(result.get(readingKey(img.rows[0][2]))?.estimate).toEqual({ kind: 'npLv', value: null, range: { max: 4 } })
  })

  it('並びの項目でない種類で値の範囲に通らなかった読みには推定を添えない', () => {
    const img = image(0, [[{ servant: 1, np: [5, 5], failures: [{ kind: 'lv', current: 83, max: 87 }] }]])
    expect(sortCheck([img], 'npLv', 'desc').result.size).toBe(0)
  })

  it('重なった段で値の違う読みは、前後の外れなかったカードの値の間に無い読みだけを外す', () => {
    // 1枚目: 5 5 5 / 5 5 5、2枚目: 5 3 5（1枚目の2段目と同じ段）/ 3 3 3
    const first = image(0, [
      [1, 2, 3].map((s) => ({ servant: s, np: [5, 5] as [number, number] })),
      [4, 5, 6].map((s) => ({ servant: s, np: [5, 5] as [number, number] })),
    ])
    const second = image(1, [
      [4, 5, 6].map((s, i) => ({ servant: s, np: [i === 1 ? 3 : 5, 5] as [number, number] })),
      [7, 8, 9].map((s) => ({ servant: s, np: [5, 5] as [number, number] })),
    ])
    const { rows, result } = sortCheck([first, second], 'npLv', 'desc')
    expect(countCards(rows)).toBe(9)
    expect(result.get(readingKey(second.rows[0][1]))).toEqual({
      violation: true,
      estimate: { kind: 'npLv', value: 5, range: null },
    })
    expect(result.has(readingKey(first.rows[1][1]))).toBe(false)
  })
})

describe('stitchImages', () => {
  const keyOf = (images: ImageReading[]) => keyValueOf('npLv', baseChecks(images))
  const servantsOf = (rows: ReturnType<typeof stitchImages>) =>
    rows.map((row) => row.map((slot) => (slot.readings[0].face.kind === 'matched' ? slot.readings[0].face.servantId : null)))

  it('重なる段がある2枚をつなぎ、重なったカードを1枚と数える', () => {
    const first = npImage(0, fives(21), 'desc', 100)
    const second = npImage(1, fives(21), 'desc', 114)
    const rows = stitchImages([first, second], keyOf([first, second]), 'desc')
    expect(rows).toHaveLength(5)
    expect(countCards(rows)).toBe(35)
    expect(rows.map((row) => row[0].readings.length)).toEqual([1, 1, 2, 1, 1])
  })

  it('あとの画像が上にずれていてもつなぐ', () => {
    const lower = npImage(0, fives(14), 'desc', 107)
    const upper = npImage(1, fives(14), 'desc', 100)
    const rows = stitchImages([lower, upper], keyOf([lower, upper]), 'desc')
    expect(servantsOf(rows).map((row) => row[0])).toEqual([100, 107, 114])
  })

  it('重なる段の無い2枚は、先頭のカードの並びの項目の値で並べる（降順なら大きいほうを先）', () => {
    const ones = npImage(0, [1, 1, 1], 'desc', 100)
    const fives = npImage(1, [5, 5, 4], 'desc', 200)
    const rows = stitchImages([ones, fives], keyOf([ones, fives]), 'desc')
    expect(servantsOf(rows)).toEqual([
      [200, 201, 202],
      [100, 101, 102],
    ])
  })

  it('昇順なら小さいほうを先にし、先頭が同じなら末尾の値で比べる', () => {
    const a = npImage(0, [1, 3], 'asc', 100)
    const b = npImage(1, [1, 2], 'asc', 200)
    const rows = stitchImages([a, b], keyOf([a, b]), 'asc')
    expect(servantsOf(rows)).toEqual([
      [200, 201],
      [100, 101],
    ])
  })

  it('値が同じなら選んだ順に並べる', () => {
    const a = npImage(0, [5, 5], 'desc', 100)
    const b = npImage(1, [5, 5], 'desc', 200)
    expect(servantsOf(stitchImages([a, b], keyOf([a, b]), 'desc'))).toEqual([
      [100, 101],
      [200, 201],
    ])
  })

  it('間の画像で2つのつながりが1つになる', () => {
    const top = npImage(0, fives(14), 'desc', 100)
    const bottom = npImage(1, fives(14), 'desc', 114)
    const middle = npImage(2, fives(14), 'desc', 107)
    const rows = stitchImages([top, bottom, middle], keyOf([top, bottom, middle]), 'desc')
    expect(servantsOf(rows).map((row) => row[0])).toEqual([100, 107, 114, 121])
    expect(countCards(rows)).toBe(28)
  })
})

describe('isSameRow', () => {
  const row = (specs: CardSpec[], imageIndex = 0) =>
    specs.map((spec, column) => ({ column, readings: [card(imageIndex, 0, column, spec)] }))

  it('片方で「要確認」になった位置は問わない', () => {
    expect(isSameRow(row([{ servant: 1 }, { servant: null }]), row([{ servant: 1 }, { servant: 2 }], 1))).toBe(true)
  })
  it('当たったサーヴァントが違えば同じ段でない', () => {
    expect(isSameRow(row([{ servant: 1 }, { servant: 2 }]), row([{ servant: 1 }, { servant: 3 }], 1))).toBe(false)
  })
  it('カードのある位置が違えば同じ段でない', () => {
    expect(isSameRow(row([{ servant: 1 }]), row([{ servant: 1 }, { servant: 2 }], 1))).toBe(false)
  })
  it('両方で当たった位置が無ければ同じ段でない', () => {
    expect(isSameRow(row([{ servant: null }]), row([{ servant: 1 }], 1))).toBe(false)
  })
})

describe('estimateFromNeighbours', () => {
  it.each([
    [5, 5, 'desc', { kind: 'npLv', value: 5, range: null }],
    [100, 90, 'desc', { kind: 'npLv', value: null, range: { min: 90, max: 100 } }],
    [null, 90, 'desc', { kind: 'npLv', value: null, range: { min: 90 } }],
    [100, null, 'desc', { kind: 'npLv', value: null, range: { max: 100 } }],
    [null, 90, 'asc', { kind: 'npLv', value: null, range: { max: 90 } }],
    [100, null, 'asc', { kind: 'npLv', value: null, range: { min: 100 } }],
    [null, null, 'desc', null],
  ] as [number | null, number | null, SortOrder, unknown][])('前 %s・後 %s（%s）', (before, after, order, expected) => {
    expect(estimateFromNeighbours(before, after, order, 'npLv')).toEqual(expected)
  })
})

describe('withSortChecks', () => {
  it('並び順に合わない読みに理由と種類を足し、推定を持たせる', () => {
    const base = new Map<string, ReadingCheck>([['0:0:0', { reasons: [], failedKinds: [], estimate: null }]])
    const estimate = { kind: 'npLv' as const, value: 5, range: null }
    const out = withSortChecks(base, new Map([['0:0:0', { violation: true, estimate }]]), 'npLv')
    expect(out.get('0:0:0')).toEqual({ reasons: ['sort-order'], failedKinds: ['npLv'], estimate })
    expect(base.get('0:0:0')?.reasons).toEqual([])
  })
})

describe('compareOwnedCount', () => {
  it('読めたカードが所持数より少なければ知らせる', () => {
    expect(compareOwnedCount([554, 554], 546)).toEqual({ owned: 554, read: 546 })
  })
  it('同じか多ければ知らせない', () => {
    expect(compareOwnedCount([554], 554)).toBeNull()
    expect(compareOwnedCount([554], 560)).toBeNull()
  })
  it('所持数が1枚も読めなければ検査しない', () => {
    expect(compareOwnedCount([null, null], 10)).toBeNull()
    expect(compareOwnedCount([], 10)).toBeNull()
  })
  it('画像の間で所持数が違えば検査しない', () => {
    expect(compareOwnedCount([554, 553], 10)).toBeNull()
  })
  it('読めなかった画像を除いて同じなら、その数と比べる', () => {
    expect(compareOwnedCount([null, 554], 500)).toEqual({ owned: 554, read: 500 })
  })
})

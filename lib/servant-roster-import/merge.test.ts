import { describe, expect, it } from 'vitest'
import type { ServantLevels } from '../servant-levels'
import { checkReadingValues, readingKey, type ReadingCheck } from './checks'
import { mergeRoster } from './merge'
import { card, type CardSpec } from './test-fixtures'
import type { CardReading } from './types'

const SERVANT = 100

/** 同じサーヴァントのカードを画像ごとに1枚ずつ */
const readingsOf = (...specs: Omit<CardSpec, 'servant'>[]): CardReading[] =>
  specs.map((spec, i) => card(i, 0, 0, { servant: SERVANT, ...spec }))

const checksOf = (readings: readonly CardReading[], extra: [CardReading, ReadingCheck][] = []) =>
  new Map<string, ReadingCheck>([
    ...readings.map((r): [string, ReadingCheck] => [readingKey(r), checkReadingValues(r, () => 5)]),
    ...extra.map(([r, c]): [string, ReadingCheck] => [readingKey(r), c]),
  ])

const merge = (readings: CardReading[], stored: ServantLevels = {}, extra: [CardReading, ReadingCheck][] = []) =>
  mergeRoster(readings, checksOf(readings, extra), stored)

const accepted = (lv: number | null, npLv: number | null, crop = 'crop-0-0-0') => ({
  key: `servant-${SERVANT}`,
  servantId: SERVANT,
  lv,
  npLv,
  review: null,
  crop,
})

describe('mergeRoster: 複数の画像のまとめ', () => {
  it('画像の重なり: 同じ Lv 90・宝具Lv 2 の2枚を1つの行にまとめる', () => {
    expect(merge(readingsOf({ lv: [90, 90], np: [2, 5] }, { lv: [90, 90], np: [2, 5] }))).toEqual([accepted(90, 2)])
  })

  it('宝具Lv.順の Lv 90・宝具Lv 2 と Lv.順の Lv 90 を1つの行にまとめる', () => {
    expect(merge(readingsOf({ lv: [90, 90], np: [2, 5] }, { lv: [90, 90] }))).toEqual([accepted(90, 2)])
  })

  it('同じサーヴァントを複数持つ: Lv 60・宝具Lv 5 を取り込み、Lv 1 の個体は行にも候補にも出さない', () => {
    const rows = merge(readingsOf({ lv: [1, 50], np: [5, 5] }, { lv: [60, 60], np: [5, 5] }))
    expect(rows).toEqual([accepted(60, 5, 'crop-1-0-0')])
  })

  it('同じサーヴァントを3枚持つ', () => {
    const rows = merge(readingsOf({ lv: [1, 50], np: [5, 5] }, { lv: [60, 60], np: [5, 5] }, { lv: [1, 50], np: [5, 5] }))
    expect(rows).toEqual([accepted(60, 5, 'crop-1-0-0')])
  })

  it('宝具Lv を先に比べる: Lv 90・宝具Lv 1 と Lv 1・宝具Lv 2 なら後者', () => {
    expect(merge(readingsOf({ lv: [90, 90], np: [1, 5] }, { lv: [1, 50], np: [2, 5] }))).toEqual([
      accepted(1, 2, 'crop-1-0-0'),
    ])
  })

  it('Lv だけの読みが違う: Lv.順の Lv 100 は捨てる（無い宝具Lv はどの値よりも低い）', () => {
    expect(merge(readingsOf({ lv: [100, 100] }, { lv: [90, 90], np: [2, 5] }))).toEqual([
      accepted(90, 2, 'crop-1-0-0'),
    ])
  })

  it('片方の画像で値が読めない読みは捨てる', () => {
    expect(merge(readingsOf({}, { lv: [90, 90], np: [2, 5] }))).toEqual([accepted(90, 2, 'crop-1-0-0')])
  })

  it('検査に通らない読みを含む: 通った Lv 90・宝具Lv 2 を取り込み「要確認」にしない', () => {
    const rows = merge(readingsOf({ np: [5, 5], failures: [{ kind: 'lv', current: 900, max: 90 }] }, { lv: [90, 90], np: [2, 5] }))
    expect(rows).toEqual([accepted(90, 2, 'crop-1-0-0')])
  })

  it('検査に通らない読みのほうが強くても取り込む値にしない', () => {
    const readings = readingsOf({ lv: [90, 90], np: [5, 5] }, { lv: [90, 90], np: [2, 5] })
    const sortFail: ReadingCheck = { reasons: ['sort-order'], failedKinds: ['npLv'], estimate: null }
    expect(merge(readings, {}, [[readings[0], sortFail]])).toEqual([accepted(90, 2, 'crop-1-0-0')])
  })

  it('通った読みが無い: Lv の欄を空にして理由を出し、通った種類の値は残す', () => {
    const rows = merge(readingsOf({ np: [5, 5], failures: [{ kind: 'lv', current: 83, max: 87 }] }))
    expect(rows).toEqual([
      {
        key: `servant-${SERVANT}`,
        servantId: SERVANT,
        lv: null,
        npLv: 5,
        review: {
          reasons: ['out-of-range'],
          undecided: ['lv'],
          servantCandidates: [],
          lvCandidates: [83],
          npLvCandidates: [],
          lvRange: null,
          npLvRange: null,
        },
        crop: 'crop-0-0-0',
      },
    ])
  })

  it('範囲に無い読んだ値は候補にしない', () => {
    const [row] = merge(readingsOf({ failures: [{ kind: 'lv', current: 900, max: 90 }] }))
    expect(row.lv).toBeNull()
    expect(row.review?.lvCandidates).toEqual([])
    expect(row.review?.undecided).toEqual(['lv'])
  })

  it('通らなかった読みが2つあれば、通らなかった種類を無いものとして一番強い組を元にする', () => {
    const rows = merge(
      readingsOf(
        { np: [5, 5], failures: [{ kind: 'lv', current: 83, max: 87 }] },
        { np: [3, 5], failures: [{ kind: 'lv', current: 95, max: 93 }] },
      ),
    )
    expect(rows[0].npLv).toBe(5)
    expect(rows[0].review?.lvCandidates).toEqual([83])
  })

  it('並び順に合わない読みだけなら、宝具Lv の欄を空にして読んだ値と推定した値を候補にする', () => {
    const readings = readingsOf({ lv: [80, 80], np: [3, 5] })
    const check: ReadingCheck = {
      reasons: ['sort-order'],
      failedKinds: ['npLv'],
      estimate: { kind: 'npLv', value: 5, range: null },
    }
    const [row] = merge(readings, {}, [[readings[0], check]])
    expect(row).toMatchObject({ lv: 80, npLv: null })
    expect(row.review).toMatchObject({ reasons: ['sort-order'], undecided: ['npLv'], npLvCandidates: [3, 5], lvCandidates: [] })
  })

  it('推定した範囲を添える', () => {
    const readings = readingsOf({ lv: [1, 50] })
    const check: ReadingCheck = {
      reasons: ['sort-order'],
      failedKinds: ['lv'],
      estimate: { kind: 'lv', value: null, range: { min: 65, max: 70 } },
    }
    const [row] = merge(readings, {}, [[readings[0], check]])
    expect(row.review).toMatchObject({ lvCandidates: [1], lvRange: { min: 65, max: 70 }, npLvRange: null })
  })

  it('レア度に合わない上限: 星5 の「85/85」を取り込まず理由を出す', () => {
    const [row] = merge(readingsOf({ lv: [85, 85], np: [5, 5] }))
    expect(row).toMatchObject({ lv: null, npLv: 5 })
    expect(row.review).toMatchObject({ reasons: ['rarity-mismatch'], undecided: ['lv'], lvCandidates: [85] })
  })

  it('値の無い読みだけのサーヴァントは、値の無い1つの行にする', () => {
    expect(merge(readingsOf({}, {}))).toEqual([accepted(null, null)])
  })

  it('値の無い読みと通らなかった読みだけなら、通らなかった読みから「要確認」にする', () => {
    const [row] = merge(readingsOf({}, { failures: [{ kind: 'lv', current: 83, max: 87 }] }))
    expect(row.review?.reasons).toEqual(['out-of-range'])
    expect(row.crop).toBe('crop-1-0-0')
  })

  it('行はサーヴァントごとに1つで、初めに出た順に並ぶ', () => {
    const readings = [
      card(0, 0, 0, { servant: 2, lv: [90, 90] }),
      card(0, 0, 1, { servant: 1, lv: [80, 80] }),
      card(1, 0, 0, { servant: 2, lv: [70, 70] }),
    ]
    expect(merge(readings).map((r) => [r.servantId, r.lv])).toEqual([
      [2, 90],
      [1, 80],
    ])
  })
})

describe('mergeRoster: 顔が「要確認」のカード', () => {
  it('1枚ごとに1つの行にし、近いサーヴァントを候補にする', () => {
    const readings = [
      card(0, 1, 2, { servant: null, nearest: [7, 8], lv: [90, 90], np: [2, 5] }),
      card(1, 0, 3, { servant: null, nearest: [7], lv: [90, 90], np: [2, 5] }),
    ]
    const rows = merge(readings)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      key: 'card-0-1-2',
      servantId: null,
      lv: 90,
      npLv: 2,
      review: {
        reasons: ['ambiguous-face'],
        undecided: [],
        servantCandidates: [7, 8],
        lvCandidates: [],
        npLvCandidates: [],
        lvRange: null,
        npLvRange: null,
      },
      crop: 'crop-0-1-2',
    })
    expect(rows[1].key).toBe('card-1-0-3')
  })

  it('値の範囲に通らなかった種類は欄を空にして決めていない欄にする', () => {
    const [row] = merge([card(0, 0, 0, { servant: null, failures: [{ kind: 'lv', current: 83, max: 87 }] })])
    expect(row).toMatchObject({ servantId: null, lv: null, npLv: null })
    expect(row.review).toMatchObject({ reasons: ['ambiguous-face', 'out-of-range'], undecided: ['lv'], lvCandidates: [83] })
  })

  it('前に取り込んだ値とは比べない（サーヴァントが決まっていない）', () => {
    const [row] = mergeRoster(
      [card(0, 0, 0, { servant: null, lv: [10, 50] })],
      new Map(),
      { [SERVANT]: { lv: 90 } },
    )
    expect(row.review?.reasons).toEqual(['ambiguous-face'])
    expect(row.lv).toBe(10)
  })
})

describe('mergeRoster: 前に取り込んだ保存値との比較', () => {
  it('前に取り込んだ値より低い: Lv の欄を空にして 80 と 90 を候補にする', () => {
    const [row] = merge(readingsOf({ lv: [80, 80], np: [2, 5] }), { [SERVANT]: { lv: 90 } })
    expect(row).toMatchObject({ lv: null, npLv: 2 })
    expect(row.review).toEqual({
      reasons: ['lower-than-saved'],
      undecided: ['lv'],
      servantCandidates: [],
      lvCandidates: [80, 90],
      npLvCandidates: [],
      lvRange: null,
      npLvRange: null,
    })
  })

  it('宝具Lv が低ければ宝具Lv の欄を空にする', () => {
    const [row] = merge(readingsOf({ lv: [90, 90], np: [2, 5] }), { [SERVANT]: { lv: 80, npLv: 3 } })
    expect(row).toMatchObject({ lv: 90, npLv: null })
    expect(row.review).toMatchObject({ undecided: ['npLv'], npLvCandidates: [2, 3], lvCandidates: [] })
  })

  it('取り込まない個体は前回の保存値と比べない', () => {
    const rows = merge(readingsOf({ lv: [60, 60], np: [5, 5] }, { lv: [1, 50], np: [5, 5] }), {
      [SERVANT]: { lv: 60, npLv: 5 },
    })
    expect(rows).toEqual([accepted(60, 5)])
  })

  it('同じか高ければ「要確認」にしない', () => {
    expect(merge(readingsOf({ lv: [90, 90], np: [2, 5] }), { [SERVANT]: { lv: 90, npLv: 1 } })).toEqual([
      accepted(90, 2),
    ])
  })

  it('通った読みが無い行でも、検査に通った種類が保存値より低ければ欄を空にする', () => {
    const [row] = merge(readingsOf({ lv: [85, 85], np: [3, 5] }), { [SERVANT]: { npLv: 5 } })
    expect(row).toMatchObject({ lv: null, npLv: null })
    expect(row.review).toMatchObject({
      reasons: ['rarity-mismatch', 'lower-than-saved'],
      undecided: ['lv', 'npLv'],
      lvCandidates: [85],
      npLvCandidates: [3, 5],
    })
  })

  it('読みに無い種類と保存値の無い種類は比べない', () => {
    expect(merge(readingsOf({ lv: [80, 80] }), { [SERVANT]: { npLv: 5 } })).toEqual([accepted(80, null)])
    expect(merge(readingsOf({ lv: [80, 80], np: [1, 5] }), { 999: { lv: 120 } })).toEqual([accepted(80, 1)])
  })
})

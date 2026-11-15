import { describe, expect, it } from 'vitest'
import { countServantLevels, readServantLevels, withServantLevel, withServantLevels } from './servant-levels'

describe('readServantLevels', () => {
  it('Lv 1〜120・宝具Lv 1〜5 の整数だけを通す', () => {
    expect(
      readServantLevels({
        a: { lv: 1, npLv: 5 },
        b: { lv: 120, npLv: 1 },
        c: { lv: 0, npLv: 6 },
        d: { lv: 121, npLv: 0 },
        e: { lv: 90.5, npLv: 2.5 },
      }),
    ).toEqual({ a: { lv: 1, npLv: 5 }, b: { lv: 120, npLv: 1 } })
  })

  it('保存値が壊れている: 数でない Lv は無いものとし、ほかのサーヴァントはそのまま読む', () => {
    expect(readServantLevels({ 100100: { lv: 'abc', npLv: 3 }, 200100: { lv: 80 }, 300100: null, 400100: [1] })).toEqual({
      100100: { npLv: 3 },
      200100: { lv: 80 },
    })
  })

  it('全体が表でなければ空', () => {
    expect(readServantLevels(null)).toEqual({})
    expect(readServantLevels([{ lv: 1 }])).toEqual({})
    expect(readServantLevels('x')).toEqual({})
    expect(readServantLevels(undefined)).toEqual({})
  })
})

describe('countServantLevels', () => {
  it('Lv か宝具Lv の値を持つサーヴァントだけを数える', () => {
    expect(countServantLevels({ a: { lv: 90 }, b: { npLv: 2 }, c: { lv: 'x' }, d: {}, e: { future: 1 } })).toBe(2)
    expect(countServantLevels(null)).toBe(0)
    expect(countServantLevels({})).toBe(0)
  })
})

describe('withServantLevels', () => {
  it('片方の値だけ読んだ: Lv だけを置き換え、保存されている宝具Lv を残す', () => {
    expect(withServantLevels({ 100100: { lv: 90, npLv: 3 } }, [{ id: 100100, lv: 100 }])).toEqual({
      100100: { lv: 100, npLv: 3 },
    })
    expect(withServantLevels({ 100100: { lv: 90, npLv: 3 } }, [{ id: '100100', lv: null, npLv: 4 }])).toEqual({
      100100: { lv: 90, npLv: 4 },
    })
  })

  it('写っていないサーヴァントは変えない', () => {
    const prev = { 100100: { lv: 80 }, 200100: { lv: 70, npLv: 1 } }
    expect(withServantLevels(prev, [{ id: 200100, lv: 90 }])).toEqual({ 100100: { lv: 80 }, 200100: { lv: 90, npLv: 1 } })
  })

  it('知らない欄を残す', () => {
    const prev = { 100100: { lv: 90, ascension: 'final', note: { a: 1 } } }
    expect(withServantLevels(prev, [{ id: 100100, lv: 100 }])).toEqual({
      100100: { lv: 100, ascension: 'final', note: { a: 1 } },
    })
  })

  it('知らないサーヴァントの項目を残す', () => {
    const prev = { 999999: { lv: 50, x: true }, 888888: 'raw' }
    expect(withServantLevels(prev, [{ id: 100100, lv: 90, npLv: 2 }])).toEqual({
      999999: { lv: 50, x: true },
      888888: 'raw',
      100100: { lv: 90, npLv: 2 },
    })
  })

  it('前の保存値を書き換えない', () => {
    const prev = { 100100: { lv: 90 } }
    withServantLevels(prev, [{ id: 100100, lv: 100 }])
    expect(prev).toEqual({ 100100: { lv: 90 } })
  })

  it('値が無いか範囲の外の行は項目を作らず、壊れた項目は表に直して値を入れる', () => {
    expect(withServantLevels({}, [{ id: 1 }, { id: 2, lv: 121, npLv: 0 }])).toEqual({})
    expect(withServantLevels({ 1: 'broken' }, [{ id: 1, lv: 10 }])).toEqual({ 1: { lv: 10 } })
    expect(withServantLevels(null, [{ id: 1, npLv: 5 }])).toEqual({ 1: { npLv: 5 } })
  })
})

describe('withServantLevel', () => {
  it('数の欄は置き換える', () => {
    expect(withServantLevel({ 100100: { lv: 90, npLv: 2 } }, 100100, { lv: 100, npLv: 2 })).toEqual({
      100100: { lv: 100, npLv: 2 },
    })
    expect(withServantLevel({}, '100100', { lv: 80, npLv: 1 })).toEqual({ 100100: { lv: 80, npLv: 1 } })
  })

  it('null の欄は消す: 片方だけを消すともう片方が残る', () => {
    expect(withServantLevel({ 100100: { lv: 90, npLv: 2 } }, 100100, { lv: 90, npLv: null })).toEqual({
      100100: { lv: 90 },
    })
    expect(withServantLevel({ 100100: { lv: 90, npLv: 2 } }, 100100, { lv: null, npLv: 2 })).toEqual({
      100100: { npLv: 2 },
    })
  })

  it('両方を消すと残る欄の無い項目はキーごと消す', () => {
    expect(withServantLevel({ 100100: { lv: 90, npLv: 2 }, 200100: { lv: 80 } }, 100100, { lv: null, npLv: null })).toEqual({
      200100: { lv: 80 },
    })
    expect(withServantLevel({}, 100100, { lv: null, npLv: null })).toEqual({})
  })

  it('知らない欄を残す: 両方を消しても知らない欄があれば項目は残る', () => {
    const prev = { 100100: { lv: 90, future: { a: [1] } } }
    expect(withServantLevel(prev, 100100, { lv: null, npLv: null })).toEqual({ 100100: { future: { a: [1] } } })
    expect(withServantLevel(prev, 100100, { lv: 100, npLv: 3 })).toEqual({ 100100: { lv: 100, npLv: 3, future: { a: [1] } } })
  })

  it('ほかの騎と知らない騎の項目を変えない', () => {
    const prev = { 100100: { lv: 90 }, 200100: { lv: 70, npLv: 1 }, 999999: { lv: 'x', other: true }, 888888: 'raw' }
    expect(withServantLevel(prev, 100100, { lv: 100, npLv: null })).toEqual({
      100100: { lv: 100 },
      200100: { lv: 70, npLv: 1 },
      999999: { lv: 'x', other: true },
      888888: 'raw',
    })
  })

  it('前の保存値を書き換えない', () => {
    const prev = { 100100: { lv: 90, npLv: 2 } }
    withServantLevel(prev, 100100, { lv: null, npLv: null })
    expect(prev).toEqual({ 100100: { lv: 90, npLv: 2 } })
  })

  it('壊れた前の値: 全体が表でなければ空の表に重ね、その騎の項目が表でなければ空の表として扱う', () => {
    expect(withServantLevel(null, 1, { lv: 10, npLv: null })).toEqual({ 1: { lv: 10 } })
    expect(withServantLevel([1, 2], 1, { lv: 10, npLv: null })).toEqual({ 1: { lv: 10 } })
    expect(withServantLevel('x', 1, { lv: null, npLv: null })).toEqual({})
    expect(withServantLevel({ 1: 'broken', 2: { lv: 5 } }, 1, { lv: null, npLv: 4 })).toEqual({ 1: { npLv: 4 }, 2: { lv: 5 } })
    expect(withServantLevel({ 1: 42 }, 1, { lv: null, npLv: null })).toEqual({})
    expect(withServantLevel({ 1: [90] }, 1, { lv: 90, npLv: null })).toEqual({ 1: { lv: 90 } })
  })
})

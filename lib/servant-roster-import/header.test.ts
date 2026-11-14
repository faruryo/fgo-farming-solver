import { describe, expect, it } from 'vitest'
import { headerRects, readOwnedCount, readSortKey, readSortOrder } from './header'
import type { OcrBox, Rect } from './types'

const box = (text: string, x: number, confidence = 0.99): OcrBox => ({ text, confidence, x, y: 0, width: 40, height: 20 })

describe('headerRects', () => {
  it('実測の見出しの枠から、3つの矩形が実測の値から 2 画素以内になる', () => {
    const heading = { x: 568, y: 48, width: 869, height: 57 }
    const rects = headerRects(heading)
    const expectNear = (actual: Rect, expected: Rect) => {
      expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(2)
      expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(2)
      expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(2)
      expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(2)
    }
    expectNear(rects.owned, { x: 568 - 68, y: 48 + 122, width: 450, height: 120 })
    expectNear(rects.sortKey, { x: 568 + 1612, y: 48 + 122, width: 380, height: 120 })
    expectNear(rects.sortOrder, { x: 568 + 1932, y: 48 + 92, width: 190, height: 100 })
  })

  it('見出しの枠の大きさに合わせて伸び縮みする', () => {
    const rects = headerRects({ x: 0, y: 0, width: 434.5, height: 28.5 })
    expect(Math.abs(rects.sortKey.x - 806)).toBeLessThanOrEqual(1)
    expect(Math.abs(rects.sortKey.width - 190)).toBeLessThanOrEqual(1)
  })
})

describe('readOwnedCount', () => {
  it('「554/1100」に見出しの「:」が別の枠で付いても 554 を読む', () => {
    expect(readOwnedCount([box(':', 0, 0.4), box('554/1100', 20)])).toBe(554)
  })

  it('「:554/1100」のように同じ枠に付いても 554 を読む', () => {
    expect(readOwnedCount([box(':554/1100', 0)])).toBe(554)
  })

  it('「数字/数字」の形が無ければ null', () => {
    expect(readOwnedCount([box('554/', 0)])).toBeNull()
    expect(readOwnedCount([])).toBeNull()
  })
})

describe('readSortKey', () => {
  it.each([
    [['宝具Lv.順'], 'npLv'],
    [['宝具LV.順'], 'npLv'],
    [['Lv.順'], 'lv'],
    [['LV.順'], 'lv'],
    [['Lv. 順'], 'lv'],
    [['Lv.', '順'], 'lv'],
    [['宝具Lv.', '順'], 'npLv'],
    [['Lv.順', 'X'], 'lv'],
    [['宝具Lv.順', 'V'], 'npLv'],
  ] as const)('%j を読む', (texts, expected) => {
    expect(readSortKey(texts.map((t, i) => box(t, i * 50)))).toBe(expected)
  })

  it.each([[['レア度順']], [['クラス順']], [['Lv']], [['宝具Lv.']], [['ALv.順']], [[]], [['宝具Lv.順', 'Lv.順']]])(
    'どちらでもない %j は読めない',
    (texts) => {
      expect(readSortKey(texts.map((t, i) => box(t, i * 50)))).toBeNull()
    },
  )
})

describe('readSortOrder', () => {
  it.each([
    [['降順'], 'desc'],
    [['昇順'], 'asc'],
    [['降順', 'V'], 'desc'],
    [['X', '降順'], 'desc'],
    [['降', '順'], 'desc'],
  ] as const)('%j を読む', (texts, expected) => {
    expect(readSortOrder(texts.map((t, i) => box(t, i * 50)))).toBe(expected)
  })

  it.each([[['順']], [['V', 'X']], [[]], [['降順', '昇順']], [['降順昇順']]])('どちらでもない %j は読めない', (texts) => {
    expect(readSortOrder(texts.map((t, i) => box(t, i * 50)))).toBeNull()
  })
})

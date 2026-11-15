import { describe, expect, it } from 'vitest'
import { cardBandRects, clipRect, findRosterHeading, gridFromHeading, gridTopY, readRosterGrid } from './grid'
import type { OcrBox } from './types'

const box = (text: string, x: number, y: number, width: number, height: number): OcrBox => ({
  text,
  confidence: 1,
  x,
  y,
  width,
  height,
})

/** 実物の画面（2796×1290）で読めた見出しの枠 */
const HEADING = box('強化するサーヴァントを選択してください', 568, 48, 869, 57)

describe('readRosterGrid', () => {
  it('実測の見出しの枠から、列の位置と一辺が実測の値から 2 画素以内になる', () => {
    const grid = readRosterGrid([box('所持サーヴァント:', 400, 170, 300, 50), HEADING])
    if (grid === 'unreadable') throw new Error('unreadable')
    expect(grid.unit).toBe(57)
    expect(Math.abs(grid.side - 199)).toBeLessThanOrEqual(2)
    expect(grid.columnXs).toHaveLength(7)
    grid.columnXs.forEach((x, i) => expect(Math.abs(x - (389 + i * 238.8))).toBeLessThanOrEqual(2))
    expect(Math.abs(gridTopY(grid) - 310)).toBeLessThanOrEqual(2)
  })

  it('見出しの枠の位置と大きさを半分にすると、結果も半分になる', () => {
    const full = readRosterGrid([HEADING])
    const half = readRosterGrid([box(HEADING.text, 284, 24, 434.5, 28.5)])
    if (full === 'unreadable' || half === 'unreadable') throw new Error('unreadable')
    expect(half.side).toBeCloseTo(full.side / 2, 6)
    half.columnXs.forEach((x, i) => expect(x).toBeCloseTo((full.columnXs.at(i) ?? NaN) / 2, 6))
    expect(gridTopY(half)).toBeCloseTo(gridTopY(full) / 2, 6)
  })

  it('見出しの無い一覧は読めなかった画像になる', () => {
    expect(readRosterGrid([])).toBe('unreadable')
    expect(readRosterGrid([box('所持サーヴァント:', 400, 170, 300, 50), box('宝具Lv.順', 2180, 170, 300, 50)])).toBe(
      'unreadable',
    )
  })

  it('別の選択画面の見出しと、2つの枠に分かれた見出しは当たらない', () => {
    expect(readRosterGrid([box('霊基再臨するサーヴァントを選択してください', 568, 48, 869, 57)])).toBe('unreadable')
    expect(readRosterGrid([box('強化するサーヴァ', 568, 48, 400, 57), box('ントを選択してください', 970, 48, 460, 57)])).toBe(
      'unreadable',
    )
  })
})

describe('findRosterHeading', () => {
  it('空白と記号が混じって読めた見出しも当たる', () => {
    expect(findRosterHeading([box(' 強化する サーヴァント を、選択してください。', 10, 20, 30, 40)])).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })
})

describe('clipRect', () => {
  it('画像からはみ出す部分を除き、重ならなければ null', () => {
    expect(clipRect({ x: -10, y: 5, width: 30, height: 10 }, 100, 50)).toEqual({ x: 0, y: 5, width: 20, height: 10 })
    expect(clipRect({ x: 90, y: 45, width: 30, height: 10 }, 100, 50)).toEqual({ x: 90, y: 45, width: 10, height: 5 })
    expect(clipRect({ x: 100, y: 0, width: 30, height: 10 }, 100, 50)).toBeNull()
  })
})

describe('cardBandRects', () => {
  it('実測の顔の正方形から、実測の文字の帯の矩形になる', () => {
    const grid = gridFromHeading(HEADING)
    const { top, bottom } = cardBandRects({ x: 389, y: 346, width: grid.side, height: grid.side }, grid.unit)
    // 上の帯: 顔の左上から右へ 30・下へ −4、幅 180・高さ 48
    expect(Math.abs(top.x - (389 + 30))).toBeLessThanOrEqual(2)
    expect(Math.abs(top.y - (346 - 4))).toBeLessThanOrEqual(2)
    expect(Math.abs(top.width - 180)).toBeLessThanOrEqual(2)
    expect(Math.abs(top.height - 48)).toBeLessThanOrEqual(2)
    // 下の帯: 右へ 50・下へ 158、幅 160・高さ 44
    expect(Math.abs(bottom.x - (389 + 50))).toBeLessThanOrEqual(2)
    expect(Math.abs(bottom.y - (346 + 158))).toBeLessThanOrEqual(2)
    expect(Math.abs(bottom.width - 160)).toBeLessThanOrEqual(2)
    expect(Math.abs(bottom.height - 44)).toBeLessThanOrEqual(2)
  })
})

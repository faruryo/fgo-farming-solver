import { describe, expect, it } from 'vitest'
import {
  cardBandRects,
  clipRect,
  findRosterHeading,
  wideColumnGrid,
  gridFromHeading,
  gridTopY,
  readRosterGrid,
} from './grid'
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
      screen: 'enhance',
      heading: { x: 10, y: 20, width: 30, height: 40 },
    })
  })
})

/** 「スキルを強化するサーヴァントを選択してください」の見出し（サーヴァント強化の見出しより小さく、上にずれる） */
const SKILL_TEXT = 'スキルを強化するサーヴァントを選択してください'
const SECOND_LINE = '強化には各種素材アイテムが必要です'

describe('findRosterHeading（サーヴァントスキル強化）', () => {
  // 1行目の上端 35 と 2行目の上端 83 の間隔は 48。サーヴァント強化の見出しの枠（上端 48・高さ 57）に換算する
  it.each([
    ['2行目あり・1行目の高さ 44', 44, true, { y: 48, height: 57 }],
    ['2行目あり・1行目の高さが 39 にぶれても同じ', 39, true, { y: 48, height: 57 }],
    ['2行目なし・1行目の高さ 44', 44, false, { y: 48, height: 57 }],
  ])('%s', (_name, height, withSecond, expected) => {
    const boxes = [box(SKILL_TEXT, 568, 35, 869, height), ...(withSecond ? [box(SECOND_LINE, 568, 83, 700, height)] : [])]
    expect(findRosterHeading(boxes)).toEqual({ screen: 'skill', heading: { x: 568, width: 869, ...expected } })
  })

  it('2行目が読めないときは、1行目の枠の高さから換算する（高さがぶれると誤差が出る）', () => {
    const found = findRosterHeading([box(SKILL_TEXT, 568, 35, 869, 39)])
    expect(found?.screen).toBe('skill')
    expect(found?.heading.height).toBeCloseTo((39 * 57) / 44, 6)
    expect(found?.heading.y).toBeCloseTo(35 + (39 * 13) / 44, 6)
  })

  it('1行目の下 3 行分より遠い枠と、1行目より上の枠は2行目に使わない', () => {
    const far = findRosterHeading([box(SKILL_TEXT, 568, 35, 869, 44), box(SECOND_LINE, 568, 35 + 44 * 3, 700, 44)])
    const above = findRosterHeading([box(SKILL_TEXT, 568, 35, 869, 44), box(SECOND_LINE, 568, 5, 700, 44)])
    expect(far?.heading.height).toBeCloseTo(57, 6)
    expect(above?.heading.height).toBeCloseTo(57, 6)
    // 2行目に使うと間隔が 132（遠い枠）・負（上の枠）になって高さが変わるはずなので、どちらも使われていない
    expect(far?.heading.y).toBeCloseTo(48, 6)
    expect(above?.heading.y).toBeCloseTo(48, 6)
  })

  it('「スキルを」が分かれて読めず、サーヴァント強化の見出しの文字しか当たらなくても、すぐ下に2行目があればスキル強化の画面にする', () => {
    const found = findRosterHeading([
      box('強化するサーヴァントを選択してください', 568, 35, 869, 44),
      box(SECOND_LINE, 568, 83, 700, 44),
    ])
    expect(found).toEqual({ screen: 'skill', heading: { x: 568, y: 48, width: 869, height: 57 } })
  })

  it('サーヴァント強化の見出しの下に2行目が無い、遠い、上にあるときは、サーヴァント強化の画面のまま', () => {
    const enhance = (second: OcrBox) => findRosterHeading([box('強化するサーヴァントを選択してください', 568, 35, 869, 44), second])
    expect(enhance(box('所持サーヴァント:', 568, 83, 700, 44))?.screen).toBe('enhance')
    expect(enhance(box(SECOND_LINE, 568, 35 + 44 * 3, 700, 44))?.screen).toBe('enhance')
    expect(enhance(box(SECOND_LINE, 568, 5, 700, 44))?.screen).toBe('enhance')
  })

  it('換算した見出しの枠の格子は、サーヴァント強化の画面と同じ列の位置になる', () => {
    const skill = readRosterGrid([box(SKILL_TEXT, 568, 35, 869, 44), box(SECOND_LINE, 568, 83, 700, 44)])
    const enhance = readRosterGrid([HEADING])
    if (skill === 'unreadable' || enhance === 'unreadable') throw new Error('unreadable')
    expect(skill.screen).toBe('skill')
    expect(enhance.screen).toBe('enhance')
    skill.columnXs.forEach((x, i) => expect(x).toBeCloseTo(enhance.columnXs.at(i) ?? NaN, 6))
    expect(gridTopY(skill)).toBeCloseTo(gridTopY(enhance), 6)
  })

  it('2つの枠に分かれた見出しは当たらない', () => {
    expect(readRosterGrid([box('スキルを強化するサ', 568, 35, 400, 44), box('ーヴァントを選択してください', 970, 35, 460, 44)])).toBe(
      'unreadable',
    )
  })
})

describe('wideColumnGrid', () => {
  it('5列で、いちばん左の列の顔の左端と格子の上の端は7列と同じ、大きさと間隔は 1.41 倍', () => {
    const grid = gridFromHeading(HEADING, 'skill')
    const five = wideColumnGrid(grid, { columns: 5, scale: 1.41 })
    expect(five.columnXs).toHaveLength(5)
    expect(five.columnXs.at(0)).toBeCloseTo(grid.columnXs.at(0) ?? NaN, 6)
    expect(gridTopY(five)).toBeCloseTo(gridTopY(grid), 6)
    expect(five.unit).toBeCloseTo(grid.unit * 1.41, 6)
    expect(five.side).toBeCloseTo(grid.side * 1.41, 6)
    const pitch = (g: typeof grid) => (g.columnXs.at(1) ?? NaN) - (g.columnXs.at(0) ?? NaN)
    expect(pitch(five)).toBeCloseTo(pitch(grid) * 1.41, 6)
    expect(five.screen).toBe('skill')
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

  it('スキル強化の画面では、下の帯がスキルLv の帯（Lv の帯より上）になり、上の帯は同じ', () => {
    const grid = gridFromHeading(HEADING, 'skill')
    const face = { x: 389, y: 346, width: grid.side, height: grid.side }
    const enhance = cardBandRects(face, grid.unit)
    const skill = cardBandRects(face, grid.unit, 'skill')
    expect(skill.top).toEqual(enhance.top)
    // 顔の左上から 右へ 0.95・下へ 2.35、幅 2.5・高さ 0.62（見出しの枠の高さ 57 の倍数）
    expect(skill.bottom.x).toBeCloseTo(389 + 0.95 * 57, 6)
    expect(skill.bottom.y).toBeCloseTo(346 + 2.35 * 57, 6)
    expect(skill.bottom.width).toBeCloseTo(2.5 * 57, 6)
    expect(skill.bottom.height).toBeCloseTo(0.62 * 57, 6)
    expect(skill.bottom.y).toBeLessThan(enhance.bottom.y)
  })
})

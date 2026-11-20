import { describe, expect, it } from 'vitest'
import type { OcrBox } from './types'
import { isPossibleLvCap, readCardValues, readSkillLevels } from './values'

let nextX = 0
const box = (text: string, confidence = 0.95): OcrBox => {
  nextX += 100
  return { text, confidence, x: nextX, y: 0, width: 80, height: 20 }
}
const band = (...texts: (string | [string, number])[]): OcrBox[] =>
  texts.map((t) => (typeof t === 'string' ? box(t) : box(t[0], t[1])))

describe('readCardValues', () => {
  it.each([
    ['宝具Lv.5/5', 5, 5],
    ['宝具LV.5/5', 5, 5],
    ['宝具Lv.1/5', 1, 5],
  ])('上の帯の %s を宝具Lv にする', (text, current, max) => {
    expect(readCardValues(band(text), [])).toEqual({ lv: null, npLv: { current, max }, skills: null, failures: [] })
  })

  it.each([
    ['Lv.80/80', 80, 80],
    ['Lv. 80/80', 80, 80],
    ['Lv:120/120', 120, 120],
    ['Lv120/120', 120, 120],
    ['Ly.100/100', 100, 100],
    ['4Lv.100/100', 100, 100],
    ['Lv.116/118', 116, 118],
    ['ILv.120/120', 120, 120],
    ['y120/120', 120, 120],
    ['Lv.1/50', 1, 50],
    ['Lv.3/50', 3, 50],
    ['Lv.1/20', 1, 20],
    ['Lv.1/25', 1, 25],
    ['Lv.1/30', 1, 30],
    ['Lv.40/40', 40, 40],
    ['Lv.60/60', 60, 60],
    ['Lv.65/65', 65, 65],
  ])('%s を Lv にする', (text, current, max) => {
    expect(readCardValues(band(text), [])).toEqual({ lv: { current, max }, npLv: null, skills: null, failures: [] })
  })

  it('宝具Lv.順の画像: 上の「宝具Lv.5/5」と下の「Lv. 80/80」から両方を読む', () => {
    expect(readCardValues(band('宝具Lv.5/5'), band('Lv. 80/80'))).toEqual({
      lv: { current: 80, max: 80 },
      npLv: { current: 5, max: 5 },
      skills: null,
      failures: [],
    })
  })

  it('再臨していないサーヴァント: 「宝具Lv.1/5」と「Lv. 1/50」を通す', () => {
    expect(readCardValues(band('宝具Lv.1/5'), band('Lv. 1/50'))).toEqual({
      lv: { current: 1, max: 50 },
      npLv: { current: 1, max: 5 },
      skills: null,
      failures: [],
    })
  })

  it('Lv.順の画像: 下の帯に値の文字が無ければ宝具Lv は無い', () => {
    expect(readCardValues(band('Lv. 116/118'), [])).toEqual({ lv: { current: 116, max: 118 }, npLv: null, skills: null, failures: [] })
  })

  it.each([
    [['2', 0.3], 'Lv.80/80'],
    ['Lv.80/80', ['2', 0.3]],
    ['Lv.80/80', ['4', 0.4]],
    [['un', 0.2], 'Lv.80/80'],
  ] as [string | [string, number], string | [string, number]][])(
    '余計な枠（%s, %s）が付いても Lv 80 を読む',
    (a, b) => {
      expect(readCardValues([], band(a, b))).toEqual({ lv: { current: 80, max: 80 }, npLv: null, skills: null, failures: [] })
    },
  )

  it('「宝具Lv.」と「5/5」が別の枠に分かれても宝具Lv にする', () => {
    expect(readCardValues(band('宝具Lv.', '5/5'), []).npLv).toEqual({ current: 5, max: 5 })
  })

  it('「Lv.」「80」「/80」のように枠をまたいだ形も読む', () => {
    expect(readCardValues([], band('Lv.80', '/80')).lv).toEqual({ current: 80, max: 80 })
  })

  it('1つの帯に「数字/数字」が2つあれば確からしいほうを使う', () => {
    expect(readCardValues(band(['Lv.70/70', 0.5], ['Lv.80/80', 0.9]), []).lv).toEqual({ current: 80, max: 80 })
    expect(readCardValues(band(['Lv.70/70', 0.9], ['Lv.80/80', 0.5]), []).lv).toEqual({ current: 70, max: 70 })
  })

  it('宝具Lv でない「5/5」（宝も具も無い）は宝具Lv にせず、通らなかった読みにする', () => {
    expect(readCardValues(band('Lv.5/5'), [])).toEqual({
      lv: null,
      npLv: null,
      skills: null,
      failures: [{ kind: 'npLv', current: 5, max: 5 }],
    })
  })

  it('「宝」だけ・「具」だけでも宝具Lv にする', () => {
    expect(readCardValues(band('宝Lv.3/5'), []).npLv).toEqual({ current: 3, max: 5 })
    expect(readCardValues(band('具Lv.3/5'), []).npLv).toEqual({ current: 3, max: 5 })
  })

  it.each([
    ['900/90', 'lv', 900, 90],
    ['83/87', 'lv', 83, 87],
    ['Lv.0/50', 'lv', 0, 50],
    ['Lv.91/90', 'lv', 91, 90],
    ['Lv.1/15', 'lv', 1, 15],
    ['Lv.1/122', 'lv', 1, 122],
    ['Lv.93/93', 'lv', 93, 93],
    ['Lv.1/4', 'npLv', 1, 4],
    ['宝具Lv.6/5', 'npLv', 6, 5],
    ['宝具Lv.0/5', 'npLv', 0, 5],
  ])('%s は値を決めず、通らなかった読みにする', (text, kind, current, max) => {
    expect(readCardValues(band(text), [])).toEqual({ lv: null, npLv: null, skills: null, failures: [{ kind, current, max }] })
  })

  it('「Lv.70170」は Lv の無い読みになり、別の値を入れない', () => {
    expect(readCardValues(band('宝具Lv.5/5'), band('Lv.70170'))).toEqual({
      lv: null,
      npLv: { current: 5, max: 5 },
      skills: null,
      failures: [],
    })
  })

  it('値でない文字だけなら何も返さない', () => {
    expect(readCardValues([], band('X', 'XX'))).toEqual({ lv: null, npLv: null, skills: null, failures: [] })
    expect(readCardValues(band('做', '多'), band('un'))).toEqual({ lv: null, npLv: null, skills: null, failures: [] })
    expect(readCardValues([], [])).toEqual({ lv: null, npLv: null, skills: null, failures: [] })
  })

  it('全角の「／」も区切りとして読む', () => {
    expect(readCardValues(band('Lv.90／90'), []).lv).toEqual({ current: 90, max: 90 })
  })
})

describe('isPossibleLvCap', () => {
  it('20 から 90 までの 5 刻みと、92 から 120 までの 2 刻みだけを通す', () => {
    const caps = Array.from({ length: 130 }, (_, i) => i).filter(isPossibleLvCap)
    const expected = [
      ...Array.from({ length: 15 }, (_, i) => 20 + i * 5),
      ...Array.from({ length: 15 }, (_, i) => 92 + i * 2),
    ]
    expect(caps).toEqual(expected)
  })
})

describe('readSkillLevels', () => {
  it.each([
    ['9/10/9', [9, 10, 9]],
    ['10/10/10', [10, 10, 10]],
    ['1/1/1', [1, 1, 1]],
    ['9 / 10 / 9', [9, 10, 9]],
    ['9／10／9', [9, 10, 9]],
    ['Lv10/10/9', [10, 10, 9]],
    ['スキルLv.9/10/9', [9, 10, 9]],
    ['9/10/9 強', [9, 10, 9]],
  ])('%s はスキル1〜3の Lv', (text, expected) => {
    expect(readSkillLevels(band(text))).toEqual(expected)
  })

  it('枠が分かれて読めた「9」「/10/」「9」も、左から並べてつなぐ', () => {
    expect(readSkillLevels([box('9/10'), box('/9')])).toEqual([9, 10, 9])
  })

  it.each([
    ['範囲の上（11）', '11/10/9'],
    ['範囲の下（0）', '0/10/9'],
    ['2つしか無い', '9/10'],
    ['数字が無い', 'スキルLv.MAX'],
    ['空', ''],
  ])('%s は null', (_name, text) => {
    expect(readSkillLevels(band(text))).toBeNull()
  })

  it('枠が1つも無ければ null', () => {
    expect(readSkillLevels([])).toBeNull()
  })
})

describe('readCardValues（サーヴァントスキル強化の画面）', () => {
  it('上の帯の宝具Lv と、下の帯のスキルLv を読む', () => {
    expect(readCardValues(band('宝具Lv.3/5'), band('9/10/9'), 'skill')).toEqual({
      lv: null,
      npLv: { current: 3, max: 5 },
      skills: [9, 10, 9],
      failures: [],
    })
  })

  it('下の帯に Lv の形（80/80）があっても Lv は読まない', () => {
    expect(readCardValues(band('宝具Lv.5/5'), band('Lv. 80/80'), 'skill')).toEqual({
      lv: null,
      npLv: { current: 5, max: 5 },
      skills: null,
      failures: [],
    })
  })

  it('スキルLv が読めなくても宝具Lv は読み、宝具Lv が範囲の外なら値を決めない', () => {
    expect(readCardValues(band('宝具Lv.3/5'), [], 'skill').skills).toBeNull()
    expect(readCardValues(band('宝具Lv.51/5'), band('9/10/9'), 'skill')).toEqual({
      lv: null,
      npLv: null,
      skills: [9, 10, 9],
      failures: [{ kind: 'npLv', current: 51, max: 5 }],
    })
  })

  it('サーヴァント強化の画面では、下の帯にスキルLv の形があってもスキルLv は読まない', () => {
    expect(readCardValues(band('宝具Lv.3/5'), band('9/10/9')).skills).toBeNull()
  })
})

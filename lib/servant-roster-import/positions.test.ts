import { describe, expect, it } from 'vitest'
import { classifyCardPosition, hasCardValue } from './positions'
import type { FaceMatch, OcrBox } from './types'
import { readCardValues } from './values'

const RECT = { x: 0, y: 0, width: 199, height: 199 }
const ocr = (text: string, confidence = 0.95): OcrBox => ({ text, confidence, x: 0, y: 0, width: 100, height: 40 })

const matched = (servantId: number): FaceMatch => ({ kind: 'matched', servantId, best: 3, second: 25, rect: RECT })
/** 空いた位置の照合の結果（実測で一番近い差 30.2〜31.7） */
const empty: FaceMatch = { kind: 'review', reason: 'unknown-face', nearest: [1, 2], best: 30.5, rect: RECT }
const ambiguous: FaceMatch = { kind: 'review', reason: 'ambiguous-face', nearest: [1, 2], best: 6, rect: RECT }

describe('classifyCardPosition', () => {
  it('最後の段の空き: カードが1枚だけの段は1枚だけを取り出し、空いた位置を「要確認」にしない', () => {
    const row = [
      classifyCardPosition(matched(100100), readCardValues([ocr('宝具Lv.1/5')], [ocr('Lv.1/20')])),
      ...Array.from({ length: 6 }, () => classifyCardPosition(empty, readCardValues([], []))),
    ]
    expect(row).toEqual(['matched', 'discard', 'discard', 'discard', 'discard', 'discard', 'discard'])
  })

  it('空いた位置の背景が文字に読める: 「X」「XX」と読めた位置を捨てる', () => {
    expect(classifyCardPosition(empty, readCardValues([], [ocr('X', 0.66)]))).toBe('discard')
    expect(classifyCardPosition(empty, readCardValues([], [ocr('XX', 1)]))).toBe('discard')
    expect(classifyCardPosition(empty, readCardValues([ocr('X', 0.8)], [ocr('XX', 0.9)]))).toBe('discard')
  })

  it('どのサーヴァントにも近くなくても、値が読めた位置は「要確認」のカードにする', () => {
    expect(classifyCardPosition(empty, readCardValues([ocr('宝具Lv.5/5')], [ocr('Lv.90/90')]))).toBe('review')
    expect(classifyCardPosition(empty, readCardValues([], [ocr('Lv.90/90')]))).toBe('review')
  })

  it('範囲で値を決めなかった読みも、値が読めた位置として「要確認」のカードにする', () => {
    const values = readCardValues([], [ocr('Lv.83/87')])
    expect(values.lv).toBeNull()
    expect(values.failures).not.toHaveLength(0)
    expect(classifyCardPosition(empty, values)).toBe('review')
  })

  it('顔の差が小さいカードは、値が読めなくても「要確認」のカードにする', () => {
    expect(classifyCardPosition(ambiguous, readCardValues([], []))).toBe('review')
  })

  it('当てたカードは、値が読めなくても取り出す', () => {
    expect(classifyCardPosition(matched(100100), readCardValues([], [ocr('X')]))).toBe('matched')
  })
})

describe('hasCardValue', () => {
  it('Lv・宝具Lv・スキルLv・値を決めなかった読みのどれかがあれば値がある', () => {
    expect(hasCardValue({ lv: null, npLv: null, skills: null, failures: [] })).toBe(false)
    expect(hasCardValue({ lv: { current: 1, max: 20 }, npLv: null, skills: null, failures: [] })).toBe(true)
    expect(hasCardValue({ lv: null, npLv: { current: 1, max: 5 }, skills: null, failures: [] })).toBe(true)
    expect(hasCardValue({ lv: null, npLv: null, skills: [9, 10, 9], failures: [] })).toBe(true)
    expect(hasCardValue({ lv: null, npLv: null, skills: null, failures: [{ kind: 'lv', current: 83, max: 87 }] })).toBe(true)
  })
})

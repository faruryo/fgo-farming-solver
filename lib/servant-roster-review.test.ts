import { describe, expect, it } from 'vitest'
import {
  hasInvalidField,
  importRows,
  initialRowEdit,
  isRowDecided,
  levelFieldValue,
  readLevelField,
  type RosterRowEdit,
} from './servant-roster-review'
import type { RosterRow } from './servant-roster-import/types'

const row = (overrides: Partial<RosterRow> = {}): RosterRow => ({
  key: 'r1',
  servantId: 1,
  lv: 90,
  npLv: 2,
  review: null,
  crop: '',
  ...overrides,
})

const edit = (overrides: Partial<RosterRowEdit> = {}): RosterRowEdit => ({
  servantId: 1,
  lv: 90,
  npLv: 2,
  included: true,
  ...overrides,
})

describe('readLevelField', () => {
  it.each([
    [1, { kind: 'value', value: 1 }],
    [120, { kind: 'value', value: 120 }],
    [0, { kind: 'invalid' }],
    [121, { kind: 'invalid' }],
    [1.5, { kind: 'invalid' }],
    [Number.NaN, { kind: 'invalid' }],
    [null, { kind: 'empty' }],
  ])('Lv の欄の値 %s', (value, expected) => {
    expect(readLevelField('lv', value)).toEqual(expected)
  })

  it.each([
    [1, { kind: 'value', value: 1 }],
    [5, { kind: 'value', value: 5 }],
    [6, { kind: 'invalid' }],
    [null, { kind: 'empty' }],
  ])('宝具Lv の欄の値 %s', (value, expected) => {
    expect(readLevelField('npLv', value)).toEqual(expected)
  })
})

describe('levelFieldValue', () => {
  it('範囲に入る値だけを返し、空と範囲に無い値は null', () => {
    expect(levelFieldValue('lv', 90)).toBe(90)
    expect(levelFieldValue('lv', 121)).toBeNull()
    expect(levelFieldValue('npLv', 6)).toBeNull()
    expect(levelFieldValue('npLv', null)).toBeNull()
  })
})

describe('確かめの画面の行', () => {
  it('読み取りの結果の値をそのまま欄の値にする（値が無ければ null）', () => {
    expect(initialRowEdit(row({ lv: 90, npLv: null }))).toEqual({ servantId: 1, lv: 90, npLv: null, included: true })
  })

  it('範囲に無い値か整数でない値の欄があると、不正で取り込みに入れない', () => {
    expect(hasInvalidField(edit())).toBe(false)
    expect(hasInvalidField(edit({ lv: 121 }))).toBe(true)
    expect(hasInvalidField(edit({ npLv: 1.5 }))).toBe(true)
    expect(isRowDecided(row(), edit({ lv: 0 }))).toBe(false)
    expect(importRows([row()], [edit({ npLv: 6 })])).toEqual([])
  })

  it('「要確認」で空にした欄は、範囲に入る値が入るまで決まらない', () => {
    const review: NonNullable<RosterRow['review']> = {
      reasons: ['sort-order'],
      undecided: ['npLv'],
      servantCandidates: [],
      lvCandidates: [],
      npLvCandidates: [],
      lvRange: null,
      npLvRange: null,
    }
    const reviewRow = row({ npLv: null, review })
    expect(isRowDecided(reviewRow, edit({ npLv: null }))).toBe(false)
    expect(isRowDecided(reviewRow, edit({ npLv: 5 }))).toBe(true)
  })

  it('取り込む行は空の欄を null にする', () => {
    expect(importRows([row()], [edit({ npLv: null })])).toEqual([{ id: 1, lv: 90, npLv: null }])
  })
})

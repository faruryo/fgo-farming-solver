import { describe, expect, it } from 'vitest'
import {
  hasInvalidField,
  importRows,
  initialRowEdit,
  isRowDecided,
  levelFieldValue,
  readLevelField,
  readSkillField,
  type RosterRowEdit,
} from './servant-roster-review'
import type { RosterRow } from './servant-roster-import/types'

const row = (overrides: Partial<RosterRow> = {}): RosterRow => ({
  key: 'r1',
  servantId: 1,
  lv: 90,
  npLv: 2,
  skills: null,
  review: null,
  crop: '',
  ...overrides,
})

const edit = (overrides: Partial<RosterRowEdit> = {}): RosterRowEdit => ({
  servantId: 1,
  lv: 90,
  npLv: 2,
  skills: [null, null, null],
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
    expect(initialRowEdit(row({ lv: 90, npLv: null }))).toEqual({
      servantId: 1,
      lv: 90,
      npLv: null,
      skills: [null, null, null],
      included: true,
    })
  })

  it('スキル強化の画面から読んだスキルLv は欄の初めの値になり、読めなかった行は空の3欄', () => {
    expect(initialRowEdit(row({ skills: [9, 10, 9] })).skills).toEqual([9, 10, 9])
    expect(initialRowEdit(row({ skills: null })).skills).toEqual([null, null, null])
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

describe('readSkillField', () => {
  it.each([
    [1, { kind: 'value', value: 1 }],
    [10, { kind: 'value', value: 10 }],
    [0, { kind: 'invalid' }],
    [11, { kind: 'invalid' }],
    [9.5, { kind: 'invalid' }],
    [Number.NaN, { kind: 'invalid' }],
    [null, { kind: 'empty' }],
  ])('スキルLv の欄の値 %s', (value, expected) => {
    expect(readSkillField(value)).toEqual(expected)
  })
})

describe('確かめの画面のスキルLv', () => {
  it('範囲に無いスキルLv の欄があると、不正で取り込みに入れない', () => {
    expect(hasInvalidField(edit({ skills: [9, 10, 9] }))).toBe(false)
    expect(hasInvalidField(edit({ skills: [9, 11, 9] }))).toBe(true)
    expect(hasInvalidField(edit({ skills: [0, null, null] }))).toBe(true)
    expect(importRows([row()], [edit({ skills: [9, 11, 9] })])).toEqual([])
  })

  it('取り込む行にスキルLv を付ける（空の欄は null）', () => {
    expect(importRows([row()], [edit({ skills: [9, null, 10] })])).toEqual([
      { id: 1, lv: 90, npLv: 2, skills: [9, null, 10] },
    ])
  })

  it('スキルLv が3つとも空なら、取り込む行にスキルLv の欄を付けない', () => {
    expect(importRows([row()], [edit()])[0]).not.toHaveProperty('skills')
  })
})

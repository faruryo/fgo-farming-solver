/**
 * サーヴァント強化の選択画面のスクリーンショットから取り込むときの、確かめの画面の入力を扱う純粋関数。
 * 行ごとに、利用者が決めたサーヴァント・Lv・宝具Lv と「取り込みに入れる」印を持ち、取り込める行・重なり・取り込む値を決める。
 */
import {
  isValidServantLv,
  isValidServantNpLv,
  SERVANT_LV_MAX,
  SERVANT_LV_MIN,
  SERVANT_NP_LV_MAX,
  SERVANT_NP_LV_MIN,
  type ServantLevelImportRow,
} from './servant-levels'
import { SKILL_LV_RANGE } from './servant-roster-import/constants'
import type { RosterRow } from './servant-roster-import/types'

export type LevelField = 'lv' | 'npLv'

/** 欄が受ける値の範囲 */
export const levelFieldRange = (field: LevelField): { min: number; max: number } =>
  field === 'lv' ? { min: SERVANT_LV_MIN, max: SERVANT_LV_MAX } : { min: SERVANT_NP_LV_MIN, max: SERVANT_NP_LV_MAX }

/** 確かめの画面の1行の入力 */
export type RosterRowEdit = {
  servantId: number | null
  lv: number | null
  npLv: number | null
  /** スキル1〜3の欄（読めなかった行は3つとも null） */
  skills: (number | null)[]
  included: boolean
}

/** 欄の値の読み。空は 'empty'、1〜120（宝具Lv は 1〜5）の整数でなければ 'invalid' */
export type FieldValue = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'value'; value: number }

const isValid = (field: LevelField, value: number): boolean =>
  field === 'lv' ? isValidServantLv(value) : isValidServantNpLv(value)

/** 欄の値（空の欄は null）を Lv・宝具Lv の範囲で読む */
export const readLevelField = (field: LevelField, value: number | null): FieldValue => {
  if (value === null) return { kind: 'empty' }
  return isValid(field, value) ? { kind: 'value', value } : { kind: 'invalid' }
}

/** スキルLv の欄の値（空は 'empty'、1〜10 の整数でなければ 'invalid'） */
export const readSkillField = (value: number | null): FieldValue => {
  if (value === null) return { kind: 'empty' }
  const valid = Number.isInteger(value) && value >= SKILL_LV_RANGE.min && value <= SKILL_LV_RANGE.max
  return valid ? { kind: 'value', value } : { kind: 'invalid' }
}

/** 欄の値のうち、範囲に入る値だけ（空と範囲に無い値は null） */
export const levelFieldValue = (field: LevelField, value: number | null): number | null => {
  const read = readLevelField(field, value)
  return read.kind === 'value' ? read.value : null
}

const valueOfEdit = (edit: RosterRowEdit, field: LevelField): number | null => (field === 'lv' ? edit.lv : edit.npLv)

/** 読み取りの結果から作る初めの入力。「要確認」の行は印を外して出す */
export const initialRowEdit = (row: RosterRow): RosterRowEdit => ({
  servantId: row.servantId,
  lv: row.lv,
  npLv: row.npLv,
  skills: row.skills ? [...row.skills] : [null, null, null],
  included: row.review === null,
})

/** 範囲に無い値が入っている欄があるか */
export const hasInvalidField = (edit: RosterRowEdit): boolean =>
  readLevelField('lv', edit.lv).kind === 'invalid' ||
  readLevelField('npLv', edit.npLv).kind === 'invalid' ||
  edit.skills.some(value => readSkillField(value).kind === 'invalid')

/**
 * 取り込みに入れられる行か。サーヴァントが決まり、範囲に無い値が無く、「要確認」で空にした欄（スキルを含む）に値が入っていること。
 * 読めなかった種類の空の欄は、保存されている値を残すので決めなくてよい。
 */
export const isRowDecided = (row: RosterRow, edit: RosterRowEdit): boolean => {
  if (edit.servantId === null || hasInvalidField(edit)) return false
  const undecided = row.review?.undecided ?? []
  const undecidedSkills = row.review?.undecidedSkills ?? []
  return (
    undecided.every(field => readLevelField(field, valueOfEdit(edit, field)).kind === 'value') &&
    undecidedSkills.every(index => readSkillField(edit.skills.at(index) ?? null).kind === 'value')
  )
}

/**
 * 利用者の操作を当てた次の入力。「要確認」の行は、決まっていなかった行が決まった時点で印を自動で付け、
 * 決まっていない間は印を付けない。当てた行の印は、範囲に無い値を入れても残す（取り込みに入るかは `isRowIncluded` で決める）。
 */
export const applyRowEdit = (row: RosterRow, prev: RosterRowEdit, patch: Partial<RosterRowEdit>): RosterRowEdit => {
  const next = { ...prev, ...patch }
  if (row.review === null) return next
  if (!isRowDecided(row, next)) return { ...next, included: false }
  if (!isRowDecided(row, prev) && patch.included === undefined) return { ...next, included: true }
  return next
}

/** 取り込みに入る行か（印が付いていて、決まっている） */
export const isRowIncluded = (row: RosterRow, edit: RosterRowEdit): boolean => edit.included && isRowDecided(row, edit)

/** 取り込みに入る行のうち、2つ以上の行が決まっているサーヴァントの ID */
export const overlappingServants = (rows: readonly RosterRow[], edits: readonly RosterRowEdit[]): Set<number> => {
  const counts = new Map<number, number>()
  rows.forEach((row, index) => {
    const edit = edits.at(index)
    if (!edit || edit.servantId === null || !isRowIncluded(row, edit)) return
    counts.set(edit.servantId, (counts.get(edit.servantId) ?? 0) + 1)
  })
  return new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id))
}

/** 取り込む行（取り込みに入る行だけ。値が無い種類は null で、保存されている値を残す。スキルは1つでも値があるときだけ付ける） */
export const importRows = (rows: readonly RosterRow[], edits: readonly RosterRowEdit[]): ServantLevelImportRow[] =>
  rows.flatMap((row, index) => {
    const edit = edits.at(index)
    if (!edit || edit.servantId === null || !isRowIncluded(row, edit)) return []
    const skills = edit.skills.map(value => {
      const read = readSkillField(value)
      return read.kind === 'value' ? read.value : null
    })
    return [
      {
        id: edit.servantId,
        lv: levelFieldValue('lv', edit.lv),
        npLv: levelFieldValue('npLv', edit.npLv),
        ...(skills.some(value => value !== null) ? { skills } : {}),
      },
    ]
  })

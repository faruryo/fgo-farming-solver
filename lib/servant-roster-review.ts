/**
 * サーヴァント強化の選択画面のスクリーンショットから取り込むときの、確かめの画面の入力を扱う純粋関数。
 * 行ごとに、利用者が決めたサーヴァント・Lv・宝具Lv と「取り込みに入れる」印を持ち、取り込める行・重なり・取り込む値を決める。
 */
import { isValidServantLv, isValidServantNpLv, type ServantLevelImportRow } from './servant-levels'
import type { RosterRow } from './servant-roster-import/types'

export type LevelField = 'lv' | 'npLv'

/** 確かめの画面の1行の入力 */
export type RosterRowEdit = {
  servantId: number | null
  lv: string
  npLv: string
  included: boolean
}

/** 欄の入力の読み。空は 'empty'、1〜120（宝具Lv は 1〜5）の整数でなければ 'invalid' */
export type FieldValue = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'value'; value: number }

const isValid = (field: LevelField, value: number): boolean =>
  field === 'lv' ? isValidServantLv(value) : isValidServantNpLv(value)

export const readField = (field: LevelField, raw: string): FieldValue => {
  const text = raw.trim()
  if (text === '') return { kind: 'empty' }
  if (!/^\d+$/.test(text)) return { kind: 'invalid' }
  const value = Number(text)
  return isValid(field, value) ? { kind: 'value', value } : { kind: 'invalid' }
}

const rawOf = (edit: RosterRowEdit, field: LevelField): string => (field === 'lv' ? edit.lv : edit.npLv)

/** 読み取りの結果から作る初めの入力。「要確認」の行は印を外して出す */
export const initialRowEdit = (row: RosterRow): RosterRowEdit => ({
  servantId: row.servantId,
  lv: row.lv === null ? '' : String(row.lv),
  npLv: row.npLv === null ? '' : String(row.npLv),
  included: row.review === null,
})

/** 範囲に無い値が入っている欄があるか */
export const hasInvalidField = (edit: RosterRowEdit): boolean =>
  readField('lv', edit.lv).kind === 'invalid' || readField('npLv', edit.npLv).kind === 'invalid'

/**
 * 取り込みに入れられる行か。サーヴァントが決まり、範囲に無い値が無く、「要確認」で空にした欄に値が入っていること。
 * 読めなかった種類の空の欄は、保存されている値を残すので決めなくてよい。
 */
export const isRowDecided = (row: RosterRow, edit: RosterRowEdit): boolean => {
  if (edit.servantId === null || hasInvalidField(edit)) return false
  const undecided = row.review?.undecided ?? []
  return undecided.every(field => readField(field, rawOf(edit, field)).kind === 'value')
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

const valueOf = (field: LevelField, raw: string): number | null => {
  const read = readField(field, raw)
  return read.kind === 'value' ? read.value : null
}

/** 取り込む行（取り込みに入る行だけ。値が無い種類は null で、保存されている値を残す） */
export const importRows = (rows: readonly RosterRow[], edits: readonly RosterRowEdit[]): ServantLevelImportRow[] =>
  rows.flatMap((row, index) => {
    const edit = edits.at(index)
    if (!edit || edit.servantId === null || !isRowIncluded(row, edit)) return []
    return [{ id: edit.servantId, lv: valueOf('lv', edit.lv), npLv: valueOf('npLv', edit.npLv) }]
  })

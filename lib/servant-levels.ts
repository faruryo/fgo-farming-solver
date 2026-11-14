/**
 * 所持サーヴァントの Lv・宝具Lv の保存値を読み書きする純粋関数。
 * 保存値は `{"100100": {"lv": 90, "npLv": 2}}` の形（サーヴァントの ID ごと。どちらの欄も無くてよい）。
 * 読むときは Lv 1〜120・宝具Lv 1〜5 の整数だけを通す。書くときは取り込むサーヴァントの `lv`・`npLv` だけを置き換え、
 * この版が知らないサーヴァントの項目と、項目の中の知らない欄はそのまま残す（あとの版の欄を同期で落とさないため）。
 */

export const SERVANT_LV_MIN = 1
export const SERVANT_LV_MAX = 120
export const SERVANT_NP_LV_MIN = 1
export const SERVANT_NP_LV_MAX = 5

/** 1騎の Lv・宝具Lv（読めた値だけ） */
export type ServantLevel = { lv?: number; npLv?: number }

/** 読んだ保存値（サーヴァントの ID → 値。Lv も宝具Lv も無い ID は入れない） */
export type ServantLevels = Record<string, ServantLevel>

/** 取り込む1行（値が無い種類は前の保存値を残す） */
export type ServantLevelImportRow = { id: string | number; lv?: number | null; npLv?: number | null }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isIntIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

export const isValidServantLv = (value: unknown): value is number => isIntIn(value, SERVANT_LV_MIN, SERVANT_LV_MAX)
export const isValidServantNpLv = (value: unknown): value is number =>
  isIntIn(value, SERVANT_NP_LV_MIN, SERVANT_NP_LV_MAX)

/** 1つの項目を読む（範囲の外の欄は無いものとする） */
const readEntry = (entry: unknown): ServantLevel => {
  if (!isRecord(entry)) return {}
  const out: ServantLevel = {}
  if (isValidServantLv(entry.lv)) out.lv = entry.lv
  if (isValidServantNpLv(entry.npLv)) out.npLv = entry.npLv
  return out
}

/** 保存値を読む。全体が表でなければ空 */
export const readServantLevels = (stored: unknown): ServantLevels => {
  if (!isRecord(stored)) return {}
  return Object.fromEntries(
    Object.entries(stored)
      .map(([id, entry]): [string, ServantLevel] => [id, readEntry(entry)])
      .filter(([, level]) => level.lv !== undefined || level.npLv !== undefined),
  )
}

/** Lv か宝具Lv の値を持つサーヴァントの数（読む関数と同じ見方） */
export const countServantLevels = (stored: unknown): number => Object.keys(readServantLevels(stored)).length

/**
 * 取り込む行を前の保存値に重ねた新しい保存値。前の保存値が表でなければ空の表に重ねる。
 * 値が無い種類（`undefined`・`null`・範囲の外）は前の値を残す。
 */
export const withServantLevels = (
  prev: unknown,
  rows: readonly ServantLevelImportRow[],
): Record<string, unknown> => {
  const next = new Map<string, unknown>(isRecord(prev) ? Object.entries(prev) : [])
  for (const row of rows) {
    const id = String(row.id)
    const before = next.get(id)
    const lv = isValidServantLv(row.lv) ? { lv: row.lv } : {}
    const npLv = isValidServantNpLv(row.npLv) ? { npLv: row.npLv } : {}
    if (Object.keys(lv).length === 0 && Object.keys(npLv).length === 0) continue
    next.set(id, { ...(isRecord(before) ? before : {}), ...lv, ...npLv })
  }
  return Object.fromEntries(next)
}

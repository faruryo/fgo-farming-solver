/**
 * 所持数入力欄（`PossessionModal` / `material/result` の `MatCard`）で共通して使う、
 * 生の入力文字列から所持数(0以上の整数、または未入力を表す undefined)への変換。
 */
export const parsePossessionInput = (raw: string): number | undefined => {
  if (raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined
}

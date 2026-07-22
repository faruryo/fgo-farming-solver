/**
 * OCRテキスト行から所持数を抽出する。
 * ゲームUIの表記は "3,052個" だが、OCRは桁区切りのカンマを全角カンマやピリオドに
 * 誤読することがある（実測: "3,052個" → "3，052個" / "3.052個"）ため、
 * カンマ・全角カンマ・ピリオドのいずれも桁区切りとして正規化してから数値化する。
 */
export const parseQuantityLine = (text: string): number | null => {
  const trimmed = text.trim()
  const match = trimmed.match(/^([0-9][0-9,，.]*)\s*個$/)
  if (!match) return null
  const digitsOnly = match[1].replace(/[,，.]/g, '')
  if (digitsOnly === '') return null
  const value = Number(digitsOnly)
  return Number.isFinite(value) ? value : null
}

/** 「所持」ラベル行（OCRの軽微な誤読 所持→所特 等を許容） */
export const isPossessionLabelLine = (text: string): boolean =>
  /^所[持特]$/.test(text.trim())

/** カードのバッジ文言等、品目名・所持数どちらでもない既知の非本質行 */
const isNoiseLine = (text: string): boolean => {
  const trimmed = text.trim()
  if (trimmed.length === 0) return true
  if (/^item$/i.test(trimmed)) return true
  if (isPossessionLabelLine(trimmed)) return true
  if (parseQuantityLine(trimmed) !== null) return true
  return false
}

const countCjk = (text: string): number =>
  (text.match(/[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length

/**
 * カードのOCR行群から品目名候補を推定する。
 * 固定座標に依存せず、バッジ・ラベル・数量行を除いた残りの中で
 * 最もCJK文字を含む行を品目名とみなす。
 */
export const guessItemNameLine = (lines: string[]): string | null => {
  const candidates = lines.filter((l) => !isNoiseLine(l))
  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) =>
    countCjk(cur) > countCjk(best) ? cur : best
  )
}

/** カードのOCR行群から所持数を推定する（「所持」ラベル以降の数量行を優先） */
export const guessQuantityLine = (lines: string[]): number | null => {
  const labelIndex = lines.findIndex(isPossessionLabelLine)
  if (labelIndex >= 0) {
    for (let i = labelIndex + 1; i < lines.length; i++) {
      const qty = parseQuantityLine(lines[i])
      if (qty !== null) return qty
    }
  }
  for (const line of lines) {
    const qty = parseQuantityLine(line)
    if (qty !== null) return qty
  }
  return null
}

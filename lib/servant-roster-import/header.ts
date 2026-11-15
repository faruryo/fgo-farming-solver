/**
 * 画面の上の表示（所持数・並びの項目・並びの向き）を読む純粋関数。
 * 矩形は見出しの枠から倍数で決め、読んだ文字から値を決める。
 */

import { ROSTER_LAYOUT } from './constants'
import type { OcrBox, Rect, SortKey, SortOrder } from './types'
import { bestFraction } from './values'

type Offset = { right: number; down: number; width: number; height: number }

const rectFrom = (heading: Rect, offset: Offset): Rect => {
  const unit = heading.height
  return {
    x: Math.round(heading.x + offset.right * unit),
    y: Math.round(heading.y + offset.down * unit),
    width: Math.round(offset.width * unit),
    height: Math.round(offset.height * unit),
  }
}

/** 見出しの枠から、所持数・並びの項目・並びの向きの矩形を決める */
export const headerRects = (heading: Rect): { owned: Rect; sortKey: Rect; sortOrder: Rect } => ({
  owned: rectFrom(heading, ROSTER_LAYOUT.ownedCount),
  sortKey: rectFrom(heading, ROSTER_LAYOUT.sortKey),
  sortOrder: rectFrom(heading, ROSTER_LAYOUT.sortOrder),
})

/** 所持数（「数字/数字」の左）。読めなければ null */
export const readOwnedCount = (boxes: readonly OcrBox[]): number | null => bestFraction(boxes)?.current ?? null

const textsOf = (boxes: readonly OcrBox[]): string[] => {
  const sorted = [...boxes].sort((a, b) => a.x - b.x)
  return [sorted.map((b) => b.text).join(''), ...sorted.map((b) => b.text)]
}

/** 1つだけに決まった見分けの結果。決まらなければ null */
const single = <T>(results: (T | null)[]): T | null => {
  const found = new Set(results.filter((r): r is T => r !== null))
  return found.size === 1 ? [...found][0] : null
}

const classifySortKey = (text: string): SortKey | null => {
  const plain = text.replace(/[\s\p{P}\p{S}]/gu, '')
  if (plain.includes('順') && /[宝具]/.test(plain)) return 'npLv'
  if (plain.toLowerCase() === 'lv順') return 'lv'
  return null
}

/** 並びの項目（宝具Lv.順・Lv.順）。どちらでもなければ null */
export const readSortKey = (boxes: readonly OcrBox[]): SortKey | null => single(textsOf(boxes).map(classifySortKey))

const classifySortOrder = (text: string): SortOrder | null => {
  const desc = text.includes('降順')
  const asc = text.includes('昇順')
  if (desc === asc) return null
  return desc ? 'desc' : 'asc'
}

/** 並びの向き（降順・昇順）。どちらでもなければ null */
export const readSortOrder = (boxes: readonly OcrBox[]): SortOrder | null =>
  single(textsOf(boxes).map(classifySortOrder))

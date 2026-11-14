/**
 * 見出しの枠から格子の横の位置と大きさを決め、顔の正方形から文字の帯の矩形を決める純粋関数。
 * 長さは見出しの枠の高さを単位にした倍数（constants.ts の ROSTER_LAYOUT）で決める。
 */
import { ROSTER_HEADING_TEXT, ROSTER_LAYOUT } from './constants'
import type { OcrBox, Rect, RosterGrid } from './types'

/** 空白と記号（句読点・記号の文字）を除く */
const normalize = (text: string): string => text.replace(/[\s\p{P}\p{S}]/gu, '')

/** 見出し「強化するサーヴァントを選択してください」の枠（1つの枠の文字が見出しの頭から読めたもの）。無ければ null */
export const findRosterHeading = (boxes: readonly OcrBox[]): Rect | null => {
  const box = boxes.find((b) => normalize(b.text).includes(ROSTER_HEADING_TEXT))
  return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null
}

/** 見出しの枠から決めた格子 */
export const gridFromHeading = (heading: Rect): RosterGrid => {
  const unit = heading.height
  const firstLeft = heading.x - ROSTER_LAYOUT.firstColumnLeft * unit
  return {
    heading,
    unit,
    side: ROSTER_LAYOUT.faceSide * unit,
    columnXs: Array.from({ length: ROSTER_LAYOUT.columns }, (_, i) => firstLeft + i * ROSTER_LAYOUT.columnPitch * unit),
  }
}

/** 画像をまるごと読んだ文字の枠から格子を決める。見出しが無ければ読めなかった画像（unreadable） */
export const readRosterGrid = (boxes: readonly OcrBox[]): RosterGrid | 'unreadable' => {
  const heading = findRosterHeading(boxes)
  return heading ? gridFromHeading(heading) : 'unreadable'
}

/** 格子の上の端（これより上はカードが見出しやボタンの帯に隠れる） */
export const gridTopY = (grid: RosterGrid): number => grid.heading.y + ROSTER_LAYOUT.gridTop * grid.unit

/** 顔の正方形の一辺 `side`・左上 (left, top) の位置の正方形 */
export const faceRect = (grid: RosterGrid, left: number, top: number): Rect => ({
  x: left,
  y: top,
  width: grid.side,
  height: grid.side,
})

const offsetRect = (face: Rect, unit: number, band: { right: number; down: number; width: number; height: number }): Rect => ({
  x: face.x + band.right * unit,
  y: face.y + band.down * unit,
  width: band.width * unit,
  height: band.height * unit,
})

/** 顔の正方形から、カードの上と下の文字の帯の矩形 */
export const cardBandRects = (face: Rect, unit: number): { top: Rect; bottom: Rect } => ({
  top: offsetRect(face, unit, ROSTER_LAYOUT.topBand),
  bottom: offsetRect(face, unit, ROSTER_LAYOUT.bottomBand),
})

/** 矩形を画像の中に収めたもの。画像と重ならなければ null */
export const clipRect = (rect: Rect, width: number, height: number): Rect | null => {
  const x = Math.max(0, rect.x)
  const y = Math.max(0, rect.y)
  const right = Math.min(width, rect.x + rect.width)
  const bottom = Math.min(height, rect.y + rect.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

/** カード全体（顔の正方形の横幅で、上の文字の帯の上端から下の文字の帯の下端まで）。確かめの画面の切り抜きに使う */
export const cardRect = (face: Rect, unit: number): Rect => {
  const top = face.y + ROSTER_LAYOUT.topBand.down * unit
  const bottom = face.y + ROSTER_LAYOUT.bottomBandBottom * unit
  return { x: face.x, y: top, width: face.width, height: bottom - top }
}

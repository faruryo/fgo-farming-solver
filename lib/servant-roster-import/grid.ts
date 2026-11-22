/**
 * 見出しの枠から格子の横の位置と大きさを決め、顔の正方形から文字の帯の矩形を決める純粋関数。
 * 長さは見出しの枠の高さを単位にした倍数（constants.ts の ROSTER_LAYOUT）で決める。
 */
import { FIVE_COLUMN_LAYOUT, ROSTER_HEADING_TEXT, ROSTER_LAYOUT, SKILL_HEADING } from './constants'
import type { OcrBox, Rect, RosterGrid, RosterScreen } from './types'

/** 空白と記号（句読点・記号の文字）を除く */
const normalize = (text: string): string => text.replace(/[\s\p{P}\p{S}]/gu, '')

const rectOf = (box: OcrBox): Rect => ({ x: box.x, y: box.y, width: box.width, height: box.height })

/**
 * 見出しの枠と画面の種類。スキル強化の見出し（「強化するサーヴァントを選択」を含む）を先に見て、
 * その枠はサーヴァント強化の見出しの枠に換算する。「スキルを」が分かれたり読み違えたりして
 * サーヴァント強化の見出しの文字しか当たらなくても、すぐ下に2行目「強化には各種素材アイテムが必要です」があればスキル強化の画面にする。
 * どちらも無ければ null
 */
export const findRosterHeading = (boxes: readonly OcrBox[]): { screen: RosterScreen; heading: Rect } | null => {
  const matched =
    boxes.find((b) => normalize(b.text).includes(SKILL_HEADING.text)) ??
    boxes.find((b) => normalize(b.text).includes(ROSTER_HEADING_TEXT))
  if (!matched) return null
  // 2行目は1行目のすぐ下（1行目の枠の高さの 3 倍まで）にあるものだけを使う
  const second = boxes.find(
    (b) =>
      normalize(b.text).includes(SKILL_HEADING.secondLineText) &&
      b.y > matched.y &&
      b.y - matched.y < matched.height * 3,
  )
  if (!second && !normalize(matched.text).includes(SKILL_HEADING.text)) return { screen: 'enhance', heading: rectOf(matched) }
  const gap = second ? second.y - matched.y : null
  const unit = gap ? gap * SKILL_HEADING.unitPerLineGap : matched.height * SKILL_HEADING.unitPerHeight
  const down = gap ? gap * SKILL_HEADING.downPerLineGap : matched.height * SKILL_HEADING.downPerHeight
  return { screen: 'skill', heading: { x: matched.x, y: matched.y + down, width: matched.width, height: unit } }
}

/** 見出しの枠から決めた格子 */
export const gridFromHeading = (heading: Rect, screen: RosterScreen = 'enhance'): RosterGrid => {
  const unit = heading.height
  const firstLeft = heading.x - ROSTER_LAYOUT.firstColumnLeft * unit
  return {
    screen,
    heading,
    unit,
    side: ROSTER_LAYOUT.faceSide * unit,
    columnXs: Array.from({ length: ROSTER_LAYOUT.columns }, (_, i) => firstLeft + i * ROSTER_LAYOUT.columnPitch * unit),
  }
}

/**
 * スキル強化の画面の5列の表示の格子。7列の格子を、いちばん左の列の顔の左端と格子の上の端を軸に広げたもの
 * （見出しの枠も同じ軸で広げ、格子の上の端が変わらないようにする）
 */
export const fiveColumnGrid = (grid: RosterGrid): RosterGrid => {
  const { scale, columns } = FIVE_COLUMN_LAYOUT
  const firstLeft = grid.columnXs[0] ?? 0
  const unit = grid.unit * scale
  const top = gridTopY(grid)
  return {
    ...grid,
    heading: { ...grid.heading, y: top - ROSTER_LAYOUT.gridTop * unit, height: unit },
    unit,
    side: grid.side * scale,
    columnXs: Array.from({ length: columns }, (_, i) => firstLeft + i * ROSTER_LAYOUT.columnPitch * unit),
  }
}

/** 画像をまるごと読んだ文字の枠から格子を決める。見出しが無ければ読めなかった画像（unreadable） */
export const readRosterGrid = (boxes: readonly OcrBox[]): RosterGrid | 'unreadable' => {
  const found = findRosterHeading(boxes)
  return found ? gridFromHeading(found.heading, found.screen) : 'unreadable'
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

/** 顔の正方形から、カードの上と下の文字の帯の矩形（スキル強化の画面の下の帯はスキルLv の帯） */
export const cardBandRects = (face: Rect, unit: number, screen: RosterScreen = 'enhance'): { top: Rect; bottom: Rect } => ({
  top: offsetRect(face, unit, ROSTER_LAYOUT.topBand),
  bottom: offsetRect(face, unit, screen === 'skill' ? ROSTER_LAYOUT.skillBand : ROSTER_LAYOUT.bottomBand),
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

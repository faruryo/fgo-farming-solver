/**
 * カードの顔の部分を照合用の顔のアイコンと比べ、サーヴァントを決める純粋関数。
 *
 * - 比べ方: 切り出しを 16×16 に縮め（cropCells）、明るさをそろえずに RGB の差の絶対値の平均を取る（rawPixelDiff）
 * - 比べる升目: 上の文字・クラスのアイコン・鍵・星・下の帯などが重ならない升目だけ。ほかの升目は候補の側で透明にする
 *   （rawPixelDiff は候補の不透明な升目だけを比べる）
 * - 決め方: サーヴァントごとに一番近いアイコンの差を取り、一番近いサーヴァントの差が上限を超えれば「要確認」
 *   （どのサーヴァントにも近くない）、超えなければ次に近い別のサーヴァントの差との比で決める
 */
import { coarseRects, cropCells, integralImage, rawPixelDiff, type RgbaImage } from '../shop-screenshot-import/icon-match'
import { FACE_MATCH } from './constants'
import type { FaceCandidate, FaceIconData, FaceMatch, Rect } from './types'

const CELL_COUNT = FACE_MATCH.size * FACE_MATCH.size

const comparedCell = (cell: number): boolean => {
  const row = Math.floor(cell / FACE_MATCH.size)
  const column = cell % FACE_MATCH.size
  return (
    row >= FACE_MATCH.cellRows.from &&
    row <= FACE_MATCH.cellRows.to &&
    column >= FACE_MATCH.cellColumns.from &&
    column <= FACE_MATCH.cellColumns.to
  )
}

/** 比べない升目を透明にした写し */
export const maskFaceCells = (pixels: Uint8ClampedArray): Uint8ClampedArray => {
  const masked = new Uint8ClampedArray(pixels)
  for (let cell = 0; cell < CELL_COUNT; cell++) if (!comparedCell(cell)) masked[cell * 4 + 3] = 0
  return masked
}

/** 16×16 の RGBA を base64 にした文字列を画素の配列に戻す。形が違えば null */
export const decodeFacePixels = (base64: string): Uint8ClampedArray | null => {
  let binary: string
  try {
    binary = atob(base64)
  } catch {
    return null
  }
  if (binary.length !== CELL_COUNT * 4) return null
  return Uint8ClampedArray.from(binary, (c) => c.charCodeAt(0))
}

/** 照合用のデータから、`servantIds`（育成計算機の一覧にいるサーヴァント）のアイコンだけを候補にする */
export const faceCandidates = (data: FaceIconData, servantIds: ReadonlySet<number>): FaceCandidate[] =>
  data.icons.flatMap((icon) => {
    if (!servantIds.has(icon.servantId)) return []
    const pixels = decodeFacePixels(icon.pixels)
    return pixels ? [{ servantId: icon.servantId, pixels: maskFaceCells(pixels) }] : []
  })

/** 縮めた切り出しと、いちばん近い候補の差 */
export const nearestCandidateDiff = (crop: Uint8ClampedArray, candidates: readonly FaceCandidate[]): number => {
  let best = Infinity
  for (const candidate of candidates) best = Math.min(best, rawPixelDiff(crop, candidate.pixels))
  return best
}

/** サーヴァントごとの一番近い差と、その差になった切り出し */
export type ServantDiffs = ReadonlyMap<number, { diff: number; rect: Rect }>

/** サーヴァントごとの差から決める。`base` は切り出しが1つも無いときの矩形 */
export const decideFace = (diffs: ServantDiffs, base: Rect): FaceMatch => {
  const ranked = [...diffs].map(([servantId, d]) => ({ servantId, ...d })).sort((a, b) => a.diff - b.diff)
  const [first, second] = ranked
  const nearest = ranked.slice(0, FACE_MATCH.reviewCandidates).map((r) => r.servantId)
  if (!first || first.diff > FACE_MATCH.maxDiff) {
    return { kind: 'review', reason: 'unknown-face', nearest, best: first?.diff ?? Infinity, rect: first?.rect ?? base }
  }
  const secondDiff = second?.diff ?? Infinity
  // 一番近い差が 0 で次も 0 のとき（同じ絵の別のサーヴァント）は比を決めない
  if (first.diff === secondDiff || first.diff / secondDiff > FACE_MATCH.maxRatio) {
    return { kind: 'review', reason: 'ambiguous-face', nearest, best: first.diff, rect: first.rect }
  }
  return { kind: 'matched', servantId: first.servantId, best: first.diff, second: secondDiff, rect: first.rect }
}

const boundsOf = (rects: readonly Rect[]): Rect => {
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.width))
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** 画像の顔の正方形 `base` のまわりの 27 通りの切り出し（画像の外は除く）を全候補と比べて、サーヴァントを決める */
export const matchFace = (image: RgbaImage, base: Rect, candidates: readonly FaceCandidate[]): FaceMatch => {
  const rects = coarseRects(base, FACE_MATCH.search, image.width, image.height)
  const diffs = new Map<number, { diff: number; rect: Rect }>()
  if (rects.length === 0) return decideFace(diffs, base)
  const integral = integralImage(image, boundsOf(rects))
  for (const rect of rects) {
    const crop = cropCells(integral, rect, FACE_MATCH.size)
    for (const candidate of candidates) {
      const diff = rawPixelDiff(crop, candidate.pixels)
      const current = diffs.get(candidate.servantId)
      if (!current || diff < current.diff) diffs.set(candidate.servantId, { diff, rect })
    }
  }
  return decideFace(diffs, base)
}

/**
 * カードの顔の部分を照合用の顔のアイコンと比べ、サーヴァントを決める純粋関数。
 *
 * - 比べ方: 切り出しを 16×16 に縮め（cropCells）、明るさをそろえずに RGB の差の絶対値の平均を取る（rawPixelDiff）
 * - 比べる升目: 上の文字・クラスのアイコン・鍵・星・下の帯などが重ならない升目だけ。ほかの升目は候補の側で透明にする
 *   （rawPixelDiff は候補の不透明な升目だけを比べる）
 * - 暗いカード: 明るさをそろえずに比べてどのサーヴァントにも近くなければ、明るさをそろえて比べ直す（matchFace）
 * - 決め方: サーヴァントごとに一番近いアイコンの差を取り、一番近いサーヴァントの差が上限を超えれば「要確認」
 *   （どのサーヴァントにも近くない）、超えなければ次に近い別のサーヴァントの差との比で決める
 */
import { coarseRects, cropCells, iconPixelDiff, integralImage, rawPixelDiff, type RgbaImage } from '../shop-screenshot-import/icon-match'
import { FACE_MATCH } from './constants'
import type { FaceCandidate, FaceIconData, FaceMatch, Rect, RosterScreen } from './types'

const CELL_COUNT = FACE_MATCH.size * FACE_MATCH.size

const comparedCell = (cell: number, screen: RosterScreen): boolean => {
  const row = Math.floor(cell / FACE_MATCH.size)
  const column = cell % FACE_MATCH.size
  const rows = screen === 'skill' ? FACE_MATCH.skillCellRows : FACE_MATCH.cellRows
  return (
    row >= rows.from &&
    row <= rows.to &&
    column >= FACE_MATCH.cellColumns.from &&
    column <= FACE_MATCH.cellColumns.to
  )
}

/** 比べない升目を透明にした写し（比べる升目は画面の種類で決める） */
export const maskFaceCells = (pixels: Uint8ClampedArray, screen: RosterScreen = 'enhance'): Uint8ClampedArray => {
  const masked = new Uint8ClampedArray(pixels)
  for (let cell = 0; cell < CELL_COUNT; cell++) if (!comparedCell(cell, screen)) masked[cell * 4 + 3] = 0
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
export const faceCandidates = (
  data: FaceIconData,
  servantIds: ReadonlySet<number>,
  screen: RosterScreen = 'enhance',
): FaceCandidate[] =>
  data.icons.flatMap((icon) => {
    if (!servantIds.has(icon.servantId)) return []
    const pixels = decodeFacePixels(icon.pixels)
    return pixels ? [{ servantId: icon.servantId, pixels: maskFaceCells(pixels, screen) }] : []
  })

/** 画面の種類ごとの候補 */
export type ScreenCandidates = Readonly<Record<RosterScreen, readonly FaceCandidate[]>>

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

/** 27 通りの切り出しを全候補と `diffOf` で比べた、サーヴァントごとの一番近い差 */
const servantDiffs = (
  crops: readonly { crop: Uint8ClampedArray; rect: Rect }[],
  candidates: readonly FaceCandidate[],
  diffOf: (crop: Uint8ClampedArray, ref: Uint8ClampedArray) => number,
): ServantDiffs => {
  const diffs = new Map<number, { diff: number; rect: Rect }>()
  for (const { crop, rect } of crops) {
    for (const candidate of candidates) {
      const diff = diffOf(crop, candidate.pixels)
      const current = diffs.get(candidate.servantId)
      if (!current || diff < current.diff) diffs.set(candidate.servantId, { diff, rect })
    }
  }
  return diffs
}

/** 比べる升目の RGB の合計（候補の不透明な升目だけ） */
const comparedSum = (pixels: Uint8ClampedArray, ref: Uint8ClampedArray): number => {
  let sum = 0
  for (let p = 0; p < CELL_COUNT; p++) if (ref[p * 4 + 3] > 0) sum += pixels[p * 4] + pixels[p * 4 + 1] + pixels[p * 4 + 2]
  return sum
}

/**
 * 暗く塗られた切り出しの比べ直し。候補が切り出しの darkenedMinGain〜darkenedMaxGain 倍の明るさのときだけ、明るさをそろえて比べる
 * （明るい絵を暗いアイコンに寄せず、空の枠のような真っ暗な切り出しを大きく持ち上げない）
 */
const darkenedDiff = (crop: Uint8ClampedArray, ref: Uint8ClampedArray): number => {
  const gain = comparedSum(ref, ref) / comparedSum(crop, ref)
  return gain >= FACE_MATCH.darkenedMinGain && gain <= FACE_MATCH.darkenedMaxGain ? iconPixelDiff(crop, ref) : Infinity
}

/**
 * 画像の顔の正方形 `base` のまわりの 27 通りの切り出し（画像の外は除く）を全候補と比べて、サーヴァントを決める。
 * スキル強化の画面（`screen` が skill）で、明るさをそろえずに比べてどのサーヴァントにも近くなかったときだけ、切り出しより明るい候補と明るさをそろえて比べ直す。
 * スキルLv.MAX のカードは顔が暗く塗られるため。明るさをそろえると平板なアイコンがどのカードにも近くなるので、
 * 決まったカードには使わず、比べ直しでも上限と次に近いサーヴァントとの比を満たしたときだけ決める
 */
export const matchFace = (
  image: RgbaImage,
  base: Rect,
  candidates: readonly FaceCandidate[],
  screen: RosterScreen = 'enhance',
): FaceMatch => {
  const rects = coarseRects(base, FACE_MATCH.search, image.width, image.height)
  if (rects.length === 0) return decideFace(new Map(), base)
  const integral = integralImage(image, boundsOf(rects))
  const crops = rects.map((rect) => ({ crop: cropCells(integral, rect, FACE_MATCH.size), rect }))
  const raw = decideFace(servantDiffs(crops, candidates, rawPixelDiff), base)
  // 暗く塗られるのはスキル強化の画面のスキルLv.MAX のカードだけ
  if (screen !== 'skill' || raw.kind !== 'review' || raw.reason !== 'unknown-face') return raw
  const normalized = decideFace(servantDiffs(crops, candidates, darkenedDiff), base)
  // 比べ直せた候補が1騎だけだと次に近い差が Infinity になり比が必ず通るので、2騎以上と比べられたときだけ決める
  return normalized.kind === 'matched' && Number.isFinite(normalized.second) ? normalized : raw
}

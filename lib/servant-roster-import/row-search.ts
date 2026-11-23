/**
 * 段の縦の位置を顔の照合で探す純粋関数。
 *
 * 1. 上の文字の帯が格子の上の端より下に来るいちばん上の位置から、下の文字の帯の下端が画像に収まるいちばん下の位置まで、
 *    顔の正方形を縦に顔の一辺の決めた割合ずつずらす（範囲の外の位置は試さない）。位置ごとに7つの列の決めた位置の切り出し
 *    （位置や一辺は振らない）を全候補と比べ、7つの列のうちいちばん小さい差をその位置の差とする
 * 2. 差が上限以下の位置を拾い、段の間隔の半分より近い位置どうしは差がいちばん小さい位置だけを残す
 */
import { cropCells, integralImage, type RgbaImage } from '../shop-screenshot-import/icon-match'
import { FACE_MATCH, ROSTER_LAYOUT, WIDE_COLUMN_LAYOUTS } from './constants'
import { nearestCandidateDiff, type ScreenCandidates } from './face-match'
import { gridTopY, readRosterGrid, wideColumnGrid } from './grid'
import type { FaceCandidate, OcrBox, RosterGrid } from './types'

/** 試す顔の上端の位置（上から順） */
export const scanFaceTops = (grid: RosterGrid, imageHeight: number): number[] => {
  const first = gridTopY(grid) - ROSTER_LAYOUT.topBand.down * grid.unit
  const last = imageHeight - ROSTER_LAYOUT.bottomBandBottom * grid.unit
  const step = FACE_MATCH.rowScanStep * grid.side
  const tops: number[] = []
  for (let k = 0; first + k * step <= last; k++) tops.push(first + k * step)
  return tops
}

/** 位置ごとの差（7つの列のうちいちばん小さい差）。画像の横に収まらない列は比べない */
const positionDiffs = (
  image: RgbaImage,
  grid: RosterGrid,
  tops: readonly number[],
  candidates: readonly FaceCandidate[],
): number[] => {
  let diffs = tops.map(() => Infinity)
  const firstTop = tops.at(0)
  const lastTop = tops.at(-1)
  if (firstTop === undefined || lastTop === undefined) return diffs
  for (const x of grid.columnXs) {
    if (x < 0 || x + grid.side > image.width) continue
    // 列ごとに、試す範囲だけの累積和を作る（画像まるごとの表は大きい）
    const integral = integralImage(image, { x, y: firstTop, width: grid.side, height: lastTop + grid.side - firstTop })
    diffs = tops.map((y, i) => {
      const crop = cropCells(integral, { x, y, width: grid.side, height: grid.side }, FACE_MATCH.size)
      return Math.min(diffs.at(i) ?? Infinity, nearestCandidateDiff(crop, candidates))
    })
  }
  return diffs
}

/** 段の顔の上端の位置（上から順） */
export const findRowTops = (image: RgbaImage, grid: RosterGrid, candidates: readonly FaceCandidate[]): number[] => {
  const tops = scanFaceTops(grid, image.height)
  const diffs = positionDiffs(image, grid, tops, candidates)
  const picked = tops
    .map((top, i) => ({ top, diff: diffs.at(i) ?? Infinity }))
    .filter((p) => p.diff <= FACE_MATCH.maxDiff)
    .sort((a, b) => a.diff - b.diff || a.top - b.top)
  const minGap = (ROSTER_LAYOUT.rowPitch * grid.unit) / 2
  const kept: number[] = []
  for (const { top } of picked) if (kept.every((k) => Math.abs(k - top) >= minGap)) kept.push(top)
  return kept.sort((a, b) => a - b)
}

/** 段と列の決めた位置（位置や一辺は振らない）のうち、どれかのサーヴァントに近い位置の数 */
export const countFaceHits = (
  image: RgbaImage,
  grid: RosterGrid,
  rowTops: readonly number[],
  candidates: readonly FaceCandidate[],
): number => {
  let hits = 0
  for (const x of grid.columnXs) {
    for (const y of rowTops) {
      if (x < 0 || y < 0 || x + grid.side > image.width || y + grid.side > image.height) continue
      const integral = integralImage(image, { x, y, width: grid.side, height: grid.side })
      const crop = cropCells(integral, { x, y, width: grid.side, height: grid.side }, FACE_MATCH.size)
      if (nearestCandidateDiff(crop, candidates) <= FACE_MATCH.maxDiff) hits += 1
    }
  }
  return hits
}

export type RosterLocation =
  | { kind: 'unreadable' }
  /** 6列・5列の表示（読み取らない） */
  | { kind: 'wide-columns'; columns: number }
  | { kind: 'located'; grid: RosterGrid; rowTops: number[] }

/**
 * 画像の格子と段。見出しが無いか、段が1つも見つからなければ読めなかった画像（unreadable）。
 * 6列・5列の表示の格子でも段を探し、顔の当たる位置が7列より多い列数があれば、そのうちいちばん多い列数の表示（wide-columns）
 */
export const locateRoster = (boxes: readonly OcrBox[], image: RgbaImage, screens: ScreenCandidates): RosterLocation => {
  const grid = readRosterGrid(boxes)
  if (grid === 'unreadable') return { kind: 'unreadable' }
  const candidates = screens[grid.screen]
  const rowTops = findRowTops(image, grid, candidates)
  let best: { columns: number; hits: number } = { columns: ROSTER_LAYOUT.columns, hits: countFaceHits(image, grid, rowTops, candidates) }
  for (const layout of WIDE_COLUMN_LAYOUTS) {
    const wide = wideColumnGrid(grid, layout)
    const hits = countFaceHits(image, wide, findRowTops(image, wide, candidates), candidates)
    if (hits > best.hits) best = { columns: layout.columns, hits }
  }
  if (best.columns !== ROSTER_LAYOUT.columns) return { kind: 'wide-columns', columns: best.columns }
  return rowTops.length > 0 ? { kind: 'located', grid, rowTops } : { kind: 'unreadable' }
}

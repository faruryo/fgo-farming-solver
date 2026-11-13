/**
 * 通貨のアイコンを切り出す位置と探し方、切り出しと Atlas のアイコンの比べ方を決める純粋関数。
 * 画像は画像ごとに1回だけ canvas から読んだ RGBA の配列で受け取り、canvas に描く部分（icon-pixels.ts）とは分ける。
 *
 * - 切り出す位置: 行は残りの値の枠の右端と見出しの枠から、所持数は数の枠と欄の見出しの高さから決めた正方形
 * - 探し方: 決めた一辺の 5% 刻みで位置と一辺を変えて試し、通貨ごとに一番近かった所のまわりを 1/60 刻みで探し直す。
 *   画像の外にはみ出す切り出しは試さない
 * - 比べ方: 切り出しを升目ごとの画素の平均で 16×16 に縮め、Atlas のアイコンの不透明な升目で、RGB の合計が同じになるよう
 *   切り出しの明るさをそろえてから RGB の差の絶対値の平均を取る
 * - 決め方: 一番近い差 ÷ 次に近い差が 0.5 以下なら一番近い通貨、超えれば「要確認」
 */
import type { IconDecision, Rect } from './types'

/**
 * 照合の定数（実物のスクリーンショットで照合が通った値）。
 * - row: 行のアイコンの中心（残りの値の枠の右端から右へ・見出しの上端から下へ）と一辺。見出しの枠の高さの倍数
 * - owned: 所持数のアイコンの中心（数の枠の右端から左へ・数の枠の縦の中心から上へ）と一辺。欄の見出しの高さの倍数
 * - position: 中心を縦横に動かす幅（決めた一辺の割合）。ownedHorizontal は所持数の横だけの幅
 * - side: 一辺を変える幅（決めた一辺の割合）
 * - coarseStep: はじめの探しの刻み（決めた一辺の割合）
 * - fineRange・fineStep: 細かい探しの幅と刻み（決めた一辺の割合）
 * - maxRatio: 一番近い差 ÷ 次に近い差がこれ以下なら決める
 * - size: 比べる升目の一辺の数
 * - opaqueAlpha: Atlas のアイコンのこの不透明度以上の升目だけを比べる
 */
export const ICON_MATCH = {
  row: { right: 1.7, down: 1.4, side: 2.8 },
  owned: { left: 8.4, up: 0.1, side: 2.8 },
  position: 0.3,
  ownedHorizontal: 0.5,
  side: 0.3,
  coarseStep: 0.05,
  fineRange: 0.05,
  fineStep: 1 / 60,
  maxRatio: 0.5,
  size: 16,
  opaqueAlpha: 128,
} as const

/** RGBA の画素の配列 */
export type RgbaImage = { data: Uint8ClampedArray; width: number; height: number }

/** 探す幅（決めた一辺の割合） */
export type SearchRange = { horizontal: number; vertical: number; side: number }

export const ROW_SEARCH: SearchRange = { horizontal: ICON_MATCH.position, vertical: ICON_MATCH.position, side: ICON_MATCH.side }
export const OWNED_SEARCH: SearchRange = {
  horizontal: ICON_MATCH.ownedHorizontal,
  vertical: ICON_MATCH.position,
  side: ICON_MATCH.side,
}

const square = (cx: number, cy: number, side: number): Rect => ({ x: cx - side / 2, y: cy - side / 2, width: side, height: side })

/** 行のアイコンを切り出す正方形（残りの値の枠の右端と見出しの枠から） */
export const rowIconRect = (remainingBox: Rect, headingBox: Rect): Rect => {
  const h = headingBox.height
  return square(
    remainingBox.x + remainingBox.width + h * ICON_MATCH.row.right,
    headingBox.y + h * ICON_MATCH.row.down,
    h * ICON_MATCH.row.side,
  )
}

/** 所持数のアイコンを切り出す正方形（数の枠と欄の見出しの高さから） */
export const ownedIconRect = (numberBox: Rect, headingHeight: number): Rect =>
  square(
    numberBox.x + numberBox.width - headingHeight * ICON_MATCH.owned.left,
    numberBox.y + numberBox.height / 2 - headingHeight * ICON_MATCH.owned.up,
    headingHeight * ICON_MATCH.owned.side,
  )

const insideImage = (rect: Rect, width: number, height: number): boolean =>
  rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height

/** -range〜range を step 刻みで（0 を含む） */
const offsets = (range: number, step: number): number[] => {
  const count = Math.round(range / step)
  return Array.from({ length: count * 2 + 1 }, (_, i) => (i - count) * step)
}

const variations = (center: Rect, unit: number, range: SearchRange, step: number): Rect[] => {
  const cx = center.x + center.width / 2
  const cy = center.y + center.height / 2
  const rects: Rect[] = []
  for (const ds of offsets(range.side, step)) {
    const side = center.width + ds * unit
    if (side <= 0) continue
    for (const dy of offsets(range.vertical, step)) {
      for (const dx of offsets(range.horizontal, step)) rects.push(square(cx + dx * unit, cy + dy * unit, side))
    }
  }
  return rects
}

/** はじめの探しの切り出し（画像の外にはみ出すものは除く） */
export const coarseRects = (base: Rect, range: SearchRange, imageWidth: number, imageHeight: number): Rect[] =>
  variations(base, base.width, range, ICON_MATCH.coarseStep).filter((r) => insideImage(r, imageWidth, imageHeight))

/** `around` のまわりの細かい探しの切り出し（幅と刻みは決めた一辺 `baseSide` の割合。画像の外は除く） */
export const fineRects = (around: Rect, baseSide: number, imageWidth: number, imageHeight: number): Rect[] => {
  const r = ICON_MATCH.fineRange
  return variations(around, baseSide, { horizontal: r, vertical: r, side: r }, ICON_MATCH.fineStep).filter((rect) =>
    insideImage(rect, imageWidth, imageHeight),
  )
}

/** 画像の一部の RGB の累積和（左上からの和。一辺 +1 の表）。origin は画像の上の左上の位置 */
export type IntegralImage = {
  originX: number
  originY: number
  width: number
  height: number
  sums: [Float64Array, Float64Array, Float64Array]
}

/** 画像の `region`（画像の中に収める）の RGB の累積和。升目の平均を切り出しごとに数回の読みで取るため */
export const integralImage = (image: RgbaImage, region: Rect = { x: 0, y: 0, width: image.width, height: image.height }): IntegralImage => {
  const x0 = Math.max(0, Math.floor(region.x))
  const y0 = Math.max(0, Math.floor(region.y))
  const width = Math.max(0, Math.min(image.width, Math.ceil(region.x + region.width)) - x0)
  const height = Math.max(0, Math.min(image.height, Math.ceil(region.y + region.height)) - y0)
  const w = width + 1
  const sums: IntegralImage['sums'] = [
    new Float64Array(w * (height + 1)),
    new Float64Array(w * (height + 1)),
    new Float64Array(w * (height + 1)),
  ]
  sums.forEach((sum, c) => {
    for (let y = 0; y < height; y++) {
      let row = 0
      for (let x = 0; x < width; x++) {
        row += image.data[((y + y0) * image.width + x + x0) * 4 + c]
        sum[(y + 1) * w + x + 1] = sum[y * w + x + 1] + row
      }
    }
  })
  return { originX: x0, originY: y0, width, height, sums }
}

/** 正方形を size×size の升目に分けた境（いちばん近い画素に丸め、升目が空にならないようにする） */
const cellEdges = (start: number, length: number, size: number, limit: number): number[] => {
  let previous = -Infinity
  return Array.from({ length: size + 1 }, (_, i) => {
    const edge = Math.max(Math.min(limit, Math.max(0, Math.round(start + (length * i) / size))), previous + 1)
    previous = edge
    return edge
  })
}

/** 累積和の表の矩形 [x0, x1) × [y0, y1) の和 */
const boxSum = (sum: Float64Array, w: number, x0: number, x1: number, y0: number, y1: number): number =>
  sum[y1 * w + x1] - sum[y0 * w + x1] - sum[y1 * w + x0] + sum[y0 * w + x0]

/** 切り出しを升目ごとの画素の平均で size×size の RGBA（不透明）に縮める */
export const cropCells = (integral: IntegralImage, rect: Rect, size: number = ICON_MATCH.size): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(size * size * 4)
  const xs = cellEdges(rect.x - integral.originX, rect.width, size, integral.width)
  const ys = cellEdges(rect.y - integral.originY, rect.height, size, integral.height)
  const w = integral.width + 1
  const [sr, sg, sb] = integral.sums
  for (let cy = 0; cy < size; cy++) {
    const y0 = ys.at(cy) ?? 0
    const y1 = Math.min(integral.height, ys.at(cy + 1) ?? 0)
    for (let cx = 0; cx < size; cx++) {
      const x0 = xs.at(cx) ?? 0
      const x1 = Math.min(integral.width, xs.at(cx + 1) ?? 0)
      const area = (x1 - x0) * (y1 - y0)
      const cell = cy * size + cx
      if (area > 0) {
        out[cell * 4] = boxSum(sr, w, x0, x1, y0, y1) / area
        out[cell * 4 + 1] = boxSum(sg, w, x0, x1, y0, y1) / area
        out[cell * 4 + 2] = boxSum(sb, w, x0, x1, y0, y1) / area
      }
      out[cell * 4 + 3] = 255
    }
  }
  return out
}

/** 画像の矩形 [x0, x1) × [y0, y1) の、不透明度で重みを付けた RGB の平均と不透明度の平均 */
const weightedAverage = (image: RgbaImage, x0: number, x1: number, y0: number, y1: number): number[] => {
  const { data } = image
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * image.width + x
      const alpha = data[i * 4 + 3]
      r += data[i * 4] * alpha
      g += data[i * 4 + 1] * alpha
      b += data[i * 4 + 2] * alpha
      a += alpha
      n++
    }
  }
  return a > 0 ? [r / a, g / a, b / a, a / n] : [0, 0, 0, 0]
}

/**
 * Atlas のアイコンを size×size に縮める。升目ごとに、RGB は不透明度で重みを付けて平均し（透明な画素の色で縁が
 * 暗くならないため）、不透明度は升目の平均にする。
 */
export const downscaleIcon = (image: RgbaImage, size: number = ICON_MATCH.size): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(size * size * 4)
  const xs = cellEdges(0, image.width, size, image.width)
  const ys = cellEdges(0, image.height, size, image.height)
  for (let cy = 0; cy < size; cy++) {
    for (let cx = 0; cx < size; cx++) {
      const x1 = Math.min(image.width, xs.at(cx + 1) ?? 0)
      const y1 = Math.min(image.height, ys.at(cy + 1) ?? 0)
      out.set(weightedAverage(image, xs.at(cx) ?? 0, x1, ys.at(cy) ?? 0, y1), (cy * size + cx) * 4)
    }
  }
  return out
}

const opaque = (ref: Uint8ClampedArray, p: number) => ref[p * 4 + 3] >= ICON_MATCH.opaqueAlpha

/** 明るさをそろえずに取る差（Atlas のアイコンの不透明な升目の RGB の差の絶対値の平均）。比べる升目が無ければ Infinity */
export const rawPixelDiff = (crop: Uint8ClampedArray, ref: Uint8ClampedArray, gain = 1): number => {
  const cells = Math.min(crop.length, ref.length) / 4
  let sum = 0
  let count = 0
  for (let p = 0; p < cells; p++) {
    if (!opaque(ref, p)) continue
    for (let c = 0; c < 3; c++) sum += Math.abs(Math.min(255, crop[p * 4 + c] * gain) - ref[p * 4 + c])
    count++
  }
  return count === 0 ? Infinity : sum / (count * 3)
}

/**
 * 切り出しと Atlas のアイコンの差。Atlas のアイコンの不透明な升目で、RGB の合計が Atlas のアイコンと同じになる倍率を
 * 切り出しに掛けて（255 で頭打ち）から差を取る。切り出しの合計が 0（真っ黒）なら比べに使わない（Infinity）。
 */
export const iconPixelDiff = (crop: Uint8ClampedArray, ref: Uint8ClampedArray): number => {
  const cells = Math.min(crop.length, ref.length) / 4
  let cropSum = 0
  let refSum = 0
  for (let p = 0; p < cells; p++) {
    if (!opaque(ref, p)) continue
    for (let c = 0; c < 3; c++) {
      cropSum += crop[p * 4 + c]
      refSum += ref[p * 4 + c]
    }
  }
  if (cropSum === 0) return Infinity
  return rawPixelDiff(crop, ref, refSum / cropSum)
}

/**
 * 通貨ごとの差から通貨を決める。一番近い差 ÷ 次に近い差が 0.5 以下なら一番近い通貨、超えれば「要確認」。
 * 通貨が1つならその通貨に決める。
 */
export const decideCurrency = (diffs: ReadonlyMap<number, number>): IconDecision => {
  const ranked = [...diffs].map(([costItemId, diff]) => ({ costItemId, diff })).sort((a, b) => a.diff - b.diff)
  const [first, second] = ranked
  if (!first || !Number.isFinite(first.diff)) return { kind: 'review' }
  if (!second) return { kind: 'matched', costItemId: first.costItemId, best: first.diff, second: Infinity }
  if (first.diff === second.diff || first.diff / second.diff > ICON_MATCH.maxRatio) return { kind: 'review' }
  return { kind: 'matched', costItemId: first.costItemId, best: first.diff, second: second.diff }
}

export type IconMatchResult = {
  decision: IconDecision
  /** 決めた通貨（決まらなければ一番近い通貨）で一番近かった切り出し */
  cropRect?: Rect
}

type Best = { diff: number; rect?: Rect }

const boundsOf = (rects: readonly Rect[], margin: number): Rect => {
  const left = Math.min(...rects.map((r) => r.x)) - margin
  const top = Math.min(...rects.map((r) => r.y)) - margin
  const right = Math.max(...rects.map((r) => r.x + r.width)) + margin
  const bottom = Math.max(...rects.map((r) => r.y + r.height)) + margin
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * 画像の `base` のまわりで切り出しを探し、`refs` の通貨のアイコンと比べて通貨を決める。
 * 試せる切り出しが1つも無ければ切り出せなかったもの（no-crop）とする。
 */
export const matchIconInImage = (
  image: RgbaImage,
  base: Rect,
  range: SearchRange,
  refs: ReadonlyMap<number, Uint8ClampedArray>,
): IconMatchResult => {
  const coarse = coarseRects(base, range, image.width, image.height)
  if (coarse.length === 0) return { decision: { kind: 'no-crop' } }
  // 細かい探しで動く分も含めた範囲だけの累積和を作る
  const integral = integralImage(image, boundsOf(coarse, base.width * ICON_MATCH.fineRange * 2 + 1))
  const best = new Map<number, Best>([...refs.keys()].map((id) => [id, { diff: Infinity }]))
  const tryRects = (rects: readonly Rect[], ids: readonly number[]) => {
    for (const rect of rects) {
      const crop = cropCells(integral, rect)
      for (const id of ids) {
        const ref = refs.get(id)
        const current = best.get(id)
        if (!ref || !current) continue
        const diff = iconPixelDiff(crop, ref)
        if (diff < current.diff) best.set(id, { diff, rect })
      }
    }
  }
  const ids = [...refs.keys()]
  tryRects(coarse, ids)
  for (const id of ids) {
    const around = best.get(id)?.rect
    if (around) tryRects(fineRects(around, base.width, image.width, image.height), [id])
  }
  const decision = decideCurrency(new Map([...best].map(([id, b]) => [id, b.diff])))
  const nearest = [...best].sort((a, b) => a[1].diff - b[1].diff).at(0)
  const chosen = decision.kind === 'matched' ? best.get(decision.costItemId) : nearest?.[1]
  return { decision, cropRect: chosen?.rect ?? base }
}

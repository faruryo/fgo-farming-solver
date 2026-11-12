/**
 * 対価の数の左に写った通貨のアイコンを切り出す位置と、切り出しと Atlas のアイコンの画素の比べ方を決める純粋関数。
 * 画素は 16×16 の RGBA の配列で受け取り、canvas に描いて配列を取る部分（icon-pixels.ts）とは分ける。
 */
import type { IconDecision, Rect } from './types'

/**
 * 照合の定数（実物のスクリーンショットで合わなければここだけ見直す）。
 * - scale: 切り出す正方形の一辺（対価の数の枠の高さの倍数）
 * - jitter: 位置と一辺を変えて試す幅（一辺の割合）
 * - positionSteps: 位置を片側に何段ずつ変えるか（縦横 7段 × 一辺 3段 = 147通り）
 * - maxRatio: 一番近い差 ÷ 次に近い差がこれ以下なら決める
 * - size: 比べる画素の一辺
 * - opaqueAlpha: Atlas のアイコンのこの不透明度以上の画素だけを比べる
 */
export const ICON_MATCH = {
  scale: 1.5,
  jitter: 0.1,
  positionSteps: 3,
  maxRatio: 0.7,
  size: 16,
  opaqueAlpha: 128,
} as const

/** RGBA の画素の配列と、その画像の上の位置（部分を切り出した配列なら左上の座標） */
export type RgbaImage = {
  data: Uint8ClampedArray
  width: number
  height: number
  originX?: number
  originY?: number
}

/** 対価の数の枠の左の、枠の高さの 1.5 倍を一辺とする正方形（右端を枠の左端に、縦の中心を枠の中心に合わせる） */
export const iconBaseRect = (costBox: Rect): Rect => {
  const side = costBox.height * ICON_MATCH.scale
  return {
    x: costBox.x - side,
    y: costBox.y + costBox.height / 2 - side / 2,
    width: side,
    height: side,
  }
}

const steps = (count: number): number[] =>
  Array.from({ length: count * 2 + 1 }, (_, i) => (i - count) / count)

/**
 * 切り出しを試す正方形。基の正方形を最初に置き、中心を縦横に一辺の1割まで、一辺を ±1割まで変えたものを続ける。
 */
export const iconCropRects = (costBox: Rect): Rect[] => {
  const base = iconBaseRect(costBox)
  const cx = base.x + base.width / 2
  const cy = base.y + base.height / 2
  const offsets = steps(ICON_MATCH.positionSteps).map((s) => s * ICON_MATCH.jitter * base.width)
  const rects: Rect[] = [base]
  for (const sizeStep of [-1, 0, 1]) {
    const side = base.width * (1 + sizeStep * ICON_MATCH.jitter)
    for (const dy of offsets) {
      for (const dx of offsets) {
        if (sizeStep === 0 && dx === 0 && dy === 0) continue
        rects.push({ x: cx + dx - side / 2, y: cy + dy - side / 2, width: side, height: side })
      }
    }
  }
  return rects
}

const channel = (data: Uint8ClampedArray, pixel: number, c: number): number => data[pixel * 4 + c]

/**
 * 16×16 の RGBA どうしの差。Atlas のアイコン（ref）の不透明度が半分以上の画素だけで、RGB の差の絶対値の平均（0〜255）を取る。
 * 比べる画素が無ければ Infinity。
 */
export const iconPixelDiff = (crop: Uint8ClampedArray, ref: Uint8ClampedArray): number => {
  const pixels = Math.min(crop.length, ref.length) / 4
  let sum = 0
  let count = 0
  for (let p = 0; p < pixels; p++) {
    if (channel(ref, p, 3) < ICON_MATCH.opaqueAlpha) continue
    sum +=
      Math.abs(channel(crop, p, 0) - channel(ref, p, 0)) +
      Math.abs(channel(crop, p, 1) - channel(ref, p, 1)) +
      Math.abs(channel(crop, p, 2) - channel(ref, p, 2))
    count++
  }
  return count === 0 ? Infinity : sum / (count * 3)
}

/**
 * 通貨ごとの差（試した切り出しごと）から通貨を決める。通貨ごとに一番小さい差を取り、
 * 一番近い差 ÷ 次に近い差が 0.7 以下なら一番近い通貨、超えれば「要確認」。通貨が1つならその通貨に決める。
 */
export const decideCurrency = (diffs: ReadonlyMap<number, readonly number[]>): IconDecision => {
  const ranked = [...diffs]
    .map(([costItemId, values]) => ({ costItemId, diff: values.length > 0 ? Math.min(...values) : Infinity }))
    .sort((a, b) => a.diff - b.diff)
  const [first, second] = ranked
  if (!first || !Number.isFinite(first.diff)) return { kind: 'review' }
  if (!second) return { kind: 'matched', costItemId: first.costItemId, best: first.diff, second: Infinity }
  if (first.diff === second.diff || first.diff / second.diff > ICON_MATCH.maxRatio) return { kind: 'review' }
  return { kind: 'matched', costItemId: first.costItemId, best: first.diff, second: second.diff }
}

/** 試した切り出しのうち、その通貨の差が一番小さいものの添字 */
export const bestCropIndex = (values: readonly number[]): number => {
  let best = 0
  values.forEach((value, i) => {
    if (value < (values.at(best) ?? Infinity)) best = i
  })
  return best
}

type Accumulator = { r: number; g: number; b: number; a: number; n: number }

const accumulate = (image: RgbaImage, sx: number, sy: number, acc: Accumulator): void => {
  const x = Math.floor(sx) - (image.originX ?? 0)
  const y = Math.floor(sy) - (image.originY ?? 0)
  acc.n++
  // 画像の外は透明として数える
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  const pixel = y * image.width + x
  const a = channel(image.data, pixel, 3)
  acc.r += channel(image.data, pixel, 0) * a
  acc.g += channel(image.data, pixel, 1) * a
  acc.b += channel(image.data, pixel, 2) * a
  acc.a += a
}

/**
 * 画像の矩形を size×size に縮めた RGBA。出す画素ごとに元の画素を格子状に拾い、不透明度で重みを付けて色を平均する
 * （透明な画素の色で縁が暗くならないため）。不透明度は単純な平均。
 */
export const resampleRect = (image: RgbaImage, rect: Rect, size: number = ICON_MATCH.size): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(size * size * 4)
  const cell = rect.width / size
  const samples = Math.max(2, Math.min(8, Math.ceil(cell)))
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      const acc: Accumulator = { r: 0, g: 0, b: 0, a: 0, n: 0 }
      for (let k = 0; k < samples * samples; k++) {
        const sx = rect.x + (ox + ((k % samples) + 0.5) / samples) * cell
        const sy = rect.y + (oy + (Math.floor(k / samples) + 0.5) / samples) * (rect.height / size)
        accumulate(image, sx, sy, acc)
      }
      const p = oy * size + ox
      if (acc.a > 0) out.set([acc.r / acc.a, acc.g / acc.a, acc.b / acc.a], p * 4)
      out[p * 4 + 3] = acc.a / acc.n
    }
  }
  return out
}

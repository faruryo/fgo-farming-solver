import { describe, expect, it } from 'vitest'
import {
  coarseRects,
  cropCells,
  decideCurrency,
  downscaleIcon,
  fineRects,
  ICON_MATCH,
  iconPixelDiff,
  integralImage,
  matchIconInImage,
  OWNED_SEARCH,
  ownedIconRect,
  rawPixelDiff,
  ROW_SEARCH,
  rowIconRect,
  type RgbaImage,
} from './icon-match'
import type { Rect } from './types'

const SIZE = ICON_MATCH.size

type Rgb = readonly [number, number, number]

/** 16×16 のアイコン。`color(x, y)` の色で、`alpha(x, y)` の不透明度 */
const makeIcon = (color: (x: number, y: number) => Rgb, alpha: (x: number, y: number) => number = () => 255) => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) data.set([...color(x, y), alpha(x, y)], (y * SIZE + x) * 4)
  }
  return data
}

const RED: Rgb = [220, 40, 40]
const BLUE: Rgb = [40, 40, 220]

/** 縦の縞（1升ずつ赤と青）。STRIPES_B は縞の位相を逆にしたもの（1升の半分ずれると見分けられない） */
const STRIPES_A = makeIcon((x) => (x % 2 === 0 ? RED : BLUE))
const STRIPES_B = makeIcon((x) => (x % 2 === 0 ? BLUE : RED))
/** 太い縦の縞（2升ずつ） */
const WIDE_A = makeIcon((x) => (Math.floor(x / 2) % 2 === 0 ? RED : BLUE))
const WIDE_B = makeIcon((x) => (Math.floor(x / 2) % 2 === 0 ? BLUE : RED))
const GRAY = makeIcon(() => [60, 60, 60])

/** 升の列ごとに決まった乱数の色を並べたアイコン（ずらしても別の種のアイコンには重ならない） */
const randomColumns = (seed: number) => {
  let state = seed
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return (state / 2147483648) * 255
  }
  const columns = Array.from({ length: SIZE }, (): Rgb => [next(), next(), next()])
  return makeIcon((x) => columns.at(x) ?? [0, 0, 0])
}

type Drawing = { icon: Uint8ClampedArray; left: number; top: number; side: number }

/** 暗い背景の画像に、16×16 のアイコンを一辺 `side` に拡大して (left, top) に描き、全体の明るさを `brightness` 倍にする */
const drawScreenshot = (drawings: readonly Drawing[], width = 400, height = 300, brightness = 1): RgbaImage => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let pixel: ArrayLike<number> = [25, 25, 30]
      for (const { icon, left, top, side } of drawings) {
        const ix = Math.floor(((x + 0.5 - left) / side) * SIZE)
        const iy = Math.floor(((y + 0.5 - top) / side) * SIZE)
        if (ix >= 0 && iy >= 0 && ix < SIZE && iy < SIZE) pixel = icon.subarray((iy * SIZE + ix) * 4, (iy * SIZE + ix) * 4 + 3)
      }
      data.set([pixel[0] * brightness, pixel[1] * brightness, pixel[2] * brightness, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}

const center = (r: Rect) => [r.x + r.width / 2, r.y + r.height / 2]

describe('切り出す正方形', () => {
  it('行: 残りの値の枠「1回」の右端から右へ 1.7h、見出し「交換期間あと」の上端から下へ 1.4h を中心に、一辺 2.8h', () => {
    const rect = rowIconRect({ x: 2110, y: 660, width: 92, height: 56 }, { x: 1695, y: 616, width: 245, height: 35 })
    const [cx, cy] = center(rect)
    expect(cx).toBeCloseTo(2202 + 35 * 1.7)
    expect(cy).toBeCloseTo(616 + 35 * 1.4)
    expect(rect.width).toBeCloseTo(35 * 2.8)
    expect(rect.height).toBeCloseTo(35 * 2.8)
  })

  it('所持数: 数の枠「469」の右端から左へ 8.4H、縦の中心から上へ 0.1H を中心に、一辺 2.8H（H は欄の見出しの高さ）', () => {
    const rect = ownedIconRect({ x: 638, y: 1031, width: 105, height: 57 }, 39)
    const [cx, cy] = center(rect)
    expect(cx).toBeCloseTo(743 - 39 * 8.4)
    expect(cy).toBeCloseTo(1031 + 57 / 2 - 39 * 0.1)
    expect(rect.width).toBeCloseTo(39 * 2.8)
  })
})

describe('探し方', () => {
  const base: Rect = { x: 150, y: 100, width: 80, height: 80 }

  it('はじめの探し: 位置を縦横 3 割、一辺を ±3 割まで、一辺の 5% 刻みで試す', () => {
    const rects = coarseRects(base, ROW_SEARCH, 1000, 1000)
    expect(rects).toHaveLength(13 * 13 * 13)
    const [bx, by] = center(base)
    expect(Math.max(...rects.map((r) => center(r)[0] - bx))).toBeCloseTo(24)
    expect(Math.max(...rects.map((r) => center(r)[1] - by))).toBeCloseTo(24)
    expect(Math.min(...rects.map((r) => r.width))).toBeCloseTo(56)
    expect(Math.max(...rects.map((r) => r.width))).toBeCloseTo(104)
    expect(rects.every((r) => r.width === r.height)).toBe(true)
  })

  it('所持数は横だけ 5 割まで探す', () => {
    const rects = coarseRects(base, OWNED_SEARCH, 1000, 1000)
    expect(rects).toHaveLength(21 * 13 * 13)
    expect(Math.max(...rects.map((r) => center(r)[0] - center(base)[0]))).toBeCloseTo(40)
  })

  it('細かい探し: まわりを決めた一辺の 5% まで 1/60 刻みで試す', () => {
    const rects = fineRects(base, 120, 1000, 1000)
    expect(rects).toHaveLength(7 * 7 * 7)
    expect(Math.max(...rects.map((r) => center(r)[0] - center(base)[0]))).toBeCloseTo(6)
    expect(Math.max(...rects.map((r) => r.width))).toBeCloseTo(86)
  })

  it('画像の外にはみ出す切り出しは試さない', () => {
    const nearEdge: Rect = { x: 5, y: 210, width: 80, height: 80 }
    const rects = coarseRects(nearEdge, ROW_SEARCH, 400, 300)
    expect(rects.length).toBeGreaterThan(0)
    expect(rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= 400 && r.y + r.height <= 300)).toBe(true)
  })

  it('試せる切り出しが無ければ切り出せなかったものとする', () => {
    const image = drawScreenshot([])
    const outside: Rect = { x: 350, y: 260, width: 80, height: 80 }
    expect(matchIconInImage(image, outside, ROW_SEARCH, new Map([[1, STRIPES_A], [2, GRAY]]))).toEqual({
      decision: { kind: 'no-crop' },
    })
  })
})

describe('縮め方', () => {
  it('Atlas のアイコン: 128px を 8×8 の升目に分け、RGB は不透明度で重みを付けて平均し、不透明度は升目の平均', () => {
    const width = 128
    const data = new Uint8ClampedArray(width * width * 4)
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        // 左上の升目の左半分は透明な黒、右半分は不透明な赤。ほかは不透明な青
        let pixel = [40, 40, 220, 255]
        if (x < 8 && y < 8) pixel = x < 4 ? [0, 0, 0, 0] : [220, 40, 40, 255]
        data.set(pixel, (y * width + x) * 4)
      }
    }
    const out = downscaleIcon({ data, width, height: width })
    expect([...out.subarray(0, 4)]).toEqual([220, 40, 40, 128])
    expect([...out.subarray(4, 8)]).toEqual([40, 40, 220, 255])
  })

  it('切り出し: 升目の境をいちばん近い画素に丸め、升目の画素の RGB を平均する', () => {
    const image = drawScreenshot([{ icon: WIDE_A, left: 40, top: 20, side: 64 }])
    const crop = cropCells(integralImage(image), { x: 40, y: 20, width: 64, height: 64 })
    expect(rawPixelDiff(crop, WIDE_A)).toBe(0)
  })

  it('一部の範囲の累積和でも、画像の上の位置で切り出す', () => {
    const image = drawScreenshot([{ icon: WIDE_A, left: 40, top: 20, side: 64 }])
    const crop = cropCells(integralImage(image, { x: 30, y: 10, width: 100, height: 100 }), { x: 40, y: 20, width: 64, height: 64 })
    expect(rawPixelDiff(crop, WIDE_A)).toBe(0)
  })
})

describe('iconPixelDiff', () => {
  it('同じ配列の差は 0', () => {
    expect(iconPixelDiff(STRIPES_A, STRIPES_A)).toBe(0)
  })

  it('明るさをそろえてから差を取る（全体を暗くした配列は元の配列と差が 0 に近い）', () => {
    const dark = makeIcon((x) => (x % 2 === 0 ? [88, 16, 16] : [16, 16, 88]))
    expect(iconPixelDiff(dark, STRIPES_A)).toBeLessThan(1)
    expect(rawPixelDiff(dark, STRIPES_A)).toBeGreaterThan(50)
  })

  it('倍率を掛けた値は 255 で頭打ちにする', () => {
    const ref = makeIcon((x) => (x < 8 ? [255, 255, 255] : [0, 0, 0]))
    const crop = makeIcon(() => [100, 100, 100])
    // 合計をそろえる倍率は 1.275。どの升目も 127.5 → 差は 127.5
    expect(iconPixelDiff(crop, ref)).toBeCloseTo(127.5, 0)
  })

  it('Atlas のアイコンの不透明度が半分未満の升目は比べに使わない', () => {
    const ref = makeIcon(() => RED, (x) => (x < 8 ? 255 : 127))
    const crop = makeIcon((x) => (x < 8 ? RED : BLUE))
    expect(iconPixelDiff(crop, ref)).toBe(0)
  })

  it('真っ黒な切り出しは比べに使わない', () => {
    expect(iconPixelDiff(makeIcon(() => [0, 0, 0]), STRIPES_A)).toBe(Infinity)
  })

  it('比べる升目が無ければ Infinity', () => {
    expect(iconPixelDiff(STRIPES_A, makeIcon(() => RED, () => 0))).toBe(Infinity)
  })
})

describe('decideCurrency', () => {
  it('一番近い差 ÷ 次に近い差が 0.5 ちょうどなら決め、0.5 を超えれば要確認', () => {
    expect(decideCurrency(new Map([[1, 5], [2, 10], [3, 30]]))).toEqual({ kind: 'matched', costItemId: 1, best: 5, second: 10 })
    expect(decideCurrency(new Map([[1, 5.1], [2, 10]]))).toEqual({ kind: 'review' })
  })

  it('どちらも差 0 なら要確認', () => {
    expect(decideCurrency(new Map([[1, 0], [2, 0]]))).toEqual({ kind: 'review' })
  })

  it('比べられる通貨が無ければ要確認', () => {
    expect(decideCurrency(new Map([[1, Infinity], [2, Infinity]]))).toEqual({ kind: 'review' })
    expect(decideCurrency(new Map())).toEqual({ kind: 'review' })
  })

  it('通貨が1つならその通貨に決める', () => {
    expect(decideCurrency(new Map([[5, 40]]))).toEqual({ kind: 'matched', costItemId: 5, best: 40, second: Infinity })
  })
})

describe('matchIconInImage', () => {
  const base: Rect = { x: 150, y: 100, width: 84, height: 84 }
  const minDiffs = (image: RgbaImage, rects: readonly Rect[], refs: ReadonlyMap<number, Uint8ClampedArray>) => {
    const integral = integralImage(image)
    const crops = rects.map((r) => cropCells(integral, r))
    return new Map([...refs].map(([id, ref]) => [id, Math.min(...crops.map((c) => iconPixelDiff(c, ref)))]))
  }

  it('位置が合っていれば正しい通貨に決まり、決めた通貨で一番近かった切り出しを返す', () => {
    const image = drawScreenshot([{ icon: WIDE_A, left: base.x, top: base.y, side: base.width }])
    const result = matchIconInImage(image, base, ROW_SEARCH, new Map([[1, WIDE_A], [2, WIDE_B], [3, GRAY]]))
    expect(result.decision).toMatchObject({ kind: 'matched', costItemId: 1 })
    expect(result.cropRect).toBeDefined()
    const [cx, cy] = center(result.cropRect ?? base)
    expect(Math.abs(cx - center(base)[0])).toBeLessThan(3)
    expect(Math.abs(cy - center(base)[1])).toBeLessThan(3)
  })

  it('全体を 0.4 倍に暗くしても明るさをそろえて正しい通貨に決まり、そろえない差では決まらない', () => {
    const image = drawScreenshot([{ icon: STRIPES_A, left: base.x, top: base.y, side: base.width }], 400, 300, 0.4)
    const refs = new Map([[1, STRIPES_A], [2, GRAY]])
    expect(matchIconInImage(image, base, ROW_SEARCH, refs).decision).toMatchObject({ kind: 'matched', costItemId: 1 })
    const crop = cropCells(integralImage(image), base)
    const raw = decideCurrency(new Map([...refs].map(([id, ref]) => [id, rawPixelDiff(crop, ref)])))
    expect(raw).not.toMatchObject({ kind: 'matched', costItemId: 1 })
  })

  it('粗い刻みの間に正しい位置があっても、細かい探しで正しい通貨に決まる', () => {
    // 粗い刻みは 4.2px。アイコンを刻みの半分ずらして描く
    const a = randomColumns(1)
    const image = drawScreenshot([{ icon: a, left: base.x + 2.1, top: base.y + 2.1, side: base.width }])
    const refs = new Map([[1, a], [2, randomColumns(1001)]])
    expect(decideCurrency(minDiffs(image, coarseRects(base, ROW_SEARCH, 400, 300), refs))).toEqual({ kind: 'review' })
    expect(matchIconInImage(image, base, ROW_SEARCH, refs).decision).toMatchObject({ kind: 'matched', costItemId: 1 })
  })

  it('所持数で予測が一辺の 4 割だけ横にずれていても正しい通貨に決まる', () => {
    const image = drawScreenshot([{ icon: WIDE_A, left: base.x + base.width * 0.4, top: base.y, side: base.width }])
    const refs = new Map([[1, WIDE_A], [2, WIDE_B], [3, GRAY]])
    expect(matchIconInImage(image, base, OWNED_SEARCH, refs).decision).toMatchObject({ kind: 'matched', costItemId: 1 })
  })

  it('どの通貨のアイコンにも近くなければ（2つに同じくらい近ければ）要確認', () => {
    // 上半分は STRIPES_A、下半分は STRIPES_B
    const half = makeIcon((x, y) => {
      const phase = y < 8 ? 0 : 1
      return (x + phase) % 2 === 0 ? RED : BLUE
    })
    const image = drawScreenshot([{ icon: half, left: base.x, top: base.y, side: base.width }])
    const refs = new Map([[1, STRIPES_A], [2, STRIPES_B]])
    expect(matchIconInImage(image, base, ROW_SEARCH, refs).decision).toEqual({ kind: 'review' })
  })
})

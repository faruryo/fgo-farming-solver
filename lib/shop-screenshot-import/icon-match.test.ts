import { describe, expect, it } from 'vitest'
import {
  bestCropIndex,
  decideCurrency,
  ICON_MATCH,
  iconBaseRect,
  iconCropRects,
  iconPixelDiff,
  resampleRect,
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

/** 縦の縞（2画素ずつ赤と青）。STRIPES_B は縞の位相を逆にしたもの（2画素ずれると STRIPES_A と見分けられない） */
const STRIPES_A = makeIcon((x) => (Math.floor(x / 2) % 2 === 0 ? RED : BLUE))
const STRIPES_B = makeIcon((x) => (Math.floor(x / 2) % 2 === 0 ? BLUE : RED))
const GRAY = makeIcon(() => [130, 130, 130])

/** 暗い背景の画像に、16×16 のアイコンを一辺 `side` に拡大して (left, top) に描く */
const drawScreenshot = (icon: Uint8ClampedArray, left: number, top: number, side: number): RgbaImage => {
  const width = 200
  const height = 120
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ix = Math.floor(((x - left) / side) * SIZE)
      const iy = Math.floor(((y - top) / side) * SIZE)
      const inside = ix >= 0 && iy >= 0 && ix < SIZE && iy < SIZE
      const pixel = inside ? icon.subarray((iy * SIZE + ix) * 4, (iy * SIZE + ix) * 4 + 3) : [25, 25, 30]
      data.set([...pixel, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}

const diffsOf = (image: RgbaImage, rects: readonly Rect[], refs: Record<number, Uint8ClampedArray>) =>
  new Map(
    Object.entries(refs).map(([id, ref]) => [
      Number(id),
      rects.map((rect) => iconPixelDiff(resampleRect(image, rect), ref)),
    ]),
  )

describe('iconBaseRect', () => {
  it('対価の数の枠の左に、枠の高さの 1.5 倍を一辺とする正方形を、右端と縦の中心を合わせて置く', () => {
    expect(iconBaseRect({ x: 100, y: 50, width: 40, height: 20 })).toEqual({ x: 70, y: 45, width: 30, height: 30 })
  })
})

describe('iconCropRects', () => {
  const costBox = { x: 100, y: 50, width: 40, height: 20 }
  const rects = iconCropRects(costBox)

  it('基の正方形を最初に置き、位置 7×7 と一辺 3段の切り出しを試す', () => {
    expect(rects[0]).toEqual(iconBaseRect(costBox))
    expect(rects).toHaveLength(7 * 7 * 3)
  })

  it('位置は一辺の1割まで、一辺は ±1割まで変える', () => {
    const base = iconBaseRect(costBox)
    const center = (r: Rect) => [r.x + r.width / 2, r.y + r.height / 2]
    const [bx, by] = center(base)
    for (const rect of rects) {
      const [cx, cy] = center(rect)
      expect(Math.abs(cx - bx)).toBeLessThanOrEqual(base.width * 0.1 + 1e-9)
      expect(Math.abs(cy - by)).toBeLessThanOrEqual(base.width * 0.1 + 1e-9)
      expect(rect.width).toBeGreaterThanOrEqual(base.width * 0.9 - 1e-9)
      expect(rect.width).toBeLessThanOrEqual(base.width * 1.1 + 1e-9)
      expect(rect.height).toBe(rect.width)
    }
    expect(Math.max(...rects.map((r) => center(r)[0]))).toBeCloseTo(bx + base.width * 0.1)
    expect(Math.min(...rects.map((r) => r.width))).toBeCloseTo(base.width * 0.9)
  })
})

describe('iconPixelDiff', () => {
  it('同じ配列の差は 0', () => {
    expect(iconPixelDiff(STRIPES_A, STRIPES_A)).toBe(0)
  })

  it('RGB の差の絶対値の平均（1チャンネルあたり）', () => {
    const black = makeIcon(() => [0, 0, 0])
    const color = makeIcon(() => [30, 60, 90])
    expect(iconPixelDiff(black, color)).toBe(60)
  })

  it('Atlas のアイコンの不透明度が半分未満の画素は比べに使わない', () => {
    // 左半分だけ不透明な参照。右半分の切り出しの色は大きく違っても差に入らない
    const ref = makeIcon(() => RED, (x) => (x < 8 ? 255 : 127))
    const crop = makeIcon((x) => (x < 8 ? RED : BLUE))
    expect(iconPixelDiff(crop, ref)).toBe(0)
  })

  it('不透明度 128 の画素は比べに使う', () => {
    const ref = makeIcon(() => RED, () => 128)
    expect(iconPixelDiff(makeIcon(() => BLUE), ref)).toBeGreaterThan(0)
  })

  it('比べる画素が無ければ Infinity', () => {
    const ref = makeIcon(() => RED, () => 0)
    expect(iconPixelDiff(STRIPES_A, ref)).toBe(Infinity)
  })
})

describe('decideCurrency', () => {
  it('同じ配列の通貨が一番近い', () => {
    const diffs = new Map([
      [1, [iconPixelDiff(STRIPES_A, STRIPES_A)]],
      [2, [iconPixelDiff(STRIPES_A, STRIPES_B)]],
      [3, [iconPixelDiff(STRIPES_A, GRAY)]],
    ])
    expect(decideCurrency(diffs)).toMatchObject({ kind: 'matched', costItemId: 1, best: 0 })
  })

  it('通貨ごとに試した切り出しの一番小さい差を使う', () => {
    const diffs = new Map([
      [1, [50, 30, 10]],
      [2, [20, 40, 60]],
    ])
    expect(decideCurrency(diffs)).toEqual({ kind: 'matched', costItemId: 1, best: 10, second: 20 })
  })

  it('2つの通貨に同じくらい近いと要確認', () => {
    const diffs = new Map([
      [1, [20]],
      [2, [21]],
      [3, [60]],
    ])
    expect(decideCurrency(diffs)).toEqual({ kind: 'review' })
  })

  it('差の比が 0.7 ちょうどなら決め、0.7 を超えれば要確認', () => {
    expect(decideCurrency(new Map([[1, [7]], [2, [10]]]))).toMatchObject({ kind: 'matched', costItemId: 1 })
    expect(decideCurrency(new Map([[1, [7.1]], [2, [10]]]))).toEqual({ kind: 'review' })
  })

  it('どちらも差 0 なら要確認', () => {
    expect(decideCurrency(new Map([[1, [0]], [2, [0]]]))).toEqual({ kind: 'review' })
  })

  it('比べられる通貨が無ければ要確認', () => {
    expect(decideCurrency(new Map([[1, [Infinity]], [2, [Infinity]]]))).toEqual({ kind: 'review' })
    expect(decideCurrency(new Map())).toEqual({ kind: 'review' })
  })

  it('通貨が1つならその通貨に決める', () => {
    expect(decideCurrency(new Map([[5, [40]]]))).toEqual({ kind: 'matched', costItemId: 5, best: 40, second: Infinity })
  })
})

describe('切り出しの位置がずれたときの照合', () => {
  // 対価の数の枠の高さ 20 → 切り出しの一辺 30。アイコンは実際には一辺 30 で描かれている
  const costBox = { x: 100, y: 50, width: 40, height: 20 }
  const base = iconBaseRect(costBox)
  const refs = { 1: STRIPES_A, 2: STRIPES_B, 3: GRAY }

  it('切り出しの位置がアイコンと合っていれば、基の位置だけでも正しい通貨に決まる', () => {
    const image = drawScreenshot(STRIPES_A, base.x, base.y, base.width)
    expect(decideCurrency(diffsOf(image, [base], refs))).toMatchObject({ kind: 'matched', costItemId: 1 })
  })

  it('アイコンが一辺の1割ずれて写っていても、位置を変えて試すことで正しい通貨に決まる', () => {
    // 縞 2画素分（一辺 30 では 3.75px）の半分を超えてずれると、基の位置では逆の位相の縞に近くなる
    const image = drawScreenshot(STRIPES_A, base.x + 3, base.y - 2, base.width)
    expect(decideCurrency(diffsOf(image, [base], refs))).not.toMatchObject({ kind: 'matched', costItemId: 1 })
    const rects = iconCropRects(costBox)
    const diffs = diffsOf(image, rects, refs)
    expect(decideCurrency(diffs)).toMatchObject({ kind: 'matched', costItemId: 1 })
    // 一番近かった切り出しは、アイコンの位置に寄せたもの
    const best = rects[bestCropIndex(diffs.get(1) ?? [])]
    expect(best.x).toBeGreaterThan(base.x)
    expect(best.y).toBeLessThan(base.y)
  })
})

describe('resampleRect', () => {
  it('画素を拡大した画像を元の大きさの矩形で縮めると元の画素に戻る', () => {
    const image = drawScreenshot(STRIPES_A, 40, 20, 64)
    expect(iconPixelDiff(resampleRect(image, { x: 40, y: 20, width: 64, height: 64 }), STRIPES_A)).toBe(0)
  })

  it('透明な画素の色で縁が暗くならないよう、不透明度で重みを付けて色を平均する', () => {
    // 左半分が透明な黒、右半分が不透明な赤の 2×1 の画像を 1×1 に縮める
    const data = new Uint8ClampedArray([0, 0, 0, 0, 220, 40, 40, 255])
    const out = resampleRect({ data, width: 2, height: 1 }, { x: 0, y: 0, width: 2, height: 1 }, 1)
    expect([...out.subarray(0, 3)]).toEqual([220, 40, 40])
    expect(out[3]).toBe(128)
  })

  it('部分を切り出した画像では左上の座標を差し引いて読む', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255])
    const out = resampleRect({ data, width: 1, height: 1, originX: 50, originY: 60 }, { x: 50, y: 60, width: 1, height: 1 }, 1)
    expect([...out]).toEqual([10, 20, 30, 255])
  })
})

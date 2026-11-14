import { describe, expect, it } from 'vitest'
import type { RgbaImage } from '../shop-screenshot-import/icon-match'
import { FACE_MATCH, ROSTER_LAYOUT } from './constants'
import { faceCandidates, matchFace } from './face-match'
import { faceRect, gridFromHeading, gridTopY } from './grid'
import { findRowTops, locateRoster, scanFaceTops } from './row-search'
import type { FaceIconData, OcrBox } from './types'

const SIZE = FACE_MATCH.size

type Rgb = readonly [number, number, number]

/** 見出しの枠の高さ 20 画素の画面（実物の 57 画素より小さくして、テストを速くする） */
const HEADING: OcrBox = { text: '強化するサーヴァントを選択してください', confidence: 1, x: 70, y: 10, width: 300, height: 20 }
const GRID = gridFromHeading(HEADING)
const WIDTH = 590
const BACKGROUND: Rgb = [20, 24, 40]

const makeIcon = (color: (x: number, y: number) => Rgb): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) data.set([...color(x, y), 255], (y * SIZE + x) * 4)
  }
  return data
}

/** 升目ごとに決まった乱数の色のアイコン */
const randomIcon = (seed: number): Uint8ClampedArray => {
  let state = seed
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return 30 + (state / 2147483648) * 200
  }
  const cells = Array.from({ length: SIZE * SIZE }, (): Rgb => [next(), next(), next()])
  return makeIcon((x, y) => cells.at(y * SIZE + x) ?? [0, 0, 0])
}

/** 21騎のサーヴァント（ID は 1〜21）のアイコン */
const ICONS = Array.from({ length: 21 }, (_, i) => ({ servantId: i + 1, pixels: randomIcon(i + 1) }))
const encode = (pixels: Uint8ClampedArray): string => btoa(String.fromCharCode(...pixels))
const iconData = (icons: readonly { servantId: number; pixels: Uint8ClampedArray }[]): FaceIconData => ({
  icons: icons.map(({ servantId, pixels }) => ({ servantId, url: `https://example.test/${servantId}.png`, pixels: encode(pixels) })),
})
const CANDIDATES = faceCandidates(iconData(ICONS), new Set(ICONS.map((i) => i.servantId)))

const blank = (height: number): RgbaImage => {
  const data = new Uint8ClampedArray(WIDTH * height * 4)
  for (let p = 0; p < WIDTH * height; p++) data.set([...BACKGROUND, 255], p * 4)
  return { data, width: WIDTH, height }
}

/**
 * アイコンを一辺 GRID.side に拡大して (left, top) に貼る（画像の外は描かない）。
 * 升目の境は切り出しを縮めるときと同じく、いちばん近い画素に丸める。
 */
const paste = (image: RgbaImage, icon: Uint8ClampedArray, left: number, top: number): void => {
  const edges = (start: number) => Array.from({ length: SIZE + 1 }, (_, i) => Math.round(start + (GRID.side * i) / SIZE))
  const xs = edges(left)
  const ys = edges(top)
  for (let cy = 0; cy < SIZE; cy++) {
    for (let cx = 0; cx < SIZE; cx++) {
      const p = (cy * SIZE + cx) * 4
      const color = [...icon.subarray(p, p + 3), 255]
      for (let y = Math.max(0, ys.at(cy) ?? 0); y < Math.min(image.height, ys.at(cy + 1) ?? 0); y++) {
        for (let x = Math.max(0, xs.at(cx) ?? 0); x < Math.min(image.width, xs.at(cx + 1) ?? 0); x++) {
          image.data.set(color, (y * image.width + x) * 4)
        }
      }
    }
  }
}

/** 7つの列にサーヴァント `firstId` から順のアイコンを貼った段 */
const pasteRow = (image: RgbaImage, top: number, firstId: number, columns: readonly number[] = [0, 1, 2, 3, 4, 5, 6]) => {
  for (const column of columns) {
    const icon = ICONS.find((i) => i.servantId === firstId + column)?.pixels
    const x = GRID.columnXs.at(column)
    if (icon && x !== undefined) paste(image, icon, x, top)
  }
}

/** 試す位置の k 番目（画像の高さによらない） */
const scanTop = (k: number): number => {
  const tops = scanFaceTops(GRID, 10_000)
  return tops.at(k) ?? NaN
}
/** 段の間隔に近い、試す位置の刻みの数 */
const ROW_STEPS = Math.round((ROSTER_LAYOUT.rowPitch * GRID.unit) / (FACE_MATCH.rowScanStep * GRID.side))
const bottomBandBottom = (top: number) => top + ROSTER_LAYOUT.bottomBandBottom * GRID.unit

describe('scanFaceTops', () => {
  it('上の文字の帯が格子の上の端より下に来る位置から、下の文字の帯の下端が画像に収まる位置までだけを試す', () => {
    const height = 360
    const tops = scanFaceTops(GRID, height)
    const step = FACE_MATCH.rowScanStep * GRID.side
    const topBandTop = (top: number) => top + ROSTER_LAYOUT.topBand.down * GRID.unit
    expect(tops.length).toBeGreaterThan(10)
    for (const top of tops) {
      expect(topBandTop(top)).toBeGreaterThanOrEqual(gridTopY(GRID) - 1e-9)
      expect(bottomBandBottom(top)).toBeLessThanOrEqual(height)
    }
    const first = tops.at(0) ?? NaN
    const last = tops.at(-1) ?? NaN
    expect(topBandTop(first)).toBeCloseTo(gridTopY(GRID), 9)
    expect(bottomBandBottom(last + step)).toBeGreaterThan(height)
  })

  it('下の文字の帯が1つの位置でも収まらない画像では何も試さない', () => {
    expect(scanFaceTops(GRID, Math.floor(gridTopY(GRID) + ROSTER_LAYOUT.bottomBandBottom * GRID.unit))).toEqual([])
  })
})

describe('findRowTops', () => {
  const threeRows = (height: number, k0 = 0) => {
    const image = blank(height)
    const tops = [k0, k0 + ROW_STEPS, k0 + ROW_STEPS * 2].map(scanTop)
    tops.forEach((top) => pasteRow(image, top, 1))
    return { image, tops }
  }

  it('カードごとに取り出す: 7枚×3段まるごと写った画像から3つの段と21枚のカードが見つかる', () => {
    const tops = [0, ROW_STEPS, ROW_STEPS * 2].map(scanTop)
    const image = blank(Math.ceil(bottomBandBottom(tops.at(-1) ?? 0)) + 2)
    tops.forEach((top, row) => pasteRow(image, top, 1 + row * 7))
    const rowTops = findRowTops(image, GRID, CANDIDATES)
    expect(rowTops).toEqual(tops)
    const matched = rowTops.flatMap((top) =>
      GRID.columnXs.map((x) => matchFace(image, faceRect(GRID, x, top), CANDIDATES)),
    )
    expect(matched.map((m) => (m.kind === 'matched' ? m.servantId : null))).toEqual(
      Array.from({ length: 21 }, (_, i) => i + 1),
    )
  })

  it('端で切れた段: 顔が画像の下の端からはみ出す段は返らない', () => {
    const { image, tops } = threeRows(400)
    const cut = scanTop(ROW_STEPS * 3)
    expect(cut + GRID.side).toBeGreaterThan(400)
    pasteRow(image, cut, 1)
    expect(findRowTops(image, GRID, CANDIDATES)).toEqual(tops)
  })

  it('下の文字だけが切れた段: 顔は収まるが下の文字の帯の下端がはみ出す段は返らない', () => {
    const tops = [0, ROW_STEPS, ROW_STEPS * 2].map(scanTop)
    const third = tops.at(2) ?? NaN
    // 顔の下端がちょうど画像の下の端（下の文字の帯の下端ははみ出す）
    const height = Math.round(third + GRID.side)
    expect(third + GRID.side).toBeLessThanOrEqual(height)
    expect(bottomBandBottom(third)).toBeGreaterThan(height)
    const image = blank(height)
    tops.forEach((top) => pasteRow(image, top, 1))
    expect(findRowTops(image, GRID, CANDIDATES)).toEqual(tops.slice(0, 2))
  })

  it('上の文字だけが隠れた段: 顔は格子の上の端より下でも、上の文字の帯が格子の上の端より上に来る段は返らない', () => {
    const image = blank(360)
    const hidden = gridTopY(GRID)
    expect(hidden + ROSTER_LAYOUT.topBand.down * GRID.unit).toBeLessThan(gridTopY(GRID))
    pasteRow(image, hidden, 1)
    const next = scanTop(ROW_STEPS + 1)
    pasteRow(image, next, 8)
    expect(findRowTops(image, GRID, CANDIDATES)).toEqual([next])
  })

  it('上の端で隠れた段: 上半分が見出しやボタンの帯に隠れた段は返らない', () => {
    const image = blank(360)
    const hidden = gridTopY(GRID) - GRID.side / 2
    pasteRow(image, hidden, 1)
    // 格子の上の端より上を帯で塗る
    for (let y = 0; y < Math.round(gridTopY(GRID)); y++) {
      for (let x = 0; x < WIDTH; x++) image.data.set([200, 200, 200, 255], (y * WIDTH + x) * 4)
    }
    const next = scanTop(Math.round(ROW_STEPS / 2))
    pasteRow(image, next, 8)
    expect(findRowTops(image, GRID, CANDIDATES)).toEqual([next])
  })

  it('一覧を途中まで送った画像: 段の縦の位置が違っても段が見つかる', () => {
    for (const k0 of [7, 23, 41]) {
      const { image, tops } = threeRows(Math.ceil(bottomBandBottom(scanTop(k0 + ROW_STEPS * 2))) + 1, k0)
      expect(findRowTops(image, GRID, CANDIDATES)).toEqual(tops)
    }
  })

  it('1つの列にだけアイコンを貼った段も見つかる', () => {
    const image = blank(360)
    const top = scanTop(12)
    pasteRow(image, top, 1, [3])
    expect(findRowTops(image, GRID, CANDIDATES)).toEqual([top])
  })

  it('刻みの間に貼った段は1つの段として1回だけ返る', () => {
    // 升目の色がなだらかに変わるアイコン（刻みの間でも差が上限以下になる）
    const smooth = makeIcon((x, y) => [60 + x * 8, 50 + y * 9, 120 + (x + y) * 3])
    const candidates = faceCandidates(iconData([{ servantId: 1, pixels: smooth }]), new Set([1]))
    const image = blank(360)
    const between = (scanTop(30) + scanTop(31)) / 2
    for (const x of GRID.columnXs) paste(image, smooth, x, between)
    const rowTops = findRowTops(image, GRID, candidates)
    expect(rowTops).toHaveLength(1)
    expect(Math.abs((rowTops.at(0) ?? NaN) - between)).toBeLessThan(GRID.side * 0.1)
  })

  it('候補に無いアイコンだけの段は見つからない', () => {
    const image = blank(360)
    for (const x of GRID.columnXs) paste(image, randomIcon(999), x, scanTop(10))
    expect(findRowTops(image, GRID, CANDIDATES)).toEqual([])
  })
})

describe('locateRoster', () => {
  it('段が1つも無い画像は読めなかった画像になる', () => {
    expect(locateRoster([HEADING], blank(360), CANDIDATES)).toEqual({ kind: 'unreadable' })
  })

  it('見出しの無い画像は、段があっても読めなかった画像になる', () => {
    const image = blank(360)
    pasteRow(image, scanTop(0), 1)
    expect(locateRoster([], image, CANDIDATES)).toEqual({ kind: 'unreadable' })
    expect(locateRoster([HEADING], image, CANDIDATES)).toMatchObject({ kind: 'located', rowTops: [scanTop(0)] })
  })
})

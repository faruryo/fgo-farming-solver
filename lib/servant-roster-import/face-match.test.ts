import { describe, expect, it } from 'vitest'
import type { RgbaImage } from '../shop-screenshot-import/icon-match'
import { FACE_MATCH } from './constants'
import { decideFace, decodeFacePixels, faceCandidates, matchFace } from './face-match'
import type { FaceIconData, Rect } from './types'

const SIZE = FACE_MATCH.size

type Rgb = readonly [number, number, number]

/** 16×16 の不透明なアイコン */
const makeIcon = (color: (x: number, y: number) => Rgb): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) data.set([...color(x, y), 255], (y * SIZE + x) * 4)
  }
  return data
}

/** 升目ごとに決まった乱数の色（30〜230）のアイコン */
const randomIcon = (seed: number): Uint8ClampedArray => {
  let state = seed
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return 30 + (state / 2147483648) * 200
  }
  const cells = Array.from({ length: SIZE * SIZE }, (): Rgb => [next(), next(), next()])
  return makeIcon((x, y) => cells.at(y * SIZE + x) ?? [0, 0, 0])
}

/** 全部の升目の RGB に `delta` を足したアイコン */
const shifted = (icon: Uint8ClampedArray, delta: number): Uint8ClampedArray =>
  icon.map((v, i) => (i % 4 === 3 ? v : v + delta))

/** 比べない升目だけを `color` に塗ったアイコン（重なる表示の代わり） */
const overlaid = (icon: Uint8ClampedArray, color: Rgb): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(icon)
  const { cellRows, cellColumns } = FACE_MATCH
  for (let p = 0; p < SIZE * SIZE; p++) {
    const row = Math.floor(p / SIZE)
    const column = p % SIZE
    const compared = row >= cellRows.from && row <= cellRows.to && column >= cellColumns.from && column <= cellColumns.to
    if (!compared) out.set(color, p * 4)
  }
  return out
}

const encode = (pixels: Uint8ClampedArray): string => btoa(String.fromCharCode(...pixels))

const iconData = (icons: readonly { servantId: number; pixels: Uint8ClampedArray }[]): FaceIconData => ({
  icons: icons.map(({ servantId, pixels }, i) => ({ servantId, url: `https://example.test/${i}.png`, pixels: encode(pixels) })),
})

/** 1升 4 画素で 1枚のアイコンを (16, 16) に描いた 96×96 の画像。顔の正方形は FACE */
const CELL = 4
const FACE: Rect = { x: 16, y: 16, width: SIZE * CELL, height: SIZE * CELL }
const screenshot = (icon: Uint8ClampedArray): RgbaImage => {
  const width = 96
  const height = 96
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= FACE.x && x < FACE.x + FACE.width && y >= FACE.y && y < FACE.y + FACE.height
      const p = inside ? (Math.floor((y - FACE.y) / CELL) * SIZE + Math.floor((x - FACE.x) / CELL)) * 4 : -1
      data.set(p >= 0 ? [...icon.subarray(p, p + 3), 255] : [0, 0, 0, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}

const SERVANT_A = 100100
const SERVANT_B = 200200
const SERVANT_DARK = 300300
const SERVANT_C = 400400

const A_STAGE1 = randomIcon(1)
const A_STAGE2 = shifted(A_STAGE1, 8)
const A_STAGE3 = randomIcon(2)
const A_COSTUME = randomIcon(3)
const B = randomIcon(4)
const DARK = makeIcon(() => [8, 8, 8])

const ALL_IDS = new Set([SERVANT_A, SERVANT_B, SERVANT_DARK, SERVANT_C])

const candidatesOf = (icons: readonly { servantId: number; pixels: Uint8ClampedArray }[]) =>
  faceCandidates(iconData(icons), ALL_IDS)

const STANDARD = candidatesOf([
  { servantId: SERVANT_A, pixels: A_STAGE1 },
  { servantId: SERVANT_A, pixels: A_STAGE2 },
  { servantId: SERVANT_A, pixels: A_STAGE3 },
  { servantId: SERVANT_A, pixels: A_COSTUME },
  { servantId: SERVANT_B, pixels: B },
  { servantId: SERVANT_DARK, pixels: DARK },
])

describe('faceCandidates', () => {
  it('育成計算機の一覧にいるサーヴァントのアイコンだけを、比べない升目を透明にして候補にする', () => {
    const candidates = faceCandidates(
      iconData([
        { servantId: SERVANT_A, pixels: A_STAGE1 },
        { servantId: 999999, pixels: B },
      ]),
      new Set([SERVANT_A]),
    )
    expect(candidates.map((c) => c.servantId)).toEqual([SERVANT_A])
    const pixels = candidates.at(0)?.pixels ?? new Uint8ClampedArray()
    const alphaAt = (row: number, column: number) => pixels[(row * SIZE + column) * 4 + 3]
    // 比べる升目は段 3〜10・列 3〜15（0 始まり、両端を含む）
    expect(alphaAt(3, 3)).toBe(255)
    expect(alphaAt(10, 15)).toBe(255)
    expect(alphaAt(2, 3)).toBe(0)
    expect(alphaAt(11, 3)).toBe(0)
    expect(alphaAt(3, 2)).toBe(0)
    let opaque = 0
    for (let p = 0; p < SIZE * SIZE; p++) if (pixels[p * 4 + 3] === 255) opaque++
    expect(opaque).toBe(8 * 13)
  })

  it('16×16 の RGBA でない画素の文字列は飛ばす', () => {
    const data: FaceIconData = {
      icons: [
        { servantId: SERVANT_A, url: 'a', pixels: encode(new Uint8ClampedArray(10)) },
        { servantId: SERVANT_A, url: 'b', pixels: '%%%' },
        { servantId: SERVANT_B, url: 'c', pixels: encode(B) },
      ],
    }
    expect(faceCandidates(data, ALL_IDS).map((c) => c.servantId)).toEqual([SERVANT_B])
    expect(decodeFacePixels(encode(B))).toEqual(B)
  })
})

describe('matchFace', () => {
  it('顔で当てる: 第3段階のアイコンにだけ近いカードをそのサーヴァントに当てる', () => {
    const match = matchFace(screenshot(A_STAGE3), FACE, STANDARD)
    expect(match).toMatchObject({ kind: 'matched', servantId: SERVANT_A })
    if (match.kind !== 'matched') return
    expect(match.best).toBeLessThanOrEqual(FACE_MATCH.maxDiff)
    expect(match.rect).toEqual(FACE)
  })

  it('霊衣の顔: 霊衣のアイコンにだけ近いカードをそのサーヴァントに当てる', () => {
    expect(matchFace(screenshot(A_COSTUME), FACE, STANDARD)).toMatchObject({ kind: 'matched', servantId: SERVANT_A })
  })

  it('同じサーヴァントの段階どうしが近い: 「要確認」にせず、そのサーヴァントに当てる', () => {
    // 第1段階と第2段階のちょうど間の色（どちらとも差 4）
    const match = matchFace(screenshot(shifted(A_STAGE1, 4)), FACE, STANDARD)
    expect(match).toMatchObject({ kind: 'matched', servantId: SERVANT_A })
    if (match.kind !== 'matched') return
    expect(match.best).toBeCloseTo(4, 0)
    expect(match.second).toBeGreaterThan(FACE_MATCH.maxDiff)
  })

  it('重なる表示が違う: 比べない升目だけが違う2枚のカードが同じ結果になる', () => {
    const plain = matchFace(screenshot(B), FACE, STANDARD)
    const covered = matchFace(screenshot(overlaid(B, [255, 255, 255])), FACE, STANDARD)
    expect(plain).toMatchObject({ kind: 'matched', servantId: SERVANT_B })
    if (plain.kind !== 'matched') return
    expect(covered).toMatchObject({ kind: 'matched', servantId: SERVANT_B, best: plain.best, rect: plain.rect })
  })

  it('暗いアイコンに引き寄せられない: 明るい別のサーヴァントの絵を黒いアイコンのサーヴァントに当てない', () => {
    const bright = randomIcon(5)
    const withServant = matchFace(
      screenshot(bright),
      FACE,
      candidatesOf([
        { servantId: SERVANT_DARK, pixels: DARK },
        { servantId: SERVANT_C, pixels: bright },
      ]),
    )
    expect(withServant).toMatchObject({ kind: 'matched', servantId: SERVANT_C })
    // 明るい絵のサーヴァントが候補に無くても、黒いアイコンには当てない
    const withoutServant = matchFace(screenshot(bright), FACE, candidatesOf([{ servantId: SERVANT_DARK, pixels: DARK }]))
    expect(withoutServant).toMatchObject({ kind: 'review', reason: 'unknown-face' })
  })

  it('別のサーヴァントと差が小さい: 2騎に同じくらい近いカードを「要確認」にする', () => {
    const candidates = candidatesOf([
      { servantId: SERVANT_A, pixels: A_STAGE1 },
      { servantId: SERVANT_C, pixels: shifted(A_STAGE1, 8) },
      { servantId: SERVANT_B, pixels: B },
    ])
    const match = matchFace(screenshot(shifted(A_STAGE1, 4)), FACE, candidates)
    expect(match).toMatchObject({ kind: 'review', reason: 'ambiguous-face' })
    if (match.kind !== 'review') return
    expect(new Set(match.nearest.slice(0, 2))).toEqual(new Set([SERVANT_A, SERVANT_C]))
    expect(match.nearest.at(2)).toBe(SERVANT_B)
  })

  it('どのサーヴァントにも近くない: 次に近いサーヴァントとの差が大きくても「要確認」にする', () => {
    // 一番近い A との差は 12（上限 10 を超える）、次の B とは大きく離れる
    const match = matchFace(
      screenshot(shifted(A_STAGE1, 12)),
      FACE,
      candidatesOf([
        { servantId: SERVANT_A, pixels: A_STAGE1 },
        { servantId: SERVANT_B, pixels: B },
      ]),
    )
    expect(match).toMatchObject({ kind: 'review', reason: 'unknown-face' })
    if (match.kind !== 'review') return
    expect(match.best).toBeGreaterThan(FACE_MATCH.maxDiff)
    expect(match.nearest).toEqual([SERVANT_A, SERVANT_B])
  })

  it('候補が空なら、どのサーヴァントにも近くない', () => {
    expect(matchFace(screenshot(B), FACE, [])).toMatchObject({ kind: 'review', reason: 'unknown-face', nearest: [] })
  })
})

describe('decideFace', () => {
  const rect: Rect = { x: 0, y: 0, width: 10, height: 10 }
  const diffs = (entries: [number, number][]) => new Map(entries.map(([id, diff]) => [id, { diff, rect }]))

  it('一番近い差が上限ちょうどなら比で決め、上限を超えれば「要確認」', () => {
    expect(decideFace(diffs([[1, 10], [2, 20]]), rect)).toMatchObject({ kind: 'matched', servantId: 1 })
    expect(decideFace(diffs([[1, 10.01], [2, 40]]), rect)).toMatchObject({ kind: 'review', reason: 'unknown-face' })
  })

  it('比がしきい値ちょうどなら決め、超えれば「要確認」', () => {
    expect(decideFace(diffs([[1, 5], [2, 10]]), rect)).toMatchObject({ kind: 'matched', servantId: 1, second: 10 })
    expect(decideFace(diffs([[1, 5], [2, 9.9]]), rect)).toMatchObject({ kind: 'review', reason: 'ambiguous-face' })
  })

  it('候補のサーヴァントが1騎だけなら、上限以下で決める', () => {
    expect(decideFace(diffs([[1, 3]]), rect)).toMatchObject({ kind: 'matched', servantId: 1, second: Infinity })
  })

  it('近いサーヴァントは近い順に決まった数まで添える', () => {
    const many = diffs(Array.from({ length: 8 }, (_, i): [number, number] => [i + 1, 50 - i]))
    const match = decideFace(many, rect)
    expect(match).toMatchObject({ kind: 'review', reason: 'unknown-face' })
    if (match.kind === 'review') expect(match.nearest).toEqual([8, 7, 6, 5, 4].slice(0, FACE_MATCH.reviewCandidates))
  })
})

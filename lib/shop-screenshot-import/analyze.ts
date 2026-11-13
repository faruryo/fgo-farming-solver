/**
 * 交換所の画面のスクリーンショットを読み取り、行を品目に・欄の数を通貨に当てはめるブラウザの部分。
 * 文字認識の部品と通貨のアイコンは、この関数を呼んだとき（利用者が画像を選んだあと）に初めて読み込む。
 * 画像はブラウザの中だけで処理し、外へ送るのは通貨のアイコンの取得の要求だけ。
 */
import type { EventShopItem } from '../master-data/types'
import { recognizeWithBoxes } from '../possession-import/ocr-engine'
import {
  assignOwnedCounts,
  assignShopRows,
  type OwnedResult,
  type OwnedSource,
  type RemainingResult,
  type RowSource,
} from './assign'
import {
  matchIconInImage,
  OWNED_SEARCH,
  ownedIconRect,
  ROW_SEARCH,
  rowIconRect,
  type IconMatchResult,
  type RgbaImage,
  type SearchRange,
} from './icon-match'
import { canvasPixels, cropDataUrl, loadCurrencyIcons } from './icon-pixels'
import { parseShopRows, readOwnedCounts } from './rows'
import type { OwnedReading, Rect, ShopScreenRow } from './types'

export type AnalyzedImage = {
  rows: ShopScreenRow[]
  owned: OwnedReading[]
  canvas: HTMLCanvasElement
  /** 画像全体の画素（照合で使う。画像ごとに1回だけ読む） */
  pixels: RgbaImage
  width: number
  height: number
}

export type ShopImportAnalysis = {
  /**
   * rowCropUrl: 最初に読んだ行の帯（画像の横幅いっぱい）の切り抜き。
   * iconCropUrl: アイコンで照合した行の、切り出したアイコン（決めた通貨で一番近かった切り出し。決まらなければ一番近い通貨のもの）
   */
  remaining: (RemainingResult & { rowCropUrl?: string; iconCropUrl?: string })[]
  /** matchedCostItemId: 照合で一番近かった通貨（同じ画像で重なって「要確認」になった数も含む） */
  owned: (OwnedResult & { iconCropUrl?: string; matchedCostItemId?: number })[]
  /** アイコンを読み込めなかった通貨 */
  failedIcons: number[]
}

/** 行の切り抜きの上下に足す余白（行の帯の高さの割合） */
const ROW_CROP_PADDING = 0.25

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error(`画像を読み込めませんでした: ${file.name}`))
    }
    img.src = URL.createObjectURL(file)
  })

const analyzeImage = async (file: File): Promise<AnalyzedImage> => {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  // 画素を配列に読むので、読み出し向けの context にする
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error(`画像を描けませんでした: ${file.name}`)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(img.src)
  const boxes = await recognizeWithBoxes(canvas)
  return {
    rows: parseShopRows(boxes, canvas.height),
    owned: readOwnedCounts(boxes),
    canvas,
    pixels: canvasPixels(canvas),
    width: canvas.width,
    height: canvas.height,
  }
}

/** 交換所の通貨（対価の通貨ごとに1つ。アイコンの URL の無い通貨も含む） */
const shopCurrencies = (shop: readonly EventShopItem[]): { costItemId: number; url?: string }[] => {
  const byId = new Map<number, string | undefined>()
  for (const item of shop) {
    if (!byId.has(item.costItemId) || !byId.get(item.costItemId)) byId.set(item.costItemId, item.costIcon)
  }
  return [...byId].map(([costItemId, url]) => ({ costItemId, url }))
}

type IconMatch = IconMatchResult

/**
 * `base` のまわりのアイコンを `currencies` のアイコンと照合する。
 * 切り出す基準が無ければ切り出せなかったものとする。候補が1つなら照合しない。候補に読み込めなかった通貨があれば「要確認」。
 */
const matchIcon = (
  pixels: RgbaImage,
  base: Rect | null,
  range: SearchRange,
  currencies: readonly number[],
  icons: ReadonlyMap<number, Uint8ClampedArray>,
): IconMatch => {
  if (!base) return { decision: { kind: 'no-crop' } }
  const only = currencies.at(0)
  if (currencies.length === 1 && only !== undefined) {
    return { decision: { kind: 'matched', costItemId: only, best: 0, second: Infinity }, cropRect: base }
  }
  const refs = new Map<number, Uint8ClampedArray>()
  for (const id of currencies) {
    const ref = icons.get(id)
    if (!ref) return { decision: { kind: 'review' }, cropRect: base }
    refs.set(id, ref)
  }
  return matchIconInImage(pixels, base, range, refs)
}

const rowIconBase = (row: ShopScreenRow): Rect | null =>
  row.remainingBox ? rowIconRect(row.remainingBox, row.headingBox) : null

const rowCropRect = (image: AnalyzedImage, row: ShopScreenRow): Rect => {
  const padding = (row.band.bottom - row.band.top) * ROW_CROP_PADDING
  const top = Math.max(0, row.band.top - padding)
  const bottom = Math.min(image.height, row.band.bottom + padding)
  return { x: 0, y: top, width: image.width, height: Math.max(1, bottom - top) }
}

const rowKey = (s: RowSource) => `${s.imageIndex}:${s.rowIndex}`
const ownedKey = (s: OwnedSource) => `${s.imageIndex}:${s.index}`

const withRowCrops = (
  images: readonly AnalyzedImage[],
  results: readonly RemainingResult[],
  iconMatches: ReadonlyMap<string, IconMatch>,
): ShopImportAnalysis['remaining'] =>
  results.map((result) => {
    const first = result.sources.at(0)
    const image = first ? images.at(first.imageIndex) : undefined
    const row = first ? image?.rows.at(first.rowIndex) : undefined
    if (!first || !image || !row) return result
    const iconSource = result.sources.find((s) => iconMatches.get(rowKey(s))?.cropRect)
    const iconRect = iconSource ? iconMatches.get(rowKey(iconSource))?.cropRect : undefined
    const iconCanvas = iconSource ? images.at(iconSource.imageIndex)?.canvas : undefined
    return {
      ...result,
      rowCropUrl: cropDataUrl(image.canvas, rowCropRect(image, row)),
      ...(iconRect && iconCanvas ? { iconCropUrl: cropDataUrl(iconCanvas, iconRect) } : {}),
    }
  })

const withOwnedCrops = (
  images: readonly AnalyzedImage[],
  results: readonly OwnedResult[],
  ownedMatches: ReadonlyMap<string, IconMatch>,
): ShopImportAnalysis['owned'] =>
  results.map((result) => {
    const first = result.sources.at(0)
    const match = first ? ownedMatches.get(ownedKey(first)) : undefined
    const canvas = first ? images.at(first.imageIndex)?.canvas : undefined
    return {
      ...result,
      ...(match?.cropRect && canvas ? { iconCropUrl: cropDataUrl(canvas, match.cropRect) } : {}),
      ...(match?.decision.kind === 'matched' ? { matchedCostItemId: match.decision.costItemId } : {}),
    }
  })

/**
 * 選んだ画像を1枚ずつ読み取り（1枚ごとに onProgress を呼ぶ）、行を品目に、欄の数を通貨に当てはめる。
 * 通貨のアイコンはこの関数を呼んだときに読み込みを始める。
 */
export const analyzeShopScreenshots = async (
  files: File[],
  shop: readonly EventShopItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<ShopImportAnalysis> => {
  const currencies = shopCurrencies(shop)
  const withUrl = currencies.flatMap(({ costItemId, url }) => (url ? [{ costItemId, url }] : []))
  const iconsPromise = loadCurrencyIcons(withUrl)
  const images: AnalyzedImage[] = []
  for (const file of files) {
    images.push(await analyzeImage(file))
    onProgress?.(images.length, files.length)
  }
  const { icons } = await iconsPromise
  // URL の無い通貨も読み込めなかった通貨に入れる
  const failedIcons = currencies.filter(({ costItemId }) => !icons.has(costItemId)).map((c) => c.costItemId)

  const iconMatches = new Map<string, IconMatch>()
  const remaining = assignShopRows(
    images.map((image) => image.rows),
    shop,
    (source, candidates) => {
      const image = images.at(source.imageIndex)
      const row = image?.rows.at(source.rowIndex)
      if (!image || !row) return { kind: 'no-crop' }
      const match = matchIcon(image.pixels, rowIconBase(row), ROW_SEARCH, candidates, icons)
      iconMatches.set(rowKey(source), match)
      return match.decision
    },
  )

  const allCurrencies = currencies.map((c) => c.costItemId)
  const ownedMatches = new Map<string, IconMatch>()
  const owned = assignOwnedCounts(
    images.map((image) => image.owned),
    (source) => {
      const image = images.at(source.imageIndex)
      const reading = image?.owned.at(source.index)
      if (!image || !reading) return { kind: 'no-crop' }
      // 所持数はすべての通貨と比べるので、どれかのアイコンを読み込めなければ「要確認」
      const match: IconMatch =
        failedIcons.length > 0
          ? { decision: { kind: 'review' }, cropRect: ownedIconRect(reading.box, reading.headingHeight) }
          : matchIcon(image.pixels, ownedIconRect(reading.box, reading.headingHeight), OWNED_SEARCH, allCurrencies, icons)
      ownedMatches.set(ownedKey(source), match)
      return match.decision
    },
  )

  return {
    remaining: withRowCrops(images, remaining, iconMatches),
    owned: withOwnedCrops(images, owned, ownedMatches),
    failedIcons,
  }
}

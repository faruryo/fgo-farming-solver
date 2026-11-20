/**
 * 「サーヴァント強化」と「サーヴァントスキル強化」（7列の表示）の選択画面のスクリーンショットを読み取るブラウザの部分。
 * 照合用の顔のアイコンは画像を選んだあとに1回だけ取得し、取得できなければ画像を1枚も読まない。
 * 画像は1枚ずつ読み、カードの切り抜きだけを残して、canvas と画素の配列は次の画像に進む前に手放す。
 * 画像はブラウザの中だけで処理し、外へ送るのは照合用のデータの取得の要求だけ。
 */
import { recognizeWithBoxes } from '../possession-import/ocr-engine'
import type { ServantLevels } from '../servant-levels'
import { canvasPixels } from '../shop-screenshot-import/icon-pixels'
import { BAND_SCALE, CARD_CROP_WIDTH } from './constants'
import { faceCandidates, matchFace, type ScreenCandidates } from './face-match'
import { cardBandRects, cardRect, clipRect, faceRect } from './grid'
import { headerRects, readOwnedCount, readSortKey, readSortOrder } from './header'
import { classifyCardPosition } from './positions'
import { locateRoster } from './row-search'
import { summarizeRoster } from './summarize'
import type {
  CardReading,
  FaceIconData,
  ImageReading,
  OcrBox,
  Rect,
  RosterImportResult,
  RosterProgress,
  StoredSkills,
} from './types'
import { readCardValues } from './values'

/** 読み取りの候補にするサーヴァント（育成計算機の一覧にいるもの） */
export type RosterServant = { id: number; rarity: number }

export type AnalyzeRosterOptions = {
  servants: readonly RosterServant[]
  /** 前に取り込んだ Lv・宝具Lv の保存値（読んだもの） */
  stored: ServantLevels
  /** 育成計算機のスキルの今の値（これより低く読んだスキルは「要確認」にする） */
  storedSkills: StoredSkills
  onProgress?: (progress: RosterProgress) => void
}

const FACE_ICONS_URL = '/api/servant-face-icons'

/** 照合用のデータ。取得できないか形が違えば null */
const fetchFaceIcons = async (): Promise<FaceIconData | null> => {
  try {
    const res = await fetch(FACE_ICONS_URL)
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null || !('icons' in data) || !Array.isArray(data.icons)) return null
    return data as FaceIconData
  } catch {
    return null
  }
}

const loadImage = (file: File): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      resolve(null)
    }
    img.src = URL.createObjectURL(file)
  })

const releaseCanvas = (canvas: HTMLCanvasElement) => {
  canvas.width = 0
  canvas.height = 0
}

/** 画像の矩形を `scale` 倍に拡大して文字認識にかける（画像の外は除く。矩形が画像と重ならなければ空） */
const recognizeRect = async (source: HTMLCanvasElement, rect: Rect, scale: number): Promise<OcrBox[]> => {
  const clipped = clipRect(rect, source.width, source.height)
  if (!clipped) return []
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(clipped.width * scale))
  canvas.height = Math.max(1, Math.round(clipped.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  ctx.drawImage(source, clipped.x, clipped.y, clipped.width, clipped.height, 0, 0, canvas.width, canvas.height)
  try {
    return await recognizeWithBoxes(canvas)
  } finally {
    releaseCanvas(canvas)
  }
}

/** 確かめの画面に出すカードの切り抜き（幅を CARD_CROP_WIDTH に縮める） */
const cardCropUrl = (source: HTMLCanvasElement, rect: Rect): string | null => {
  const clipped = clipRect(rect, source.width, source.height)
  if (!clipped) return null
  const canvas = document.createElement('canvas')
  canvas.width = CARD_CROP_WIDTH
  canvas.height = Math.max(1, Math.round((clipped.height * CARD_CROP_WIDTH) / clipped.width))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, clipped.x, clipped.y, clipped.width, clipped.height, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/jpeg')
  releaseCanvas(canvas)
  return url
}

/**
 * 1枚の画像を読む。見出しが無いか段が1つも見つからない画像（画像として読めないファイルを含む）は null、
 * スキル強化の画面の5列の表示は 'five-column'
 */
const readImage = async (
  file: File,
  imageIndex: number,
  screens: ScreenCandidates,
): Promise<ImageReading | 'five-column' | null> => {
  const img = await loadImage(file)
  if (!img) return null
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  // 画素を配列に読むので、読み出し向けの context にする
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    URL.revokeObjectURL(img.src)
    return null
  }
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(img.src)
  try {
    const boxes = await recognizeWithBoxes(canvas)
    // 画素の配列は画像ごとに1回だけ読み、この画像を読み終えたら手放す
    const pixels = canvasPixels(canvas)
    const located = locateRoster(boxes, pixels, screens)
    if (located.kind === 'five-column') return 'five-column'
    if (located.kind === 'unreadable') return null
    const { grid, rowTops } = located
    const candidates = screens[grid.screen]
    const rows: CardReading[][] = []
    for (const [row, top] of rowTops.entries()) {
      const cards: CardReading[] = []
      for (const [column, x] of grid.columnXs.entries()) {
        const square = faceRect(grid, x, top)
        const face = matchFace(pixels, square, candidates)
        const bands = cardBandRects(square, grid.unit, grid.screen)
        const values = readCardValues(
          await recognizeRect(canvas, bands.top, BAND_SCALE),
          await recognizeRect(canvas, bands.bottom, BAND_SCALE),
          grid.screen,
        )
        if (classifyCardPosition(face, values) === 'discard') continue
        cards.push({ imageIndex, screen: grid.screen, row, column, face, values, crop: cardCropUrl(canvas, cardRect(square, grid.unit)) })
      }
      rows.push(cards)
    }
    const header = headerRects(grid.heading)
    return {
      imageIndex,
      name: file.name,
      screen: grid.screen,
      ownedCount: readOwnedCount(await recognizeRect(canvas, header.owned, 1)),
      sortKey: readSortKey(await recognizeRect(canvas, header.sortKey, 1)),
      sortOrder: readSortOrder(await recognizeRect(canvas, header.sortOrder, 1)),
      rows,
    }
  } finally {
    releaseCanvas(canvas)
  }
}

/**
 * 選んだ画像を1枚ずつ読み取り、サーヴァントごとの行にまとめる。
 * 進み具合は、照合用のデータの取得の前に `icons`、各画像を読み始める前に `image`（current は 1 始まり）で知らせる。
 */
export const analyzeRosterScreenshots = async (
  files: readonly File[],
  options: AnalyzeRosterOptions,
): Promise<RosterImportResult> => {
  const { servants, stored, storedSkills, onProgress } = options
  onProgress?.({ phase: 'icons' })
  const data = await fetchFaceIcons()
  const ids = new Set(servants.map((s) => s.id))
  const screens: ScreenCandidates = data
    ? { enhance: faceCandidates(data, ids), skill: faceCandidates(data, ids, 'skill') }
    : { enhance: [], skill: [] }
  if (screens.enhance.length === 0) return { kind: 'icons-unavailable' }

  const images: ImageReading[] = []
  const unreadableImages: string[] = []
  const fiveColumnImages: string[] = []
  for (const [index, file] of files.entries()) {
    onProgress?.({ phase: 'image', current: index + 1, total: files.length })
    const reading = await readImage(file, index, screens)
    if (reading === 'five-column') fiveColumnImages.push(file.name)
    else if (reading) images.push(reading)
    else unreadableImages.push(file.name)
  }

  const rarities = new Map(servants.map((s) => [s.id, s.rarity]))
  const { rows, unsortedImageCount, shortfall } = summarizeRoster(images, {
    rarityOf: (id: number) => rarities.get(id),
    stored,
    storedSkills,
  })
  return { kind: 'done', imageCount: files.length, unreadableImages, fiveColumnImages, unsortedImageCount, shortfall, rows }
}

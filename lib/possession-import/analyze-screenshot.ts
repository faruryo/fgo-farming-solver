import { detectCardRegions } from './detect-cards'
import { recognizeCard } from './ocr-engine'
import { guessItemNameLine, guessQuantityLine } from './parse-quantity'
import {
  findBestNameMatch,
  MatchTarget,
  MIN_ACCEPTABLE_NAME_SCORE,
} from './fuzzy-match'
import { CardCandidate } from './types'

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`画像を読み込めませんでした: ${file.name}`))
    img.src = URL.createObjectURL(file)
  })

const cropCanvas = (
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height)
  return canvas
}

/** 1枚のスクリーンショットを解析し、カードごとの候補を返す */
export const analyzeScreenshot = async (
  file: File,
  sourceImageIndex: number,
  matchTargets: MatchTarget[]
): Promise<CardCandidate[]> => {
  const img = await loadImage(file)
  const fullCanvas = document.createElement('canvas')
  fullCanvas.width = img.naturalWidth
  fullCanvas.height = img.naturalHeight
  const fullCtx = fullCanvas.getContext('2d')!
  fullCtx.drawImage(img, 0, 0)
  URL.revokeObjectURL(img.src)

  const imageData = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height)
  const regions = detectCardRegions(imageData)

  const candidates: CardCandidate[] = []
  for (const region of regions) {
    const cardCanvas = cropCanvas(fullCanvas, region.x, region.y, region.width, region.height)
    const lines = await recognizeCard(cardCanvas)
    const texts = lines.map((l) => l.text)

    const nameLine = guessItemNameLine(texts)
    const quantity = guessQuantityLine(texts)
    const match = nameLine ? findBestNameMatch(nameLine, matchTargets) : null
    const accepted = match && match.score >= MIN_ACCEPTABLE_NAME_SCORE ? match : null

    candidates.push({
      sourceImageIndex,
      region,
      ocrLines: lines,
      atlasId: accepted?.atlasId ?? null,
      matchedName: accepted?.name ?? null,
      matchScore: accepted?.score ?? 0,
      quantity,
      clipped: region.clipped,
      cropDataUrl: cardCanvas.toDataURL('image/png'),
    })
  }
  return candidates
}

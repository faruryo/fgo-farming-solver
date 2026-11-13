/**
 * canvas に通貨のアイコンとスクリーンショットを描いて画素の配列を取るブラウザの部分。
 * 縮め方・切り出し・比べは icon-match.ts の純粋関数に任せ、ここでは画像ごとに1回だけ画素を読む。
 */
import { downscaleIcon, type RgbaImage } from './icon-match'
import type { Rect } from './types'

const loadIconImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    // Atlas の画像は access-control-allow-origin: * を返すので、canvas の画素を読める
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`アイコンを読み込めませんでした: ${url}`))
    img.src = url
  })

const iconPixels = (img: HTMLImageElement): Uint8ClampedArray => {
  const width = img.naturalWidth
  const height = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx || width === 0 || height === 0) throw new Error('アイコンを描けませんでした')
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)
  return downscaleIcon({ data, width, height })
}

/** 通貨のアイコンを読み込み、16×16 の画素の配列にする。読み込めなかった通貨は failed に入れる */
export const loadCurrencyIcons = async (
  currencies: { costItemId: number; url: string }[],
): Promise<{ icons: Map<number, Uint8ClampedArray>; failed: number[] }> => {
  const icons = new Map<number, Uint8ClampedArray>()
  const failed: number[] = []
  const results = await Promise.allSettled(
    currencies.map(async ({ costItemId, url }) => ({ costItemId, pixels: iconPixels(await loadIconImage(url)) })),
  )
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') icons.set(result.value.costItemId, result.value.pixels)
    else {
      const currency = currencies.at(i)
      if (currency) failed.push(currency.costItemId)
    }
  })
  return { icons, failed }
}

/** 画像全体の画素の配列（画像ごとに1回だけ読む） */
export const canvasPixels = (source: HTMLCanvasElement): RgbaImage => {
  const ctx = source.getContext('2d')
  if (!ctx || source.width === 0 || source.height === 0) {
    return { data: new Uint8ClampedArray(0), width: 0, height: 0 }
  }
  const { data } = ctx.getImageData(0, 0, source.width, source.height)
  return { data, width: source.width, height: source.height }
}

/** 画像の矩形の切り抜き（確かめの画面の表示用） */
export const cropDataUrl = (source: HTMLCanvasElement, rect: Rect): string => {
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

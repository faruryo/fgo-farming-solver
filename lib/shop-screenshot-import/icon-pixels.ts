/**
 * canvas に通貨のアイコンとスクリーンショットを描いて、比べる 16×16 の画素の配列を取るブラウザの部分。
 * 縮め方は icon-match.ts の resampleRect にそろえ、アイコンと切り出しを同じ方法で縮める。
 */
import { ICON_MATCH, resampleRect } from './icon-match'
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
  return resampleRect({ data, width, height }, { x: 0, y: 0, width, height }, ICON_MATCH.size)
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

/** 矩形を画像の中に収めた整数の範囲 */
const clampBounds = (source: HTMLCanvasElement, rects: readonly Rect[]) => {
  const left = Math.max(0, Math.floor(Math.min(...rects.map((r) => r.x))))
  const top = Math.max(0, Math.floor(Math.min(...rects.map((r) => r.y))))
  const right = Math.min(source.width, Math.ceil(Math.max(...rects.map((r) => r.x + r.width))))
  const bottom = Math.min(source.height, Math.ceil(Math.max(...rects.map((r) => r.y + r.height))))
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

/** 画像の矩形ごとに 16×16 に縮めた画素の配列（画像の外は透明） */
export const samplePixels = (source: HTMLCanvasElement, rects: Rect[]): Uint8ClampedArray[] => {
  const ctx = source.getContext('2d')
  const bounds = clampBounds(source, rects)
  if (!ctx || rects.length === 0 || bounds.width === 0 || bounds.height === 0) {
    return rects.map(() => new Uint8ClampedArray(ICON_MATCH.size * ICON_MATCH.size * 4))
  }
  const { data } = ctx.getImageData(bounds.left, bounds.top, bounds.width, bounds.height)
  const image = { data, width: bounds.width, height: bounds.height, originX: bounds.left, originY: bounds.top }
  return rects.map((rect) => resampleRect(image, rect, ICON_MATCH.size))
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

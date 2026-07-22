import { describe, it, expect } from 'vitest'
import { detectCardRegions } from './detect-cards'

const BG: [number, number, number] = [50, 50, 200] // page background: blue-ish, not "cardish"
const CARD: [number, number, number] = [220, 220, 220] // card background: light, "cardish"

/**
 * Builds a synthetic screenshot: a `rows` x `cols` grid of card-colored
 * rectangles separated by background gaps, matching the layout
 * detectCardRegions is designed to find (design.md Decision 4).
 */
const buildGridImage = ({
  rows,
  cols,
  cardSize = 60,
  gapSize = 40,
  topGap = 20,
  leftGap = 20,
}: {
  rows: number
  cols: number
  cardSize?: number
  gapSize?: number
  topGap?: number
  leftGap?: number
}): ImageData => {
  const width = leftGap + cols * (cardSize + gapSize)
  const height = topGap + rows * (cardSize + gapSize)
  const data = new Uint8ClampedArray(width * height * 4)

  const setPixel = (x: number, y: number, [r, g, b]: [number, number, number]) => {
    const idx = (y * width + x) * 4
    data[idx] = r
    data[idx + 1] = g
    data[idx + 2] = b
    data[idx + 3] = 255
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) setPixel(x, y, BG)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const y0 = topGap + row * (cardSize + gapSize)
      const x0 = leftGap + col * (cardSize + gapSize)
      for (let y = y0; y < y0 + cardSize; y++) {
        for (let x = x0; x < x0 + cardSize; x++) setPixel(x, y, CARD)
      }
    }
  }

  return { data, width, height, colorSpace: 'srgb' } as ImageData
}

describe('detectCardRegions', () => {
  it('finds every card in a 2x2 grid with margins on all sides', () => {
    const image = buildGridImage({ rows: 2, cols: 2 })
    const regions = detectCardRegions(image)
    expect(regions).toHaveLength(4)
    for (const region of regions) {
      expect(region.clipped).toBe(false)
      expect(region.width).toBeGreaterThan(40)
      expect(region.height).toBeGreaterThan(40)
    }
  })

  it('does not split a single card in two because of a narrow dark icon inside it', () => {
    // Real screenshots showed a ~9px low-density dip inside a card (caused by a
    // dark item icon), which must not be mistaken for the gap between two cards.
    const image = buildGridImage({ rows: 1, cols: 1, cardSize: 200, gapSize: 40 })
    const { data, width } = image
    const dipX0 = 20 + 90
    const dipX1 = 20 + 99 // 9px-wide dip, narrower than the merge tolerance
    for (let y = 20; y < 20 + 200; y++) {
      for (let x = dipX0; x < dipX1; x++) {
        const idx = (y * width + x) * 4
        data[idx] = 30
        data[idx + 1] = 30
        data[idx + 2] = 30
      }
    }
    const regions = detectCardRegions(image)
    expect(regions).toHaveLength(1)
    expect(regions[0].width).toBeGreaterThan(150)
  })

  it('flags a bottom row as clipped when it is markedly shorter than the other rows, even without touching the last pixel', () => {
    // Real screenshots can end with a few pixels of margin below a truncated
    // row, so the band never literally touches height-1.
    const rows = 3
    const cardSize = 60
    const gapSize = 40
    const topGap = 20
    const truncatedHeight = 45 // shorter than a full 60px card row, but still above the noise-size floor
    const bottomMargin = 5
    const width = 20 + cardSize + 20
    const height = topGap + rows * cardSize + (rows - 1) * gapSize + truncatedHeight - cardSize + bottomMargin
    const data = new Uint8ClampedArray(width * height * 4)
    const setPixel = (x: number, y: number, [r, g, b]: [number, number, number]) => {
      const idx = (y * width + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) setPixel(x, y, BG)
    for (let row = 0; row < rows; row++) {
      const y0 = topGap + row * (cardSize + gapSize)
      const rowHeight = row === rows - 1 ? truncatedHeight : cardSize
      for (let y = y0; y < y0 + rowHeight; y++) {
        for (let x = 20; x < 20 + cardSize; x++) setPixel(x, y, CARD)
      }
    }
    const image = { data, width, height, colorSpace: 'srgb' } as ImageData

    const regions = detectCardRegions(image)
    const sorted = [...regions].sort((a, b) => a.y - b.y)
    expect(sorted).toHaveLength(3)
    expect(sorted[0].clipped).toBe(false)
    expect(sorted[2].clipped).toBe(true)
    expect(sorted[2].y + sorted[2].height).toBeLessThan(height) // does not literally touch the edge
  })

  it('flags cards that touch the top edge as clipped (scroll boundary)', () => {
    const image = buildGridImage({ rows: 2, cols: 1, topGap: 0 })
    const regions = detectCardRegions(image)
    expect(regions).toHaveLength(2)
    const sorted = [...regions].sort((a, b) => a.y - b.y)
    expect(sorted[0].clipped).toBe(true) // touches y=0
    expect(sorted[1].clipped).toBe(false)
  })

  it('flags cards that touch the bottom edge as clipped', () => {
    // No gap after the last row so the final card band runs to the image bottom.
    const rows = 2
    const cardSize = 60
    const gapSize = 40
    const topGap = 20
    const height = topGap + rows * cardSize + (rows - 1) * gapSize
    const width = 20 + cardSize + 20
    const data = new Uint8ClampedArray(width * height * 4)
    const setPixel = (x: number, y: number, [r, g, b]: [number, number, number]) => {
      const idx = (y * width + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) setPixel(x, y, BG)
    for (let row = 0; row < rows; row++) {
      const y0 = topGap + row * (cardSize + gapSize)
      for (let y = y0; y < Math.min(y0 + cardSize, height); y++) {
        for (let x = 20; x < 20 + cardSize; x++) setPixel(x, y, CARD)
      }
    }
    const image = { data, width, height, colorSpace: 'srgb' } as ImageData

    const regions = detectCardRegions(image)
    const sorted = [...regions].sort((a, b) => a.y - b.y)
    expect(sorted[sorted.length - 1].clipped).toBe(true)
  })

  it('returns no regions for a screenshot with no card-like content', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = BG[0]
      data[i + 1] = BG[1]
      data[i + 2] = BG[2]
      data[i + 3] = 255
    }
    const image = { data, width, height, colorSpace: 'srgb' } as ImageData
    expect(detectCardRegions(image)).toHaveLength(0)
  })
})

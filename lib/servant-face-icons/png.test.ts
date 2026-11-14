import { describe, expect, it } from 'vitest'
import { decodeFaceIconPng } from './png'
import { makePng, patternPixels } from './png-fixture'

describe('decodeFaceIconPng', () => {
  it('reads a 128x128 RGBA PNG whose rows use all five filter types', () => {
    const pixels = patternPixels(128, 128)
    const result = decodeFaceIconPng(makePng({ pixels, filters: [0, 1, 2, 3, 4] }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.image.width).toBe(128)
    expect(result.image.height).toBe(128)
    expect(Array.from(result.image.data)).toEqual(Array.from(pixels))
  })

  it.each([1, 2, 3, 4])('undoes filter type %i on its own', filter => {
    const pixels = patternPixels(128, 128)
    const result = decodeFaceIconPng(makePng({ pixels, filters: [filter] }))

    expect(result.ok && Array.from(result.image.data)).toEqual(Array.from(pixels))
  })

  it.each([
    ['a different size', { width: 64, height: 64 }],
    ['RGB without alpha', { colorType: 2 }],
    ['16-bit RGBA', { bitDepth: 16 }],
    ['an interlaced image', { interlace: 1 }],
  ])('returns could-not-read for %s', (_, options) => {
    expect(decodeFaceIconPng(makePng(options)).ok).toBe(false)
  })

  it('returns could-not-read for an unknown filter type', () => {
    expect(decodeFaceIconPng(makePng({ filters: [0, 5] })).ok).toBe(false)
  })

  it('returns could-not-read for bytes that are not a PNG or are cut short', () => {
    const png = makePng()

    expect(decodeFaceIconPng(new Uint8Array(0)).ok).toBe(false)
    expect(decodeFaceIconPng(new TextEncoder().encode('<html>404</html>')).ok).toBe(false)
    expect(decodeFaceIconPng(png.subarray(0, png.length - 20)).ok).toBe(false)
  })
})

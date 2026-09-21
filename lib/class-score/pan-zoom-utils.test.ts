import { describe, it, expect } from 'vitest'
import {
  clampZoom,
  computeBoardBounds,
  computeViewBox,
  computePanDelta,
  computeTouchDistance,
  getDisplayPosY,
} from './pan-zoom-utils'

describe('pan-zoom-utils', () => {
  const defaultBounds = {
    minX: 0,
    minY: 0,
    width: 1000,
    height: 800,
  }

  describe('getDisplayPosY', () => {
    it('inverts the Cartesian Y coordinate for SVG display', () => {
      expect(getDisplayPosY(100)).toBe(-100)
      expect(getDisplayPosY(-250)).toBe(250)
      expect(getDisplayPosY(0)).toBe(-0)
    })
  })

  describe('computeBoardBounds', () => {
    it('computes bounding box with padding and inverted Y', () => {
      const squares = [
        { posX: -100, posY: -200 }, // displayY = 200
        { posX: 300, posY: 400 }, // displayY = -400
      ]
      const bounds = computeBoardBounds(squares, 50)
      expect(bounds.minX).toBe(-150)
      expect(bounds.minY).toBe(-450)
      expect(bounds.width).toBe(500)
      expect(bounds.height).toBe(700)
    })

    it('returns default bounds for empty array', () => {
      const bounds = computeBoardBounds([])
      expect(bounds.width).toBe(1000)
    })
  })

  describe('clampZoom', () => {
    it('clamps zoom within bounds', () => {
      expect(clampZoom(0.2, 0.5, 3.0)).toBe(0.5)
      expect(clampZoom(4.0, 0.5, 3.0)).toBe(3.0)
      expect(clampZoom(1.5, 0.5, 3.0)).toBe(1.5)
    })
  })

  describe('computeViewBox', () => {
    it('returns original bounds when zoom=1 and pan=0', () => {
      const vb = computeViewBox(defaultBounds, 1.0, { x: 0, y: 0 })
      expect(vb).toBe('0 0 1000 800')
    })

    it('returns half dimensions centered when zoom=2', () => {
      const vb = computeViewBox(defaultBounds, 2.0, { x: 0, y: 0 })
      // Center is (500, 400). Half width is 500, half height is 400.
      // minX = 500 - 250 = 250, minY = 400 - 200 = 200
      expect(vb).toBe('250 200 500 400')
    })

    it('shifts correctly when pan offset is applied', () => {
      const vb = computeViewBox(defaultBounds, 1.0, { x: 100, y: -50 })
      expect(vb).toBe('-100 50 1000 800')
    })
  })

  describe('computePanDelta', () => {
    it('scales screen delta to viewBox coordinates', () => {
      const containerSize = { width: 500, height: 400 }
      const delta = computePanDelta(50, 20, containerSize, 1.0, defaultBounds)
      // viewBox is 1000x800, container is 500x400 -> scale is 2
      expect(delta.x).toBe(100)
      expect(delta.y).toBe(40)
    })

    it('applies uniform scale when container aspect ratio differs from bounds (meet behavior)', () => {
      // Bounds: 1000x800. Container: 1000x500.
      // Width ratio: 1000/1000 = 1. Height ratio: 800/500 = 1.6.
      // Meet mode fits by height (ratio 1.6), so 1 screen px = 1.6 viewBox units in both axes.
      const containerSize = { width: 1000, height: 500 }
      const delta = computePanDelta(10, 10, containerSize, 1.0, defaultBounds)
      expect(delta.x).toBe(16)
      expect(delta.y).toBe(16)
    })

    it('returns zero delta for invalid container size', () => {
      const delta = computePanDelta(50, 20, { width: 0, height: 0 }, 1.0, defaultBounds)
      expect(delta.x).toBe(0)
      expect(delta.y).toBe(0)
    })
  })

  describe('computeTouchDistance', () => {
    it('computes euclidean distance between two touches', () => {
      const t1 = { clientX: 0, clientY: 0 }
      const t2 = { clientX: 30, clientY: 40 }
      expect(computeTouchDistance(t1, t2)).toBe(50)
    })
  })
})

export type Bounds = {
  minX: number
  minY: number
  width: number
  height: number
}

export type Point = {
  x: number
  y: number
}

export const computeBoardBounds = (
  squares: { posX: number; posY: number }[],
  padding = 120,
): Bounds => {
  if (squares.length === 0) {
    return { minX: -500, minY: -500, width: 1000, height: 1000 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const sq of squares) {
    if (sq.posX < minX) minX = sq.posX
    if (sq.posX > maxX) maxX = sq.posX
    if (sq.posY < minY) minY = sq.posY
    if (sq.posY > maxY) maxY = sq.posY
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

export const clampZoom = (
  zoom: number,
  minZoom = 0.5,
  maxZoom = 3.0,
): number => {
  return Math.max(minZoom, Math.min(maxZoom, zoom))
}

export const computeViewBox = (
  baseBounds: Bounds,
  zoom: number,
  panOffset: Point,
): string => {
  const safeZoom = Math.max(0.01, zoom)
  const width = baseBounds.width / safeZoom
  const height = baseBounds.height / safeZoom

  // Zoom centered on the base bounds center + pan offset
  const centerX = baseBounds.minX + baseBounds.width / 2 + panOffset.x
  const centerY = baseBounds.minY + baseBounds.height / 2 + panOffset.y

  const minX = centerX - width / 2
  const minY = centerY - height / 2

  return `${Math.round(minX)} ${Math.round(minY)} ${Math.round(width)} ${Math.round(height)}`
}

export const computePanDelta = (
  screenDeltaX: number,
  screenDeltaY: number,
  containerSize: { width: number; height: number },
  currentZoom: number,
  baseBounds: Bounds,
): Point => {
  if (containerSize.width <= 0 || containerSize.height <= 0) {
    return { x: 0, y: 0 }
  }

  const safeZoom = Math.max(0.01, currentZoom)
  const currentVbWidth = baseBounds.width / safeZoom
  const currentVbHeight = baseBounds.height / safeZoom

  const scaleX = currentVbWidth / containerSize.width
  const scaleY = currentVbHeight / containerSize.height

  return {
    x: -screenDeltaX * scaleX,
    y: -screenDeltaY * scaleY,
  }
}

export const computeTouchDistance = (
  touch1: { clientX: number; clientY: number },
  touch2: { clientX: number; clientY: number },
): number => {
  const dx = touch1.clientX - touch2.clientX
  const dy = touch1.clientY - touch2.clientY
  return Math.hypot(dx, dy)
}

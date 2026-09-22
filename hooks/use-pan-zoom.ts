import { useCallback, useMemo, useRef, useState } from 'react'
import type { RefObject, Dispatch, SetStateAction, WheelEvent, MouseEvent, TouchEvent } from 'react'
import {
  Bounds,
  Point,
  clampZoom,
  computePanDelta,
  computeTouchDistance,
  computeViewBox,
} from '../lib/class-score/pan-zoom-utils'


type MousePanOptions = {
  isDraggingRef: RefObject<boolean>
  lastPosRef: RefObject<Point>
  containerRef: RefObject<SVGSVGElement | null>
  initialBounds: Bounds
  zoom: number
  setPan: Dispatch<SetStateAction<Point>>
}

type TouchPanOptions = {
  lastPosRef: RefObject<Point>
  touchDistRef: RefObject<number>
  containerRef: RefObject<SVGSVGElement | null>
  initialBounds: Bounds
  zoom: number
  setZoom: Dispatch<SetStateAction<number>>
  setPan: Dispatch<SetStateAction<Point>>
  minZoom: number
  maxZoom: number
}

const useMousePanHandlers = ({
  isDraggingRef,
  lastPosRef,
  containerRef,
  initialBounds,
  zoom,
  setPan,
}: MousePanOptions) => {
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return
      isDraggingRef.current = true
      lastPosRef.current = { x: e.clientX, y: e.clientY }
    },
    [isDraggingRef, lastPosRef],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dx = e.clientX - lastPosRef.current.x
      const dy = e.clientY - lastPosRef.current.y
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      const delta = computePanDelta(dx, dy, rect, zoom, initialBounds)
      setPan((prev) => ({ x: prev.x + delta.x, y: prev.y + delta.y }))
    },
    [isDraggingRef, lastPosRef, containerRef, initialBounds, zoom, setPan],
  )

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [isDraggingRef])

  return { handleMouseDown, handleMouseMove, handleMouseUp }
}

const useTouchPanHandlers = ({
  lastPosRef,
  touchDistRef,
  containerRef,
  initialBounds,
  zoom,
  setZoom,
  setPan,
  minZoom,
  maxZoom,
}: TouchPanOptions) => {
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0]
        lastPosRef.current = { x: t.clientX, y: t.clientY }
      } else if (e.touches.length === 2) {
        touchDistRef.current = computeTouchDistance(e.touches[0], e.touches[1])
      }
    },
    [lastPosRef, touchDistRef],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!containerRef.current) return
      if (e.touches.length === 1) {
        const t = e.touches[0]
        const rect = containerRef.current.getBoundingClientRect()
        const dx = t.clientX - lastPosRef.current.x
        const dy = t.clientY - lastPosRef.current.y
        lastPosRef.current = { x: t.clientX, y: t.clientY }
        const delta = computePanDelta(dx, dy, rect, zoom, initialBounds)
        setPan((prev) => ({ x: prev.x + delta.x, y: prev.y + delta.y }))
      } else if (e.touches.length === 2) {
        const dist = computeTouchDistance(e.touches[0], e.touches[1])
        if (touchDistRef.current > 0) {
          setZoom((prev) => clampZoom(prev * (dist / touchDistRef.current), minZoom, maxZoom))
        }
        touchDistRef.current = dist
      }
    },
    [containerRef, lastPosRef, touchDistRef, initialBounds, zoom, setPan, setZoom, minZoom, maxZoom],
  )

  return { handleTouchStart, handleTouchMove }
}

const useZoomControls = (
  minZoom: number,
  maxZoom: number,
  setZoom: Dispatch<SetStateAction<number>>,
  setPan: Dispatch<SetStateAction<Point>>,
) => {
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      setZoom((prev) => clampZoom(prev * factor, minZoom, maxZoom))
    },
    [minZoom, maxZoom, setZoom],
  )

  const zoomIn = useCallback(() => {
    setZoom((prev) => clampZoom(prev * 1.2, minZoom, maxZoom))
  }, [minZoom, maxZoom, setZoom])

  const zoomOut = useCallback(() => {
    setZoom((prev) => clampZoom(prev / 1.2, minZoom, maxZoom))
  }, [minZoom, maxZoom, setZoom])

  const reset = useCallback(() => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
  }, [setZoom, setPan])

  return { handleWheel, zoomIn, zoomOut, reset }
}

export type PanZoomOptions = {
  initialBounds: Bounds
  containerRef: RefObject<SVGSVGElement | null>
  minZoom?: number
  maxZoom?: number
}

export const usePanZoom = ({
  initialBounds,
  containerRef,
  minZoom = 0.5,
  maxZoom = 3.0,
}: PanZoomOptions) => {
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef<Point>({ x: 0, y: 0 })
  const touchDistRef = useRef(0)

  const mouseHandlers = useMousePanHandlers({
    isDraggingRef,
    lastPosRef,
    containerRef,
    initialBounds,
    zoom,
    setPan,
  })

  const touchHandlers = useTouchPanHandlers({
    lastPosRef,
    touchDistRef,
    containerRef,
    initialBounds,
    zoom,
    setZoom,
    setPan,
    minZoom,
    maxZoom,
  })

  const zoomControls = useZoomControls(minZoom, maxZoom, setZoom, setPan)

  const viewBox = useMemo(
    () => computeViewBox(initialBounds, zoom, pan),
    [initialBounds, zoom, pan],
  )

  return {
    viewBox,
    zoom,
    ...mouseHandlers,
    ...touchHandlers,
    ...zoomControls,
  }
}

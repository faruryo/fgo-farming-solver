'use client'

import React, { useMemo } from 'react'
import { Plus, Minus, RotateCcw, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  ClassBoardData,
  ClassBoardSquare,
  ClassBoardSquareStatus,
  ClassBoardSelectionState,
} from '../../lib/class-score/board-types'
import { usePanZoom } from '../../hooks/use-pan-zoom'
import { computeBoardBounds } from '../../lib/class-score/pan-zoom-utils'

export type BoardCanvasProps = {
  board: ClassBoardData
  selection: ClassBoardSelectionState
  onSelectSquare: (square: ClassBoardSquare) => void
}

const getSquareStatus = (
  squareId: number,
  selection: ClassBoardSelectionState,
): ClassBoardSquareStatus => {
  if (selection.unlockedSquareIds.includes(squareId)) return 'unlocked'
  if (selection.targetSquareIds.includes(squareId)) return 'target'
  return 'none'
}

const getLineColor = (
  prevStatus: ClassBoardSquareStatus,
  nextStatus: ClassBoardSquareStatus,
): { stroke: string; strokeWidth: number; opacity: number } => {
  if (prevStatus === 'unlocked' && nextStatus === 'unlocked') {
    return { stroke: '#38bdf8', strokeWidth: 3, opacity: 0.9 }
  }
  if (prevStatus === 'target' || nextStatus === 'target') {
    return { stroke: '#f59e0b', strokeWidth: 2.5, opacity: 0.8 }
  }
  return { stroke: '#334155', strokeWidth: 2, opacity: 0.4 }
}

const BoardCanvasLines: React.FC<{
  board: ClassBoardData
  selection: ClassBoardSelectionState
  squareMap: Map<number, ClassBoardSquare>
}> = ({ board, selection, squareMap }) => {
  return (
    <g className="lines-layer">
      {board.lines.map((line) => {
        const prevSq = squareMap.get(line.prev)
        const nextSq = squareMap.get(line.next)
        if (!prevSq || !nextSq) return null

        const prevStatus = getSquareStatus(line.prev, selection)
        const nextStatus = getSquareStatus(line.next, selection)
        const style = getLineColor(prevStatus, nextStatus)

        return (
          <line
            key={`line-${line.id}`}
            x1={prevSq.posX}
            y1={prevSq.posY}
            x2={nextSq.posX}
            y2={nextSq.posY}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

const getSquareStyles = (status: ClassBoardSquareStatus) => {
  if (status === 'unlocked') {
    return {
      fill: '#082f49',
      stroke: '#38bdf8',
      strokeWidth: 2.5,
      iconOpacity: 1.0,
      glow: true,
    }
  }
  if (status === 'target') {
    return {
      fill: '#451a03',
      stroke: '#f59e0b',
      strokeWidth: 2.5,
      iconOpacity: 1.0,
      glow: true,
    }
  }
  return {
    fill: '#0f172a',
    stroke: '#334155',
    strokeWidth: 1.5,
    iconOpacity: 0.45,
    glow: false,
  }
}

const BoardSquareNode: React.FC<{
  square: ClassBoardSquare
  status: ClassBoardSquareStatus
  onSelect: () => void
}> = ({ square, status, onSelect }) => {
  const styles = getSquareStyles(status)
  const size = 44
  const half = size / 2

  return (
    <g
      transform={`translate(${square.posX}, ${square.posY})`}
      onClick={onSelect}
      className="cursor-pointer transition-transform duration-150 hover:scale-110 select-none outline-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-label={`${square.name} (${status})`}
    >
      {square.isStart && (
        <circle r={half + 6} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
      )}
      <rect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx={8}
        fill={styles.fill}
        stroke={styles.stroke}
        strokeWidth={styles.strokeWidth}
      />
      {square.icon ? (
        <image
          href={square.icon}
          x={-16}
          y={-16}
          width={32}
          height={32}
          opacity={styles.iconOpacity}
        />
      ) : null}
      {square.isLock && status !== 'unlocked' && (
        <g transform="translate(10, 10)">
          <circle r={8} fill="#be123c" />
          <Lock className="w-3 h-3 text-white -translate-x-1.5 -translate-y-1.5" />
        </g>
      )}
    </g>
  )
}

const BoardCanvasControls: React.FC<{
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}> = ({ onZoomIn, onZoomOut, onReset }) => (
  <div className="absolute top-4 right-4 flex flex-col gap-1.5 bg-card/80 backdrop-blur-md p-1.5 rounded-lg border border-border/60 shadow-lg z-10">
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={onZoomIn}
      aria-label="Zoom in"
      className="h-8 w-8 cursor-pointer"
    >
      <Plus className="w-4 h-4" />
    </Button>
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={onZoomOut}
      aria-label="Zoom out"
      className="h-8 w-8 cursor-pointer"
    >
      <Minus className="w-4 h-4" />
    </Button>
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={onReset}
      aria-label="Reset view"
      className="h-8 w-8 cursor-pointer"
    >
      <RotateCcw className="w-4 h-4" />
    </Button>
  </div>
)

const BoardCanvasBackground: React.FC<{ bounds: { minX: number; minY: number; width: number; height: number } }> = ({ bounds }) => (
  <>
    <defs>
      <radialGradient id="space-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect
      x={bounds.minX}
      y={bounds.minY}
      width={bounds.width}
      height={bounds.height}
      fill="url(#space-glow)"
    />
  </>
)

export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  board,
  selection,
  onSelectSquare,
}) => {
  const bounds = useMemo(() => computeBoardBounds(board.squares), [board.squares])
  const squareMap = useMemo(
    () => new Map(board.squares.map((sq) => [sq.id, sq])),
    [board.squares],
  )
  const svgRef = React.useRef<SVGSVGElement | null>(null)

  const {
    viewBox,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleWheel,
    zoomIn,
    zoomOut,
    reset,
  } = usePanZoom({ initialBounds: bounds, containerRef: svgRef })

  return (
    <div className="relative w-full h-[600px] md:h-[750px] bg-[#070b14] rounded-xl overflow-hidden border border-border/40 select-none shadow-inner">
      <BoardCanvasControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} />

      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
      >
        <BoardCanvasBackground bounds={bounds} />
        <BoardCanvasLines board={board} selection={selection} squareMap={squareMap} />

        <g className="squares-layer">
          {board.squares.map((sq) => (
            <BoardSquareNode
              key={`sq-${sq.id}`}
              square={sq}
              status={getSquareStatus(sq.id, selection)}
              onSelect={() => onSelectSquare(sq)}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

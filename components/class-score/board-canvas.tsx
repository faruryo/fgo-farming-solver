'use client'

import React, { useMemo } from 'react'
import { Plus, Minus, RotateCcw, Lock, LockOpen } from 'lucide-react'
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

const getSquareStyles = (status: ClassBoardSquareStatus, isLock: boolean = false) => {
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
  if (isLock) {
    return {
      fill: '#2a0a14',
      stroke: '#9f1239',
      strokeWidth: 2,
      iconOpacity: 0.8,
      glow: false,
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

const SquareLockIcon: React.FC<{ status: ClassBoardSquareStatus }> = ({ status }) => {
  if (status === 'unlocked') {
    return <LockOpen x={-11} y={-11} width={22} height={22} className="text-sky-400" />
  }
  if (status === 'target') {
    return <Lock x={-11} y={-11} width={22} height={22} className="text-amber-400" />
  }
  return <Lock x={-11} y={-11} width={22} height={22} className="text-rose-400/90" />
}

const SquareNodeContent: React.FC<{
  square: ClassBoardSquare
  status: ClassBoardSquareStatus
  iconOpacity: number
}> = ({ square, status, iconOpacity }) => {
  if (square.isLock) {
    return (
      <g className="transition-all duration-150 group-hover:brightness-125">
        <SquareLockIcon status={status} />
      </g>
    )
  }

  if (square.icon) {
    return (
      <image
        href={square.icon}
        x={-16}
        y={-16}
        width={32}
        height={32}
        opacity={iconOpacity}
        className="transition-all duration-150 group-hover:opacity-100 group-hover:brightness-110"
      />
    )
  }

  return null
}

const BoardSquareNode: React.FC<{
  square: ClassBoardSquare
  status: ClassBoardSquareStatus
  onSelect: () => void
}> = ({ square, status, onSelect }) => {
  const styles = getSquareStyles(status, square.isLock)
  const size = 44
  const half = size / 2

  return (
    <g
      transform={`translate(${square.posX}, ${square.posY})`}
      onClick={onSelect}
      className="group cursor-pointer select-none outline-none"
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
        <circle
          r={half + 6}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="4 2"
          className="transition-all duration-150 group-hover:stroke-amber-300 group-hover:stroke-[2.5]"
        />
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
        className="transition-all duration-150 group-hover:stroke-[3px] group-hover:brightness-130 group-focus-visible:stroke-[3px] group-hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]"
      />
      <SquareNodeContent
        square={square}
        status={status}
        iconOpacity={styles.iconOpacity}
      />
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

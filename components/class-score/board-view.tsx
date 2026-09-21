'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Lock, RotateCcw, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type {
  ClassBoardData,
  ClassBoardSquare,
  ClassBoardSquareStatus,
} from '../../lib/class-score/board-types'
import { useClassScore } from '../../hooks/use-class-score'
import { calculateBoardDiffMaterials } from '../../lib/class-score/calculate-board-diff'
import { getClassIconUrl } from '../../lib/get-class-icon-url'
import { ClassName } from '../../interfaces/atlas-academy'
import { BoardCanvas } from './board-canvas'
import { SquareDialog } from './square-dialog'

const CLASS_TO_ICON_CLASS: Record<string, ClassName> = {
  saber: 'saber',
  archer: 'archer',
  lancer: 'lancer',
  rider: 'rider',
  caster: 'caster',
  assassin: 'assassin',
  berserker: 'berserker',
  extra1: 'ruler',
  extra2: 'alterEgo',
}

const BoardViewHeader: React.FC<{
  board: ClassBoardData
  onReset: () => void
  onSetAllTarget: () => void
}> = ({ board, onReset, onSetAllTarget }) => {
  const { t } = useTranslation('classScore')
  const iconClass =
    (Reflect.get(CLASS_TO_ICON_CLASS, board.key) as ClassName | undefined) ?? 'saber'
  const iconUrl = getClassIconUrl(iconClass, 5)

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
      <div className="flex items-center gap-3">
        <Link
          href="/material/class-score"
          className="inline-flex items-center justify-center p-2 rounded-lg border border-border/60 bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('board.back', '一覧に戻る')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        {iconUrl && (
          <Image
            src={iconUrl}
            alt={board.name}
            width={36}
            height={36}
            className="object-contain"
          />
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {t(`class-name.${board.key}`, board.name)}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              {t('board.title-suffix', 'クラススコア盤面')}
            </span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSetAllTarget}
          className="text-xs h-8 cursor-pointer"
        >
          <Target className="w-3.5 h-3.5 mr-1" />
          {t('board.action.all-target', '全マス目標')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onReset}
          className="text-xs h-8 text-muted-foreground hover:text-destructive cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          {t('board.action.reset', '盤面リセット')}
        </Button>
      </div>
    </div>
  )
}

const BoardViewSummary: React.FC<{
  activeTargetCount: number
  unlockedCount: number
  totalSquares: number
  qp: number
  sand: number
  torches: { id: string; name: string; amount: number }[]
}> = ({ activeTargetCount, unlockedCount, totalSquares, qp, sand, torches }) => {
  const { t } = useTranslation('classScore')
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-card/60 backdrop-blur-sm rounded-xl border border-border/60 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{t('board.summary.progress', '進捗')}:</span>
        <Badge variant="outline" className="font-mono">
          {unlockedCount} / {totalSquares} {t('board.summary.unlocked-unit', '解放')}
        </Badge>
        <Badge variant="default" className="font-mono bg-amber-600 hover:bg-amber-600">
          +{activeTargetCount} {t('board.summary.target-unit', '目標')}
        </Badge>
      </div>

      <div className="h-4 w-px bg-border/60 hidden sm:block" />

      <div className="flex items-center gap-3 font-mono">
        <div>
          <span className="text-muted-foreground mr-1">{t('summary.qp', '必要QP')}:</span>
          <span className="font-bold text-foreground">
            {qp > 0 ? `${(qp / 100000000).toFixed(2)}億` : '0'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground mr-1">{t('summary.sand', '星光の砂')}:</span>
          <span className="font-bold text-foreground">{sand.toLocaleString()}</span>
        </div>
        {torches.length > 0 && (
          <div>
            <span className="text-muted-foreground mr-1">{t('summary.torches', 'トーチ')}:</span>
            <span className="font-bold text-foreground">
              {torches.reduce((acc, it) => acc + it.amount, 0)}個
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const BoardViewLegend: React.FC = () => {
  const { t } = useTranslation('classScore')
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-slate-900 border border-slate-700 inline-block" />
        <span>{t('board.legend.none', '未解放')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-amber-950 border border-amber-500 inline-block" />
        <span>{t('board.legend.target', '目標マス')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-cyan-950 border border-sky-400 inline-block" />
        <span>{t('board.legend.unlocked', '解放済')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Lock className="w-3 h-3 text-rose-500" />
        <span>{t('board.legend.lock', 'ツアーロック')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-amber-400" />
        <span>{t('board.legend.start', '起点')}</span>
      </div>
    </div>
  )
}

const useBoardViewSelection = (board: ClassBoardData) => {
  const {
    state,
    setSquareStatus,
    setSquareRouteTarget,
    setSquareRouteUnlocked,
    resetBoardDetail,
    setClassStatus,
  } = useClassScore()
  const boardDetail = state.boards ? Reflect.get(state.boards, board.key) : undefined
  const playableSquares = useMemo(
    () => board.squares.filter((sq) => !sq.flags.includes('blank')),
    [board.squares],
  )
  const selection = useMemo(
    () => ({
      unlockedSquareIds: boardDetail?.unlockedSquareIds ?? [],
      targetSquareIds: boardDetail?.targetSquareIds ?? [],
    }),
    [boardDetail],
  )

  const diff = useMemo(
    () =>
      calculateBoardDiffMaterials(
        board,
        selection.targetSquareIds,
        selection.unlockedSquareIds,
      ),
    [board, selection],
  )

  const handleSetAllTarget = () => {
    setClassStatus(board.key, 'target')
  }

  const unlockedCount = useMemo(
    () => playableSquares.filter((sq) => selection.unlockedSquareIds.includes(sq.id)).length,
    [playableSquares, selection.unlockedSquareIds],
  )

  return {
    selection,
    diff,
    playableSquares,
    unlockedCount,
    handleSetAllTarget,
    setSquareStatus,
    setSquareRouteTarget,
    setSquareRouteUnlocked,
    resetBoardDetail,
  }
}

export const BoardView: React.FC<{ board: ClassBoardData }> = ({ board }) => {
  const [selectedSquare, setSelectedSquare] = useState<ClassBoardSquare | null>(null)
  const {
    selection,
    diff,
    playableSquares,
    unlockedCount,
    handleSetAllTarget,
    setSquareStatus,
    setSquareRouteTarget,
    setSquareRouteUnlocked,
    resetBoardDetail,
  } = useBoardViewSelection(board)

  const selectedSquareStatus: ClassBoardSquareStatus = useMemo(() => {
    if (!selectedSquare) return 'none'
    if (selection.unlockedSquareIds.includes(selectedSquare.id)) return 'unlocked'
    if (selection.targetSquareIds.includes(selectedSquare.id)) return 'target'
    return 'none'
  }, [selectedSquare, selection])

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4">
        <BoardViewHeader
        board={board}
        onReset={() => resetBoardDetail(board.key)}
        onSetAllTarget={handleSetAllTarget}
      />
      <BoardViewSummary
        activeTargetCount={diff.activeTargetCount}
        unlockedCount={unlockedCount}
        totalSquares={playableSquares.length}
        qp={diff.qp}
        sand={diff.sand}
        torches={diff.torches}
      />
      <BoardCanvas
        board={board}
        selection={selection}
        onSelectSquare={(sq) => setSelectedSquare(sq)}
      />
      <BoardViewLegend />
      <SquareDialog
        square={selectedSquare}
        status={selectedSquareStatus}
        isOpen={selectedSquare !== null}
        onClose={() => setSelectedSquare(null)}
        onSetStatus={(status) => {
          if (selectedSquare) {
            setSquareStatus(board.key, selectedSquare.id, status)
          }
        }}
        onSetRouteTarget={(sqId) => setSquareRouteTarget(board.key, sqId)}
        onSetRouteUnlocked={(sqId) => setSquareRouteUnlocked(board.key, sqId)}
      />
      </div>
    </div>
  )
}

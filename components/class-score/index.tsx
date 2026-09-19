'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ArrowRight,
  MoreVertical,
  RotateCcw,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useClassScore } from '../../hooks/use-class-score'
import { CLASS_SCORE_BOARDS } from '../../lib/class-score/data'
import {
  CLASS_SCORE_CLASS_KEYS,
  ClassScoreBoardDefinition,
  ClassScoreClassKey,
  ClassScoreStatus,
} from '../../lib/class-score/types'
import { sumClassScoreMaterials } from '../../lib/class-score/sum'
import { ClassCard } from './class-card'
import { ClassScoreSummary } from './summary-card'
import { ResetAlertDialog } from './reset-alert-dialog'

const BOARD_MAP = new Map<ClassScoreClassKey, ClassScoreBoardDefinition>(
  Object.values(CLASS_SCORE_BOARDS).map((board) => [board.key, board]),
)

const getClassStatus = (
  classes: Partial<Record<ClassScoreClassKey, ClassScoreStatus>> | undefined,
  key: ClassScoreClassKey,
): ClassScoreStatus => {
  if (!classes) return 'none'
  const val: unknown = Reflect.get(classes, key)
  if (val === 'target' || val === 'completed' || val === 'none') {
    return val
  }
  return 'none'
}

type HeaderActionsProps = {
  onSetAllTarget: () => void
  onOpenResetDialog: () => void
}

const HeaderActions: React.FC<HeaderActionsProps> = ({
  onSetAllTarget,
  onOpenResetDialog,
}) => {
  const { t } = useTranslation('classScore')
  const router = useRouter()

  return (
    <div className="flex items-center gap-2 self-start sm:self-auto">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="h-9 px-3 gap-1">
              <MoreVertical className="w-4 h-4" />
              <span className="text-xs">{t('menu.more', '一括操作')}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={onSetAllTarget}
            className="text-xs cursor-pointer"
          >
            <Target className="w-3.5 h-3.5 mr-2" />
            {t('menu.setAllTarget', '全クラスを目標にする')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onOpenResetDialog}
            className="text-xs text-destructive focus:text-destructive cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            {t('menu.resetAll', '設定を一括リセット')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        className="h-9 px-3 gap-1.5"
        onClick={() => router.push('/material/result')}
      >
        <span className="text-xs font-semibold">
          {t('action.viewResult', '素材結果を見る')}
        </span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

type ClassScoreHeaderProps = {
  onSetAllTarget: () => void
  onOpenResetDialog: () => void
}

const ClassScoreHeader: React.FC<ClassScoreHeaderProps> = ({
  onSetAllTarget,
  onOpenResetDialog,
}) => {
  const { t } = useTranslation('classScore')

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <div className="space-y-1">
        <Link
          href="/material"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('nav.backToMaterial', '育成素材計算機に戻る')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {t('title', 'クラススコア目標シミュレータ')}
          </h1>
          <Badge variant="outline" className="text-xs">
            Class Board
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(
            'description',
            '各クラスの最大解放に必要な素材（モニュピ・通常素材・QP・砂・トーチ）を目標に組み込みます。',
          )}
        </p>
      </div>

      <HeaderActions
        onSetAllTarget={onSetAllTarget}
        onOpenResetDialog={onOpenResetDialog}
      />
    </div>
  )
}

type ClassScoreUndoBannerProps = {
  onUndo: () => void
  onDismiss: () => void
}

const ClassScoreUndoBanner: React.FC<ClassScoreUndoBannerProps> = ({
  onUndo,
  onDismiss,
}) => {
  const { t } = useTranslation('classScore')
  return (
    <div className="bg-muted border border-border/80 rounded-lg p-3 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
      <div className="flex items-center gap-2 text-xs">
        <RotateCcw className="w-4 h-4 text-muted-foreground" />
        <span>
          {t(
            'undo.message',
            '設定を変更しました。誤操作の場合は直前の状態に戻せます。',
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs px-2.5 font-medium"
          onClick={onUndo}
        >
          {t('undo.button', '元に戻す')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2 text-muted-foreground"
          onClick={onDismiss}
        >
          {t('undo.dismiss', '閉じる')}
        </Button>
      </div>
    </div>
  )
}

export const ClassScoreIndex: React.FC = () => {
  const {
    state,
    setClassStatus,
    setAllStatus,
    resetAll,
    undo,
    clearUndo,
    canUndo,
    targetCount,
    completedCount,
  } = useClassScore()

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const totalMaterials = sumClassScoreMaterials(state)

  return (
    <div className="c-page">
      <div className="c-page-inner max-w-5xl mx-auto px-4 py-6 space-y-6">
        <ClassScoreHeader
          onSetAllTarget={() => setAllStatus('target')}
          onOpenResetDialog={() => setIsResetDialogOpen(true)}
        />

        {canUndo && (
          <ClassScoreUndoBanner onUndo={undo} onDismiss={clearUndo} />
        )}

        <ClassScoreSummary
          targetCount={targetCount}
          completedCount={completedCount}
          totalMaterials={totalMaterials}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CLASS_SCORE_CLASS_KEYS.map((key: ClassScoreClassKey) => {
            const board = BOARD_MAP.get(key)
            const status = getClassStatus(state.classes, key)
            if (!board) return null
            return (
              <ClassCard
                key={key}
                board={board}
                status={status}
                onChangeStatus={(newStatus) => setClassStatus(key, newStatus)}
              />
            )
          })}
        </div>

        <ResetAlertDialog
          isOpen={isResetDialogOpen}
          onClose={() => setIsResetDialogOpen(false)}
          onConfirm={resetAll}
        />
      </div>
    </div>
  )
}

'use client'

import React from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Check, Lock, Navigation, Sparkles, Target, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type {
  ClassBoardSquare,
  ClassBoardSquareStatus,
} from '../../lib/class-score/board-types'

export type SquareDialogProps = {
  square: ClassBoardSquare | null
  status: ClassBoardSquareStatus
  isOpen: boolean
  onClose: () => void
  onSetStatus: (status: ClassBoardSquareStatus) => void
  onSetRouteTarget: (squareId: number) => void
}

const SquareBadges: React.FC<{ square: ClassBoardSquare }> = ({ square }) => {
  const { t } = useTranslation('classScore')
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {square.isStart && (
        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">
          <Sparkles className="w-3 h-3 mr-0.5" />
          {t('square.badge.start', '起点サイン')}
        </Badge>
      )}
      {square.isLock && (
        <Badge variant="outline" className="text-[10px] border-rose-500/50 text-rose-500">
          <Lock className="w-3 h-3 mr-0.5" />
          {t('square.badge.lock', 'ツアーロック')}
        </Badge>
      )}
    </div>
  )
}

const SquareItemsList: React.FC<{ square: ClassBoardSquare }> = ({ square }) => {
  const { t } = useTranslation('classScore')
  if (square.items.length === 0) return null

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">
        {t('square.materials.title', '解放に必要な素材')}
      </span>
      <div className="grid grid-cols-2 gap-1.5 p-2 bg-muted/40 rounded-lg border border-border/40 text-xs">
        {square.items.map((it) => (
          <div key={it.id} className="flex justify-between items-center pr-1">
            <span className="truncate text-foreground/90">{it.name}</span>
            <span className="font-mono text-muted-foreground ml-1">×{it.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SquareStatusSelector: React.FC<{
  status: ClassBoardSquareStatus
  onSetStatus: (status: ClassBoardSquareStatus) => void
}> = ({ status, onSetStatus }) => {
  const { t } = useTranslation('classScore')
  return (
    <div className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg border border-border/40 text-xs">
      <Button
        type="button"
        size="sm"
        variant={status === 'none' ? 'secondary' : 'ghost'}
        className="h-8 text-xs cursor-pointer"
        onClick={() => onSetStatus('none')}
      >
        <X className="w-3.5 h-3.5 mr-1" />
        {t('square.status.none', '未解放')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={status === 'target' ? 'default' : 'ghost'}
        className="h-8 text-xs cursor-pointer"
        onClick={() => onSetStatus('target')}
      >
        <Target className="w-3.5 h-3.5 mr-1" />
        {t('square.status.target', '目標')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={status === 'unlocked' ? 'secondary' : 'ghost'}
        className={`h-8 text-xs cursor-pointer ${
          status === 'unlocked' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''
        }`}
        onClick={() => onSetStatus('unlocked')}
      >
        <Check className="w-3.5 h-3.5 mr-1" />
        {t('square.status.unlocked', '解放済')}
      </Button>
    </div>
  )
}

const SquareIcon: React.FC<{ square: ClassBoardSquare }> = ({ square }) => {
  if (square.icon) {
    return (
      <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-muted/20">
        <Image
          src={square.icon}
          alt={square.name}
          width={48}
          height={48}
          className="object-contain"
          unoptimized
        />
      </div>
    )
  }

  if (square.isLock) {
    return (
      <div className="w-12 h-12 shrink-0 rounded-lg border border-rose-500/40 bg-rose-950/30 flex items-center justify-center text-rose-400">
        <Lock className="w-6 h-6" />
      </div>
    )
  }

  return null
}

const SquareDialogHeader: React.FC<{ square: ClassBoardSquare }> = ({ square }) => (
  <DialogHeader className="flex flex-row items-start gap-3 space-y-0">
    <SquareIcon square={square} />
    <div className="flex-1 min-w-0">
      <DialogTitle className="text-base font-bold leading-tight truncate">
        {square.name}
      </DialogTitle>
      <SquareBadges square={square} />
    </div>
  </DialogHeader>
)

export const SquareDialog: React.FC<SquareDialogProps> = ({
  square,
  status,
  isOpen,
  onClose,
  onSetStatus,
  onSetRouteTarget,
}) => {
  const { t } = useTranslation('classScore')
  if (!square) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border/80 p-5">
        <SquareDialogHeader square={square} />

        <div className="space-y-4 py-2">
          {square.detail && (
            <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/30 whitespace-pre-wrap leading-relaxed">
              {square.detail}
            </div>
          )}

          <SquareItemsList square={square} />

          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground block">
              {t('square.status.label', 'このマスの状態')}
            </span>
            <SquareStatusSelector status={status} onSetStatus={onSetStatus} />
          </div>

          {status !== 'unlocked' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs font-medium text-amber-500 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              onClick={() => {
                onSetRouteTarget(square.id)
                onClose()
              }}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{t('square.action.route-target', '起点からここまでルート一括目標')}</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

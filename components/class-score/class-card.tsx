'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ChevronUp, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClassScoreBoardDefinition,
  ClassScoreStatus,
} from '../../lib/class-score/types'
import { getClassIconUrl } from '../../lib/get-class-icon-url'
import { ClassName } from '../../interfaces/atlas-academy'

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

export type ClassCardProps = {
  board: ClassScoreBoardDefinition
  status: ClassScoreStatus
  onChangeStatus: (status: ClassScoreStatus) => void
}

const getCardBorderClass = (status: ClassScoreStatus): string => {
  if (status === 'target') {
    return 'border-primary/80 bg-primary/5 shadow-md'
  }
  if (status === 'completed') {
    return 'border-emerald-500/50 bg-emerald-500/5 opacity-85'
  }
  return 'border-border/60 hover:border-border'
}

const ClassCardMaterials: React.FC<{
  board: ClassScoreBoardDefinition
}> = ({ board }) => {
  const { t } = useTranslation('classScore')
  return (
    <div className="mt-2 space-y-2 text-xs">
      <div>
        <span className="font-semibold text-muted-foreground block mb-1">
          {t('materials.generic', '通常強化素材')}
        </span>
        <div className="grid grid-cols-2 gap-1 bg-background/50 p-2 rounded border border-border/30">
          {board.materials.map((m) => (
            <div key={m.id} className="flex justify-between items-center pr-1">
              <span className="truncate text-foreground/90">{m.name}</span>
              <span className="font-mono text-muted-foreground">×{m.amount}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="font-semibold text-muted-foreground block mb-1">
          {t('materials.pieces', 'ピース / モニュメント')}
        </span>
        <div className="grid grid-cols-2 gap-1 bg-background/50 p-2 rounded border border-border/30">
          {board.pieces.map((p) => (
            <div key={p.id} className="flex justify-between items-center pr-1">
              <span className="truncate text-foreground/90">{p.name}</span>
              <span className="font-mono text-muted-foreground">×{p.amount}</span>
            </div>
          ))}
          {board.monuments.map((mn) => (
            <div key={mn.id} className="flex justify-between items-center pr-1">
              <span className="truncate text-foreground/90">{mn.name}</span>
              <span className="font-mono text-muted-foreground">×{mn.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const ClassCardHeader: React.FC<{
  board: ClassScoreBoardDefinition
  status: ClassScoreStatus
}> = ({ board, status }) => {
  const { t } = useTranslation('classScore')
  const iconClass =
    (Reflect.get(CLASS_TO_ICON_CLASS, board.key) as ClassName | undefined) ??
    'saber'
  const iconUrl = getClassIconUrl(iconClass, 5)

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        {iconUrl ? (
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src={iconUrl}
              alt={board.name}
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
        ) : null}
        <div>
          <h3 className="font-bold text-base leading-tight">
            {t(`class-name.${board.key}`, board.name)}
          </h3>
          <span className="text-xs text-muted-foreground">{board.enName}</span>
        </div>
      </div>

      <div>
        {status === 'target' && (
          <Badge variant="default" className="gap-1 font-semibold">
            <Target className="w-3.5 h-3.5" />
            {t('status.target', '目標')}
          </Badge>
        )}
        {status === 'completed' && (
          <Badge
            variant="secondary"
            className="gap-1 bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-semibold"
          >
            <Check className="w-3.5 h-3.5" />
            {t('status.completed', '解放済')}
          </Badge>
        )}
        {status === 'none' && (
          <Badge variant="outline" className="text-muted-foreground">
            {t('status.none', '未設定')}
          </Badge>
        )}
      </div>
    </div>
  )
}

const ClassCardSummary: React.FC = () => {
  const { t } = useTranslation('classScore')
  return (
    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 rounded-md p-2.5">
      <div>
        <span className="text-muted-foreground">{t('summary.qp', '必要QP')}: </span>
        <span className="font-medium text-foreground">3.17億</span>
      </div>
      <div>
        <span className="text-muted-foreground">{t('summary.sand', '星光の砂')}: </span>
        <span className="font-medium text-foreground">6,680</span>
      </div>
      <div>
        <span className="text-muted-foreground">{t('summary.monuments', 'モニュメント')}: </span>
        <span className="font-medium text-foreground">500個</span>
      </div>
      <div>
        <span className="text-muted-foreground">{t('summary.torches', 'トーチ')}: </span>
        <span className="font-medium text-foreground">計10個</span>
      </div>
    </div>
  )
}

const ClassCardActions: React.FC<{
  status: ClassScoreStatus
  onChangeStatus: (status: ClassScoreStatus) => void
}> = ({ status, onChangeStatus }) => {
  const { t } = useTranslation('classScore')
  const isTarget = status === 'target'
  const isCompleted = status === 'completed'

  return (
    <div className="grid grid-cols-3 gap-1.5 pt-1">
      <Button
        size="sm"
        variant={!isTarget && !isCompleted ? 'secondary' : 'outline'}
        className="text-xs h-8 px-2"
        onClick={() => onChangeStatus('none')}
      >
        {t('action.none', '未設定')}
      </Button>
      <Button
        size="sm"
        variant={isTarget ? 'default' : 'outline'}
        className="text-xs h-8 px-2"
        onClick={() => onChangeStatus('target')}
      >
        <Target className="w-3 h-3 mr-1" />
        {t('action.target', '目標')}
      </Button>
      <Button
        size="sm"
        variant={isCompleted ? 'secondary' : 'outline'}
        className={`text-xs h-8 px-2 ${
          isCompleted
            ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400'
            : ''
        }`}
        onClick={() => onChangeStatus('completed')}
      >
        <Check className="w-3 h-3 mr-1" />
        {t('action.completed', '解放済')}
      </Button>
    </div>
  )
}

export const ClassCard: React.FC<ClassCardProps> = ({
  board,
  status,
  onChangeStatus,
}) => {
  const { t } = useTranslation('classScore')
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-xl bg-card text-card-foreground transition-all duration-200 border-2 ${getCardBorderClass(
        status,
      )}`}
    >
      <div className="p-4 flex flex-col gap-3">
        <ClassCardHeader board={board} status={status} />
        <ClassCardSummary />
        <ClassCardActions status={status} onChangeStatus={onChangeStatus} />

        <div className="pt-1 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-7 hover:text-foreground flex items-center justify-center gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <span>{t('materials.hide', '必要素材を閉じる')}</span>
                <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>{t('materials.show', '必要素材の内訳を見る')}</span>
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </Button>

          {expanded && <ClassCardMaterials board={board} />}
        </div>
      </div>
    </div>
  )
}

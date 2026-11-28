'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Check, ChevronDown, ChevronUp, Network, Target, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ClassScoreBoardDefinition,
  ClassScoreStatus,
} from '../../lib/class-score/types'
import type { ClassBoardSquareCounts } from '../../lib/class-score/class-status'
import { CLASS_SCORE_BOARDS } from '../../lib/class-score/data'
import { getAllClassBoards } from '../../lib/class-score/board-loader'
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

/** カードに出す必要数の種類。`target` は目標かつ未解放のマスぶん、`full-unlock` は全マス解放ぶん。 */
export type ClassCardMaterialsKind = 'target' | 'full-unlock'

export type ClassCardProps = {
  board: ClassScoreBoardDefinition
  /** 盤面から導出したステータス */
  status: ClassScoreStatus
  squareCounts: ClassBoardSquareCounts
  /** カードに出す必要数（アイテムID → 数）。`null` なら出さない */
  materials: Record<string, number> | null
  materialsKind: ClassCardMaterialsKind
  onChangeStatus: (status: ClassScoreStatus) => void
}

const QP_ID = '1'
const SAND_ID = '50'
const TORCH_IDS = ['51', '52', '53']

const buildItemNameMap = (): Map<string, string> => {
  const names = new Map<string, string>()
  for (const def of Object.values(CLASS_SCORE_BOARDS)) {
    for (const it of [...def.materials, ...def.pieces, ...def.monuments, ...def.specialItems]) {
      names.set(it.id, it.name)
    }
  }
  for (const boardData of Object.values(getAllClassBoards())) {
    for (const sq of boardData.squares) {
      for (const it of sq.items) {
        if (!names.has(it.id)) names.set(it.id, it.name)
      }
    }
  }
  return names
}

const ITEM_NAMES = buildItemNameMap()

const isPieceId = (id: string) => /^70\d\d$/.test(id)
const isMonumentId = (id: string) => /^71\d\d$/.test(id)
const isGenericId = (id: string) =>
  id !== QP_ID && id !== SAND_ID && !TORCH_IDS.includes(id) && !isPieceId(id) && !isMonumentId(id)

const amountOf = (materials: Record<string, number>, id: string): number => {
  const val: unknown = Reflect.get(materials, id)
  return typeof val === 'number' ? val : 0
}

type NamedAmount = { id: string; name: string; amount: number }

const pickItems = (
  materials: Record<string, number>,
  predicate: (id: string) => boolean,
): NamedAmount[] =>
  Object.entries(materials)
    .filter(([id, amount]) => amount > 0 && predicate(id))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, amount]) => ({ id, name: ITEM_NAMES.get(id) ?? id, amount }))

const getCardBorderClass = (status: ClassScoreStatus): string => {
  if (status === 'target') {
    return 'border-primary/80 bg-primary/5 shadow-md'
  }
  if (status === 'completed') {
    return 'border-emerald-500/50 bg-emerald-500/5 opacity-85'
  }
  return 'border-border/60 hover:border-border'
}

const ItemGrid: React.FC<{ items: NamedAmount[] }> = ({ items }) => (
  <div className="grid grid-cols-2 gap-1 bg-background/50 p-2 rounded border border-border/30">
    {items.map((m) => (
      <div key={m.id} className="flex justify-between items-center pr-1">
        <span className="truncate text-foreground/90">{m.name}</span>
        <span className="font-mono text-muted-foreground">×{m.amount.toLocaleString()}</span>
      </div>
    ))}
  </div>
)

const ClassCardMaterials: React.FC<{
  materials: Record<string, number>
}> = ({ materials }) => {
  const { t } = useTranslation('classScore')
  const generic = pickItems(materials, isGenericId)
  const piecesAndMonuments = [
    ...pickItems(materials, isPieceId),
    ...pickItems(materials, isMonumentId),
  ]
  return (
    <div className="mt-2 space-y-2 text-xs">
      {generic.length > 0 && (
        <div>
          <span className="font-semibold text-muted-foreground block mb-1">
            {t('materials.generic', '通常強化素材')}
          </span>
          <ItemGrid items={generic} />
        </div>
      )}
      {piecesAndMonuments.length > 0 && (
        <div>
          <span className="font-semibold text-muted-foreground block mb-1">
            {t('materials.pieces', 'ピース / モニュメント')}
          </span>
          <ItemGrid items={piecesAndMonuments} />
        </div>
      )}
    </div>
  )
}

const useStatusLabel = (
  status: ClassScoreStatus,
  squareCounts: ClassBoardSquareCounts,
): string => {
  const { t } = useTranslation('classScore')
  if (status === 'completed') return t('status.completed', '解放済')
  if (status === 'target') {
    return squareCounts.remaining === 0
      ? t('status.all-target', '全マス目標')
      : t('status.detail-target', '{{count}}マス目標', { count: squareCounts.target })
  }
  return t('status.none', '未設定')
}

const getStatusBadgeClass = (status: ClassScoreStatus): string => {
  if (status === 'target') return 'bg-primary text-primary-foreground'
  if (status === 'completed') return 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400'
  return 'border border-border text-muted-foreground'
}

const StatusIcon: React.FC<{ status: ClassScoreStatus }> = ({ status }) => {
  if (status === 'target') return <Target className="w-3.5 h-3.5" />
  if (status === 'completed') return <Check className="w-3.5 h-3.5" />
  return null
}

const ClassCardStatus: React.FC<{
  status: ClassScoreStatus
  squareCounts: ClassBoardSquareCounts
  expanded: boolean
  onToggle: () => void
}> = ({ status, squareCounts, expanded, onToggle }) => {
  const { t } = useTranslation('classScore')
  const label = useStatusLabel(status, squareCounts)
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="w-full flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2.5 text-left cursor-pointer hover:bg-muted/70"
    >
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold ${getStatusBadgeClass(status)}`}
      >
        <StatusIcon status={status} />
        <span>{label}</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {t('status.square-counts', '解放済 {{unlocked}}・目標 {{target}}・残り {{remaining}}', {
          unlocked: squareCounts.unlocked,
          target: squareCounts.target,
          remaining: squareCounts.remaining,
        })}
      </span>
    </button>
  )
}

const ClassCardHeader: React.FC<{
  board: ClassScoreBoardDefinition
}> = ({ board }) => {
  const { t } = useTranslation('classScore')
  const iconClass =
    (Reflect.get(CLASS_TO_ICON_CLASS, board.key) as ClassName | undefined) ?? 'saber'
  const iconUrl = getClassIconUrl(iconClass, 5)

  return (
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
  )
}

const ClassCardSummary: React.FC<{
  materials: Record<string, number>
  kind: ClassCardMaterialsKind
}> = ({ materials, kind }) => {
  const { t } = useTranslation('classScore')
  const qp = amountOf(materials, QP_ID)
  const sand = amountOf(materials, SAND_ID)
  const monuments = pickItems(materials, isMonumentId).reduce((acc, it) => acc + it.amount, 0)
  const torches = TORCH_IDS.reduce((acc, id) => acc + amountOf(materials, id), 0)
  return (
    <div className="space-y-1">
      <span className="block text-xs font-semibold text-muted-foreground">
        {kind === 'target'
          ? t('card.materials-target', '目標ぶんに必要')
          : t('card.materials-full-unlock', '全マス解放に必要')}
      </span>
      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 rounded-md p-2.5">
        <div>
          <span className="text-muted-foreground">{t('summary.qp', '必要QP')}: </span>
          <span className="font-medium text-foreground" data-testid="class-card-qp" data-value={qp}>
            {t('card.qp-oku', '{{value}}億', { value: (qp / 100000000).toFixed(2) })}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('summary.sand', '星光の砂')}: </span>
          <span className="font-medium text-foreground">{sand.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('summary.monuments', 'モニュメント')}: </span>
          <span className="font-medium text-foreground">
            {t('card.count-unit', '{{count}}個', { count: monuments })}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('summary.torches', 'トーチ')}: </span>
          <span className="font-medium text-foreground">
            {t('card.torch-total', '計{{count}}個', { count: torches })}
          </span>
        </div>
      </div>
    </div>
  )
}

const ClassCardActions: React.FC<{
  onChangeStatus: (status: ClassScoreStatus) => void
}> = ({ onChangeStatus }) => {
  const { t } = useTranslation('classScore')
  return (
    <div
      role="group"
      aria-label={t('status.class-actions', 'クラス全体への操作')}
      className="grid grid-cols-3 gap-1 text-xs"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1"
        onClick={() => onChangeStatus('target')}
      >
        <Target className="w-3.5 h-3.5" />
        <span>{t('action.all-target', '全マスを目標に')}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1"
        onClick={() => onChangeStatus('completed')}
      >
        <Check className="w-3.5 h-3.5" />
        <span>{t('action.all-completed', '全マスを解放済に')}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1"
        onClick={() => onChangeStatus('none')}
      >
        <X className="w-3.5 h-3.5" />
        <span>{t('action.clear-all', 'すべて外す')}</span>
      </Button>
    </div>
  )
}

const ClassCardMaterialsToggle: React.FC<{
  materials: Record<string, number>
}> = ({ materials }) => {
  const { t } = useTranslation('classScore')
  const [expanded, setExpanded] = useState(false)
  return (
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

      {expanded && <ClassCardMaterials materials={materials} />}
    </div>
  )
}

export const ClassCard: React.FC<ClassCardProps> = ({
  board,
  status,
  squareCounts,
  materials,
  materialsKind,
  onChangeStatus,
}) => {
  const { t } = useTranslation('classScore')
  const [actionsOpen, setActionsOpen] = useState(false)

  return (
    <div
      className={`rounded-xl bg-card text-card-foreground transition-all duration-200 border-2 ${getCardBorderClass(
        status,
      )}`}
    >
      <div className="p-4 flex flex-col gap-3">
        <ClassCardHeader board={board} />
        <ClassCardStatus
          status={status}
          squareCounts={squareCounts}
          expanded={actionsOpen}
          onToggle={() => setActionsOpen((open) => !open)}
        />
        {actionsOpen && (
          <ClassCardActions
            onChangeStatus={(next) => {
              setActionsOpen(false)
              onChangeStatus(next)
            }}
          />
        )}
        {materials && <ClassCardSummary materials={materials} kind={materialsKind} />}

        <Link
          href={`/material/class-score/${board.key}`}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'w-full text-xs h-8 flex items-center justify-center gap-1.5 font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer',
          )}
        >
          <Network className="w-3.5 h-3.5 text-primary" />
          <span>{t('action.open-board-map', '盤面マップで個別指定')}</span>
        </Link>

        {materials && <ClassCardMaterialsToggle materials={materials} />}
      </div>
    </div>
  )
}

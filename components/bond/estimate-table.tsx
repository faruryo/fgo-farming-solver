'use client'

import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Quest } from '../../interfaces/fgodrop'
import type { EntryEstimate } from '../../lib/bond/entry-estimate'
import type { groupByQuest } from '../../lib/bond/estimate'
import { bondProgress, timeToGoal } from '../../lib/bond/progress'
import type { MaterialCatalogServant } from '../../lib/material-catalog'
import { ClassIcon, questLabel } from './servant-card'

type Summary = ReturnType<typeof groupByQuest>
type QuestRunGroup = Summary['groups'][number]
type BondCard = { servant: MaterialCatalogServant | undefined; estimate: EntryEstimate }

function Tile({ label, value, sub }: Readonly<{ label: string; value: string; sub?: string }>) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-lg tabular-nums">{value}</CardTitle>
        {sub && <CardDescription className="text-[11px]">{sub}</CardDescription>}
      </CardHeader>
    </Card>
  )
}

function GoalSummary({ total }: Readonly<{ total: Summary['total'] }>) {
  const { t } = useTranslation('bond')
  const { days, bottleneck } = timeToGoal(total)
  const bottleneckLabel = bottleneck && (bottleneck === 'ap' ? t('ap', 'AP') : t('storm-pods', 'ストームポッド'))
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="bond-goal">
        <Tile label={t('remaining-runs', '残り周回')} value={total.runs.toLocaleString()} />
        <Tile label={t('required-ap', '必要AP')} value={total.ap.toLocaleString()} />
        <Tile label={t('storm-pods', 'ストームポッド')} value={total.pods.toLocaleString()} />
        <Tile
          label={t('days-to-goal', '到達まで')}
          value={t('days-count', '約{{count}}日', { count: days })}
          sub={days >= 60 ? t('months-count', '約{{count}}か月', { count: Math.round(days / 30) }) : undefined}
        />
      </div>
      <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
        {bottleneckLabel && (
          <span className="font-semibold" style={{ color: 'var(--text2)' }}>
            {t('bottleneck', 'ボトルネック: {{name}}', { name: bottleneckLabel })}{' '}
          </span>
        )}
        {t('goal-note', 'AP自然回復(1日288)とポッドの配布(ログイン3個/日・交換40個/月)だけで回した概算です。果実は含みません')}
      </p>
    </div>
  )
}

function ServantProgress({ servant, estimate, quest }: Readonly<BondCard & { quest: Quest | undefined }>) {
  const { t } = useTranslation('bond')
  const { entry, result } = estimate
  const progress = result ? bondProgress(servant?.bondGrowth, entry) : null
  const name = servant?.name ?? `#${entry.servantId}`
  return (
    <Card size="sm" className={progress === null ? 'opacity-50' : undefined} data-testid={`bond-progress-${entry.servantId}`}>
      <CardContent className="flex items-center gap-3">
        {servant?.face ? <Image src={servant.face} alt={name} width={40} height={40} className="rounded" /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-1 font-semibold">
            {servant && <ClassIcon servant={servant} size={18} />}
            <span className="truncate">{name}</span>
            <span className="ml-auto shrink-0 text-[11px] font-normal tabular-nums" style={{ color: 'var(--text3)' }}>
              Lv{entry.currentLevel} → {entry.targetLevel}
            </span>
          </div>
          {progress === null || !result ? (
            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{t('progress-unavailable', '入力を確認してください')}</span>
          ) : (
            <>
              <Progress value={Math.round(progress * 100)} aria-label={name} />
              <div className="flex flex-wrap gap-x-3 text-[11px] tabular-nums" style={{ color: 'var(--text3)' }}>
                <span>{t('remaining-bond', '残り絆')} {result.remaining.toLocaleString()}</span>
                <span>{t('runs-count', '{{count}}周', { count: result.runs.runs })}</span>
                <span className="truncate">{questLabel(quest)}</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function GroupRow({
  group,
  quest,
  showPlan,
  planned,
}: Readonly<{ group: QuestRunGroup; quest: Quest | undefined; showPlan: boolean; planned: number | undefined }>) {
  return (
    <TableRow className="tabular-nums" data-testid={`bond-group-${group.questId}`}>
      <TableCell className="whitespace-normal">{questLabel(quest)}</TableCell>
      <TableCell className="text-right">{group.servantCount}</TableCell>
      <TableCell className="text-right">{group.runs.toLocaleString()}</TableCell>
      <TableCell className="text-right">{group.ap.toLocaleString()}</TableCell>
      <TableCell className="text-right">{group.pods.toLocaleString()}</TableCell>
      {showPlan && <TableCell className="text-right">{planned?.toLocaleString() ?? '-'}</TableCell>}
      {showPlan && (
        <TableCell className="text-right" data-testid={`bond-group-over-${group.questId}`}>
          {planned ? Math.max(0, group.runs - planned).toLocaleString() : '-'}
        </TableCell>
      )}
    </TableRow>
  )
}

function QuestTable({
  summary,
  questsById,
  plannedLaps,
}: Readonly<{ summary: Summary; questsById: ReadonlyMap<string, Quest>; plannedLaps: ReadonlyMap<string, number> }>) {
  const { t } = useTranslation('bond')
  const showPlan = plannedLaps.size > 0
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
          {t('group-note', '同じクエストのサーヴァントは同じ編成で回す前提で、最も多い周回数を表示します')}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('quest', '周回クエスト')}</TableHead>
              <TableHead className="text-right">{t('servant-count', '騎数')}</TableHead>
              <TableHead className="text-right">{t('remaining-runs', '残り周回')}</TableHead>
              <TableHead className="text-right">{t('required-ap', '必要AP')}</TableHead>
              <TableHead className="text-right">{t('storm-pods', 'ストームポッド')}</TableHead>
              {showPlan && <TableHead className="text-right">{t('plan-laps', '周回予定')}</TableHead>}
              {showPlan && <TableHead className="text-right">{t('plan-over', '予定超過')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.groups.map(group => (
              <GroupRow
                key={group.questId}
                group={group}
                quest={questsById.get(group.questId)}
                showPlan={showPlan}
                planned={plannedLaps.get(group.questId)}
              />
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="tabular-nums" data-testid="bond-total">
              <TableCell>{t('total', '合計')}</TableCell>
              <TableCell />
              <TableCell className="text-right">{summary.total.runs.toLocaleString()}</TableCell>
              <TableCell className="text-right">{summary.total.ap.toLocaleString()}</TableCell>
              <TableCell className="text-right">{summary.total.pods.toLocaleString()}</TableCell>
              {showPlan && <TableCell colSpan={2} />}
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}

export function BondEstimateTable({
  summary,
  cards,
  questsById,
  plannedLaps,
}: Readonly<{
  summary: Summary
  cards: readonly BondCard[]
  questsById: ReadonlyMap<string, Quest>
  plannedLaps: ReadonlyMap<string, number>
}>) {
  return (
    <div className="flex flex-col gap-4">
      <GoalSummary total={summary.total} />
      <div className="flex flex-col gap-2">
        {cards.map(({ servant, estimate }) => (
          <ServantProgress
            key={estimate.entry.servantId}
            servant={servant}
            estimate={estimate}
            quest={questsById.get(estimate.entry.questId)}
          />
        ))}
      </div>
      <QuestTable summary={summary} questsById={questsById} plannedLaps={plannedLaps} />
    </div>
  )
}

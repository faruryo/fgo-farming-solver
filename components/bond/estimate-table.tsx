'use client'

import { useTranslation } from 'react-i18next'
import type { Quest } from '../../interfaces/fgodrop'
import type { groupByQuest } from '../../lib/bond/estimate'
import { questLabel } from './servant-card'

type QuestRunGroup = ReturnType<typeof groupByQuest>['groups'][number]

function GroupRow({
  group,
  quest,
  showPlan,
  planned,
}: Readonly<{ group: QuestRunGroup; quest: Quest | undefined; showPlan: boolean; planned: number | undefined }>) {
  return (
    <tr className="tabular-nums" data-testid={`bond-group-${group.questId}`}>
      <td className="py-1">{questLabel(quest)}</td>
      <td className="py-1 text-right">{group.servantCount}</td>
      <td className="py-1 text-right">{group.runs.toLocaleString()}</td>
      <td className="py-1 text-right">{group.ap.toLocaleString()}</td>
      <td className="py-1 text-right">{group.pods.toLocaleString()}</td>
      {showPlan && <td className="py-1 text-right">{planned?.toLocaleString() ?? '-'}</td>}
      {showPlan && (
        <td className="py-1 text-right" data-testid={`bond-group-over-${group.questId}`}>
          {planned ? Math.max(0, group.runs - planned).toLocaleString() : '-'}
        </td>
      )}
    </tr>
  )
}

export function BondEstimateTable({
  summary,
  questsById,
  plannedLaps,
}: Readonly<{
  summary: ReturnType<typeof groupByQuest>
  questsById: ReadonlyMap<string, Quest>
  plannedLaps: ReadonlyMap<string, number>
}>) {
  const { t } = useTranslation('bond')
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
        {t('group-note', '同じクエストのサーヴァントは同じ編成で回す前提で、最も多い周回数を表示します')}
      </p>
      <div className="c-card overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px]" style={{ color: 'var(--text3)' }}>
              <th className="py-1">{t('quest', '周回クエスト')}</th>
              <th className="py-1 text-right">{t('servant-count', '騎数')}</th>
              <th className="py-1 text-right">{t('remaining-runs', '残り周回')}</th>
              <th className="py-1 text-right">{t('required-ap', '必要AP')}</th>
              <th className="py-1 text-right">{t('storm-pods', 'ストームポッド')}</th>
              {plannedLaps.size > 0 && <th className="py-1 text-right">{t('plan-laps', '周回予定')}</th>}
              {plannedLaps.size > 0 && <th className="py-1 text-right">{t('plan-over', '予定超過')}</th>}
            </tr>
          </thead>
          <tbody>
            {summary.groups.map(group => (
              <GroupRow
                key={group.questId}
                group={group}
                quest={questsById.get(group.questId)}
                showPlan={plannedLaps.size > 0}
                planned={plannedLaps.get(group.questId)}
              />
            ))}
            <tr className="font-semibold tabular-nums" style={{ borderTop: '1px solid var(--border)' }} data-testid="bond-total">
              <td className="py-1">{t('total', '合計')}</td>
              <td />
              <td className="py-1 text-right">{summary.total.runs.toLocaleString()}</td>
              <td className="py-1 text-right">{summary.total.ap.toLocaleString()}</td>
              <td className="py-1 text-right">{summary.total.pods.toLocaleString()}</td>
              {plannedLaps.size > 0 && <td colSpan={2} />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

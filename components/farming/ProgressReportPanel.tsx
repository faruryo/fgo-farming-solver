'use client'

import React, { useEffect, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProgressResponse } from '../../lib/progress/types'
import type { SnapshotPeriod } from '../../lib/progress/snapshot'
import { ProgressReportContent } from './progress-report-content'
import { ServantPraise } from './ServantPraise'
import { selectMashuMessage } from '../../lib/progress/mashu-messages'

const PERIOD_LABELS: Record<SnapshotPeriod, string> = {
  previous: '前回',
  week: '1週間前',
  month: '1ヶ月前',
}

const PERIODS: SnapshotPeriod[] = ['previous', 'week', 'month']

export type ResultStats = {
  totalLap: number
  totalAp: number
  yen: number
}

export type ProgressReportPanelProps = {
  data: ProgressResponse | null
  loading?: boolean
  stats?: ResultStats
  tooltips?: { lap: string; ap: string; cost: string }
}

export const ProgressReportPanel: React.FC<ProgressReportPanelProps> = ({
  data,
  loading = false,
  stats,
  tooltips,
}) => {
  const [period, setPeriod] = useState<SnapshotPeriod>('previous')
  const current = data?.periods[period] ?? null
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) setMessage(selectMashuMessage(current))
  }, [current, loading])

  return (
    <div className="c-card p-3 flex flex-col gap-2 text-sm">
      {stats && (
        <div className="c-stats" style={{ justifyContent: 'flex-start', gap: 20, paddingBottom: 8 }}>
          <Tooltip>
            <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
              <div className="c-stat-num">{stats.totalLap}</div>
              <div className="c-stat-label">周回数</div>
            </TooltipTrigger>
            {tooltips && <TooltipContent>{tooltips.lap}</TooltipContent>}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
              <div className="c-stat-num">{stats.totalAp}</div>
              <div className="c-stat-label">消費AP</div>
            </TooltipTrigger>
            {tooltips && <TooltipContent>{tooltips.ap}</TooltipContent>}
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
              <div className="c-stat-num">¥{stats.yen.toLocaleString()}</div>
              <div className="c-stat-label">費用</div>
            </TooltipTrigger>
            {tooltips && <TooltipContent>{tooltips.cost}</TooltipContent>}
          </Tooltip>
        </div>
      )}

      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`c-filter-toggle${period === p ? ' active' : ''}`}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted-foreground py-2 text-center text-xs">読み込み中...</div>
      ) : (
        <>
          {message && <ServantPraise message={message} size={40} />}
          {current && <ProgressReportContent summary={current} />}
        </>
      )}
    </div>
  )
}

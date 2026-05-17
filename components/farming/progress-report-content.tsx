'use client'

import React from 'react'
import type { PeriodSummary, ProgressTier } from '../../lib/progress/types'

const TIER_STYLES: Record<
  ProgressTier,
  { bg: string; border: string; label: string; numSize: string }
> = {
  large: {
    bg: 'linear-gradient(135deg, rgba(217,176,68,0.25), rgba(217,176,68,0.06))',
    border: '#d9b044',
    label: '大きな進捗！',
    numSize: 'text-2xl',
  },
  medium: {
    bg: 'rgba(96,200,144,0.12)',
    border: '#60c890',
    label: '着実な前進',
    numSize: 'text-xl',
  },
  small: {
    bg: 'rgba(120,150,200,0.10)',
    border: '#7896c8',
    label: '少しずつ',
    numSize: 'text-lg',
  },
  none: {
    bg: 'rgba(180,180,180,0.08)',
    border: '#888',
    label: 'お疲れさまでした',
    numSize: 'text-xl',
  },
}

type RowProps = {
  label: string
  value: React.ReactNode
  highlight?: boolean
}
const Row: React.FC<RowProps> = ({ label, value, highlight }) => (
  <div className="flex items-baseline justify-between gap-3 py-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={highlight ? 'font-semibold tabular-nums' : 'tabular-nums'}
      style={highlight ? { color: 'var(--gold)' } : undefined}
    >
      {value}
    </span>
  </div>
)

export type ProgressReportContentProps = {
  summary: PeriodSummary
}

export const ProgressReportContent: React.FC<ProgressReportContentProps> = ({
  summary,
}) => {
  const style = TIER_STYLES[summary.tier]
  const showNoProgress = summary.fallback === 'zero_progress'
  const showFirstTime = summary.fallback === 'first_time'
  const showNoSnapshot = summary.fallback === 'no_snapshot_for_period'

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: style.bg,
        borderLeft: `3px solid ${style.border}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{style.label}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          tier: {summary.tier}
        </span>
      </div>

      {showFirstTime && (
        <p className="text-sm">
          初めてのデータ登録、ありがとうございます。次回からは進捗を比較できます。
        </p>
      )}
      {showNoSnapshot && (
        <p className="text-sm">
          この期間のスナップショットはまだ無いようです。記録が蓄積されるとここに表示されます。
        </p>
      )}
      {showNoProgress && (
        <p className="text-sm">
          今回は数字としての変化は出ませんでしたが、データ更新はしっかり記録できています。
        </p>
      )}

      {!summary.fallback && (
        <>
          <div
            className={`${style.numSize} font-bold tabular-nums`}
            style={{ color: style.border }}
          >
            AP −{Math.max(0, summary.deltaApAdjusted).toLocaleString()}
          </div>

          <div className="flex flex-col">
            <Row
              label="周回による減少"
              value={summary.deltaApRaw.toLocaleString()}
            />
            {summary.newServantCount > 0 && (
              <Row
                label={`新しい仲間 ${summary.newServantCount}体ぶん`}
                value={`+${summary.newServantOffsetAp.toLocaleString()}`}
                highlight
              />
            )}
            {summary.targetApIncrease > 0 && (
              <Row
                label="目標 AP 増加"
                value={`+${summary.targetApIncrease.toLocaleString()}`}
                highlight
              />
            )}
          </div>

          {summary.servantGrowth.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">
                サーヴァント成長 ({summary.servantGrowth.length} 体)
              </div>
              <ul className="text-sm flex flex-col gap-0.5">
                {summary.servantGrowth.slice(0, 5).map((g) => (
                  <li
                    key={g.servantId}
                    className="flex justify-between gap-3"
                  >
                    <span className="truncate">
                      {g.servantName ?? `#${g.servantId}`}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      −{g.delta} レベル
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground mt-2">
            経過時間: {summary.elapsedMinutes} 分
          </div>
        </>
      )}
    </div>
  )
}

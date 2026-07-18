'use client'

import React from 'react'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { PeriodSummary, ProgressTier } from '../../lib/progress/types'
import { staticOrigin, region } from '../../constants/atlasacademy'

// サーヴァントの顔アイコンURL。Atlas の Faces 命名規則は f_<servantId * 10>.png。
const servantFaceUrl = (servantId: string): string =>
  `${staticOrigin}/${region}/Faces/f_${Number(servantId) * 10}.png`

const TIER_STYLES: Record<
  ProgressTier,
  { bg: string; border: string; labelKey: string; boxShadow?: string; labelClassName?: string }
> = {
  // large よりさらに強い特別な配色・装飾(design.md D2/spec: 達成感の視覚的演出)。
  legendary: {
    bg: 'linear-gradient(135deg, rgba(255,140,60,0.38), rgba(217,176,68,0.16))',
    border: '#ff8c3c',
    boxShadow: '0 0 0 1px rgba(255,140,60,0.25), 0 4px 16px rgba(255,140,60,0.25)',
    labelKey: 'progress-tier-legendary',
    labelClassName: 'text-base font-bold',
  },
  large: {
    bg: 'linear-gradient(135deg, rgba(217,176,68,0.25), rgba(217,176,68,0.06))',
    border: '#d9b044',
    labelKey: 'progress-tier-large',
  },
  medium: {
    bg: 'rgba(96,200,144,0.12)',
    border: '#60c890',
    labelKey: 'progress-tier-medium',
  },
  small: {
    bg: 'rgba(120,150,200,0.10)',
    border: '#7896c8',
    labelKey: 'progress-tier-small',
  },
  none: {
    bg: 'rgba(180,180,180,0.08)',
    border: '#888',
    labelKey: 'progress-tier-none',
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
  const { t } = useTranslation('farming')
  const style = TIER_STYLES[summary.tier]
  const showNoProgress = summary.fallback === 'zero_progress'
  const showFirstTime = summary.fallback === 'first_time'
  const showNoSnapshot = summary.fallback === 'no_snapshot_for_period'

  // 「いつと比べて」のラベル。baseline は30/60/90日候補のうちperDay最大の窓が単一で
  // 選ばれる(design.md D2)ため、どの窓が選ばれても経過日数(昨日 / N日前)で時点を表す。
  const compareLabel = (): string => {
    const days = Math.round(summary.elapsedMinutes / 1440)
    if (days <= 0) return t('progress-compare-today')
    if (days === 1) return t('progress-compare-yesterday')
    return t('progress-compare-days-ago', { count: days })
  }

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: style.bg,
        borderLeft: `3px solid ${style.border}`,
        boxShadow: style.boxShadow,
      }}
    >
      <div className="flex items-center justify-between">
        <span className={style.labelClassName ?? 'text-sm font-semibold'}>
          {t(style.labelKey)}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          tier: {summary.tier}
        </span>
      </div>

      {showFirstTime && <p className="text-sm">{t('progress-first-time')}</p>}
      {showNoSnapshot && <p className="text-sm">{t('progress-no-snapshot')}</p>}
      {showNoProgress && <p className="text-sm">{t('progress-zero')}</p>}

      {!summary.fallback && (
        <>
          <div className="text-xs text-muted-foreground">
            {t('progress-compare-caption', { label: compareLabel() })}
          </div>

          {/* 主役: 目標への前進(周回)。AP相当/費用は同じ前進の単位換算なので小さく内訳表示。 */}
          {typeof summary.forwardLaps === 'number' && summary.forwardLaps > 0 && (
            <div>
              <div className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
                {t('progress-forward-heading')}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="計算について"
                        className="inline-flex items-center cursor-help"
                      />
                    }
                  >
                    <Info className="w-3.5 h-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-left leading-relaxed">
                    {t('progress-forward-tooltip')}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                className="text-2xl font-bold tabular-nums leading-tight"
                style={{ color: style.border }}
              >
                {t('progress-forward-value', {
                  count: Math.round(summary.forwardLaps).toLocaleString(),
                })}
              </div>
              {(() => {
                const parts = [
                  typeof summary.forwardApEquivalent === 'number'
                    ? t('progress-forward-ap-equivalent', {
                        count: Math.round(summary.forwardApEquivalent).toLocaleString(),
                      })
                    : null,
                  typeof summary.forwardYen === 'number'
                    ? t('progress-forward-cost', {
                        count: Math.round(summary.forwardYen).toLocaleString(),
                      })
                    : null,
                ].filter(Boolean)
                return parts.length ? (
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {parts.join(' ・ ')}
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* この期間の活動(事実ベースの内訳)。前進とは重複しない別指標。 */}
          {((summary.itemsFarmed ?? 0) > 0 ||
            (summary.effortLaps ?? 0) > 0 ||
            (summary.skillDelta ?? 0) > 0 ||
            summary.growthTotal > 0) && (
            <div className="flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                {t('progress-activity-heading')}
              </div>
              {(summary.effortLaps ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground py-1">
                  {t('progress-effort-laps', {
                    count: Math.round(summary.effortLaps ?? 0).toLocaleString(),
                  })}
                </div>
              )}
              {(summary.itemsFarmed ?? 0) > 0 && (
                <Row
                  label={t('progress-items-farmed')}
                  value={`+${(summary.itemsFarmed ?? 0).toLocaleString()}`}
                  highlight
                />
              )}
              {(summary.skillDelta ?? 0) > 0 && (
                <Row
                  label={t('progress-skill-delta')}
                  value={`+${(summary.skillDelta ?? 0).toLocaleString()}`}
                  highlight
                />
              )}
              {summary.growthTotal > 0 && (
                <Row
                  label={t('progress-growth-total')}
                  value={`+${summary.growthTotal.toLocaleString()}`}
                  highlight
                />
              )}
            </div>
          )}

          {(summary.newServants?.length ?? 0) > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">
                {t('progress-new-servants', { count: summary.newServants.length })}
              </div>
              <ul className="text-sm flex flex-col gap-1">
                {summary.newServants.slice(0, 5).map((s) => (
                  <li
                    key={s.servantId}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="u-face-frame shrink-0"
                        style={{ width: 28, height: 28 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={servantFaceUrl(s.servantId)}
                          alt={s.servantName ?? s.servantId}
                          loading="lazy"
                        />
                      </span>
                      <span className="truncate">
                        {s.servantName ?? `#${s.servantId}`}
                      </span>
                    </span>
                    <span
                      className="tabular-nums text-[11px] font-semibold shrink-0"
                      style={{ color: 'var(--gold)' }}
                    >
                      NEW
                    </span>
                  </li>
                ))}
                {summary.newServants.length > 5 && (
                  <li className="text-[11px] text-muted-foreground">
                    {t('progress-new-servants-more', { count: summary.newServants.length - 5 })}
                  </li>
                )}
              </ul>
            </div>
          )}

          {summary.servantGrowth.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">
                {t('progress-servant-growth', { count: summary.servantGrowth.length })}
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
                      {t('progress-servant-growth-delta', { count: g.delta })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground mt-2">
            {t('progress-elapsed-minutes', { count: summary.elapsedMinutes })}
          </div>
        </>
      )}
    </div>
  )
}

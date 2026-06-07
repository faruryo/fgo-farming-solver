'use client'

import React from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { PeriodSummary, ProgressTier } from '../../lib/progress/types'
import { staticOrigin, region } from '../../constants/atlasacademy'

// サーヴァントの顔アイコンURL。Atlas の Faces 命名規則は f_<servantId * 10>.png。
const servantFaceUrl = (servantId: string): string =>
  `${staticOrigin}/${region}/Faces/f_${Number(servantId) * 10}.png`

// 「いつと比べて」のラベル。baseline は単一(約1ヶ月前に最も近いスナップショット)で
// 常に previous スロットに載るため、経過日数(昨日 / N日前)で時点を表す。
// week / month スロットは現在使用しない(後方互換のためのフォールバック表記のみ残置)。
const compareLabel = (summary: PeriodSummary): string => {
  if (summary.period === 'previous') {
    const days = Math.round(summary.elapsedMinutes / 1440)
    if (days <= 0) return '今日'
    if (days === 1) return '昨日'
    return `${days}日前`
  }
  return summary.period === 'week' ? '1週間前' : '1ヶ月前'
}

// 見出しの上に出す比較基準キャプション。例:「1週間前と比べて」「2日前と比べて」
const CompareCaption: React.FC<{ summary: PeriodSummary }> = ({ summary }) => (
  <div className="text-xs text-muted-foreground">{compareLabel(summary)}と比べて</div>
)

const TIER_STYLES: Record<
  ProgressTier,
  { bg: string; border: string; label: string }
> = {
  large: {
    bg: 'linear-gradient(135deg, rgba(217,176,68,0.25), rgba(217,176,68,0.06))',
    border: '#d9b044',
    label: '大きな進捗！',
  },
  medium: {
    bg: 'rgba(96,200,144,0.12)',
    border: '#60c890',
    label: '着実な前進',
  },
  small: {
    bg: 'rgba(120,150,200,0.10)',
    border: '#7896c8',
    label: '少しずつ',
  },
  none: {
    bg: 'rgba(180,180,180,0.08)',
    border: '#888',
    label: 'お疲れさまでした',
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
          <CompareCaption summary={summary} />

          {/* 主役: 目標への前進(AP)。周回/費用は同じ前進の単位換算なので小さく内訳表示。 */}
          {typeof summary.reducedAp === 'number' && summary.reducedAp > 0 && (
            <div>
              <div className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
                目標への前進
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
                    目標達成に必要な残りが、アイテム入手でどれだけ減ったかの試算です。AP・費用は「消費AP最小」、周回数は「周回数最小」という別々の周回プランで計算するため結果がずれることがあり、周回数が減っていない場合は表示しません。
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                className="text-2xl font-bold tabular-nums leading-tight"
                style={{ color: style.border }}
              >
                +{Math.round(summary.reducedAp).toLocaleString()}
                <span className="text-sm font-semibold ml-1">AP相当</span>
              </div>
              {(() => {
                const parts = [
                  typeof summary.reducedLap === 'number' &&
                  summary.reducedLap > 0
                    ? `周回 ${Math.round(summary.reducedLap).toLocaleString()}周`
                    : null,
                  typeof summary.reducedYen === 'number'
                    ? `費用 ¥${Math.round(summary.reducedYen).toLocaleString()}`
                    : null,
                ].filter(Boolean)
                return parts.length ? (
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {parts.join(' ・ ')} 相当
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* この期間の活動(事実ベースの内訳)。AP前進とは重複しない別指標。 */}
          {((summary.itemsFarmed ?? 0) > 0 ||
            (summary.skillDelta ?? 0) > 0 ||
            summary.growthTotal > 0) && (
            <div className="flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                この期間の活動
              </div>
              {(summary.itemsFarmed ?? 0) > 0 && (
                <Row
                  label="獲得素材"
                  value={`+${(summary.itemsFarmed ?? 0).toLocaleString()}`}
                  highlight
                />
              )}
              {(summary.skillDelta ?? 0) > 0 && (
                <Row
                  label="スキル合計"
                  value={`+${(summary.skillDelta ?? 0).toLocaleString()}`}
                  highlight
                />
              )}
              {summary.growthTotal > 0 && (
                <Row
                  label="育成総量"
                  value={`+${summary.growthTotal.toLocaleString()}`}
                  highlight
                />
              )}
            </div>
          )}

          {(summary.newServants?.length ?? 0) > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">
                新しい仲間 ({summary.newServants.length} 騎)
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
                    ほか {summary.newServants.length - 5} 騎
                  </li>
                )}
              </ul>
            </div>
          )}

          {summary.servantGrowth.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">
                サーヴァント成長 ({summary.servantGrowth.length} 騎)
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
                      +{g.delta} 育成
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

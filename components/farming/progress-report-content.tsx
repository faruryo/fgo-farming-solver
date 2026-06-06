'use client'

import React from 'react'
import type { PeriodSummary, ProgressTier } from '../../lib/progress/types'

// 「いつと比べて」のラベル。
// previous は「前回」だと時点が曖昧なので経過日数(昨日 / N日前)で表す。
// week / month はバケット名そのまま。
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
          {(() => {
            const farmed = summary.itemsFarmed ?? 0
            const consumed = summary.itemsConsumed ?? 0
            const hasThroughput = farmed > 0 || consumed > 0
            // 見出し(ヒーロー)は活動量(素材スループット)を主役にする。
            // 活動が無ければ reducedAp(参考)→育成総量の順でフォールバック。
            if (hasThroughput) {
              const parts = [
                farmed > 0 ? `獲得 +${farmed.toLocaleString()}` : null,
                consumed > 0 ? `育成投入 ${consumed.toLocaleString()}` : null,
              ].filter(Boolean)
              return (
                <div>
                  <CompareCaption summary={summary} />
                  <div
                    className={`${style.numSize} font-bold tabular-nums`}
                    style={{ color: style.border }}
                  >
                    素材 {parts.join(' / ')}
                  </div>
                </div>
              )
            }
            if (typeof summary.reducedAp === 'number' && summary.reducedAp > 0) {
              return (
                <div>
                  <CompareCaption summary={summary} />
                  <div
                    className={`${style.numSize} font-bold tabular-nums`}
                    style={{ color: style.border }}
                  >
                    残りAP −{Math.round(summary.reducedAp).toLocaleString()}
                  </div>
                </div>
              )
            }
            if (summary.growthTotal > 0) {
              return (
                <div>
                  <CompareCaption summary={summary} />
                  <div
                    className={`${style.numSize} font-bold tabular-nums`}
                    style={{ color: style.border }}
                  >
                    育成 +{summary.growthTotal.toLocaleString()}
                  </div>
                </div>
              )
            }
            return null
          })()}

          <div className="flex flex-col">
            {(summary.itemsFarmed ?? 0) > 0 && (
              <Row
                label="獲得素材"
                value={`+${(summary.itemsFarmed ?? 0).toLocaleString()}`}
                highlight
              />
            )}
            {(summary.itemsConsumed ?? 0) > 0 && (
              <Row
                label="育成投入(消費素材)"
                value={`${(summary.itemsConsumed ?? 0).toLocaleString()}`}
                highlight
              />
            )}
            {typeof summary.reducedAp === 'number' && summary.reducedAp > 0 && (
              <>
                <Row
                  label="アイテム入手による残りAPの減少(参考)"
                  value={`−${Math.round(summary.reducedAp).toLocaleString()}`}
                />
                {typeof summary.reducedLap === 'number' && (
                  <Row
                    label="残り周回数の減少"
                    value={`−${Math.round(summary.reducedLap).toLocaleString()}`}
                  />
                )}
                {typeof summary.reducedYen === 'number' && (
                  <Row
                    label="残り費用の減少"
                    value={`−¥${Math.round(summary.reducedYen).toLocaleString()}`}
                  />
                )}
              </>
            )}
            {summary.growthTotal > 0 && (
              <Row
                label="育成総量"
                value={`+${summary.growthTotal.toLocaleString()}`}
                highlight
              />
            )}
            {summary.newServantCount > 0 && (
              <Row
                label="新しい仲間"
                value={`${summary.newServantCount}騎`}
                highlight
              />
            )}
          </div>

          {(summary.newServants?.length ?? 0) > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">
                新しい仲間 ({summary.newServants.length} 騎)
              </div>
              <ul className="text-sm flex flex-col gap-0.5">
                {summary.newServants.slice(0, 5).map((s) => (
                  <li
                    key={s.servantId}
                    className="flex justify-between gap-3"
                  >
                    <span className="truncate">
                      {s.servantName ?? `#${s.servantId}`}
                    </span>
                    <span
                      className="tabular-nums text-[11px] font-semibold"
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

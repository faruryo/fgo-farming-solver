'use client'

import React from 'react'
import NextLink from 'next/link'
import { ChevronRight, ExternalLink, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { DashboardEvent } from '../../lib/master-data/types'
import type { Quest } from '../../interfaces/api'
import { formatDuration } from '../../lib/format-duration'
import { resolveCampaignDetail, summarizeCampaignEffects } from '../../lib/campaign-detail'
import { isPodFreeCampaignEvent } from '../../lib/campaign-category'
import { useDrops } from '../../hooks/use-drops'
import { useDashboardMeta } from '../../hooks/use-dashboard-meta'
import { questConsumesPod } from '../../lib/quest-consumes-pod'

interface Props {
  event: DashboardEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PERIOD_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const formatTimestamp = (sec: number) =>
  new Date(sec * 1000).toLocaleString('ja-JP', PERIOD_FORMAT)

export const CampaignDetailDialog: React.FC<Props> = ({ event, open, onOpenChange }) => {
  const { quests = [], campaigns = [] } = useDrops()
  const { data: dashboardMeta } = useDashboardMeta()

  if (!event) return null

  const detail = resolveCampaignDetail(event, dashboardMeta?.podFreePeriods, campaigns)
  const effects = summarizeCampaignEffects(event)
  const isPodFree = isPodFreeCampaignEvent(event)
  const targetQuests: Quest[] = detail.questIds
    .map(id => quests.find(q => q.id === id))
    .filter((q): q is Quest => Boolean(q))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-2">
            {isPodFree && (
              <Zap size={18} strokeWidth={2.5} fill="#60c890" style={{ color: '#60c890', flexShrink: 0, marginTop: 2 }} />
            )}
            <DialogTitle className="text-[15px] leading-snug">{event.name}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text2)' }}>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-[10px]">{formatDuration(event.endedAt)}</Badge>
            <span style={{ color: 'var(--text3)' }}>
              {formatTimestamp(event.startedAt)} 〜 {formatTimestamp(event.endedAt)}
            </span>
          </div>
        </div>

        {effects.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text3)' }}>効果</p>
            <ul className="flex flex-col gap-0.5 text-[12px]" style={{ color: 'var(--navy)' }}>
              {effects.map((line, i) => (
                <li key={i}>・{line}</li>
              ))}
            </ul>
          </div>
        )}
        {isPodFree && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text3)' }}>効果</p>
            <p className="text-[12px]" style={{ color: 'var(--navy)' }}>
              対象クエストでストーム・ポッドの消費が 0 になります。期間中はポッド上限を気にせず周回できます。
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text3)' }}>
              対象クエスト
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
              {typeof event.campaignQuestsCount === 'number'
                ? `${targetQuests.length > 0 ? targetQuests.length + ' / ' : ''}${event.campaignQuestsCount} 件`
                : ''}
            </p>
          </div>
          {detail.kind === 'noData' ? (
            <NoDataState event={event} />
          ) : targetQuests.length === 0 ? (
            <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
              対象クエストの詳細はマスターデータ未掲載 (上位ドロップに含まれない場合) です。
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {targetQuests.slice(0, 20).map(q => {
                const consumesPod = questConsumesPod(q.area)
                return (
                  <li key={q.id}>
                    <NextLink
                      href={`/quests/${q.id}`}
                      className="u-fgo-card flex items-center gap-2 rounded-md px-3 py-2 transition-all hover:-translate-y-0.5"
                      style={{ background: 'var(--panel2)' }}
                      onClick={() => onOpenChange(false)}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-[9px]" style={{ color: 'var(--text3)' }}>{q.area}</span>
                        <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--navy)' }}>
                          {q.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text3)' }}>AP {q.ap}</span>
                        {consumesPod && isPodFree && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#60c890' }}>
                            <Zap size={10} strokeWidth={2.5} fill="#60c890" />×0
                          </span>
                        )}
                        <ChevronRight size={14} style={{ color: 'var(--text3)' }} />
                      </div>
                    </NextLink>
                  </li>
                )
              })}
              {targetQuests.length > 20 && (
                <li className="text-[11px] pt-1" style={{ color: 'var(--text3)' }}>
                  ほか {targetQuests.length - 20} 件
                </li>
              )}
            </ul>
          )}
        </div>

        <a
          href={`https://apps.atlasacademy.io/db/JP/event/${event.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] underline self-start"
          style={{ color: 'var(--text3)' }}
        >
          Atlas Academy でこのイベントを開く <ExternalLink size={11} />
        </a>
      </DialogContent>
    </Dialog>
  )
}

const NoDataState: React.FC<{ event: DashboardEvent }> = ({ event }) => (
  <div className="rounded-md px-3 py-2 text-[11px]" style={{ background: 'var(--panel2)', color: 'var(--text3)' }}>
    {typeof event.campaignQuestsCount === 'number' && event.campaignQuestsCount > 0
      ? `対象 ${event.campaignQuestsCount} クエストの詳細はこのアプリ側の絞り込みデータには含まれていません。`
      : 'このキャンペーンは特定クエストを指定しません (通常クエスト全体に適用される可能性があります)。'}
    <br />
    詳細は Atlas Academy のイベントページで確認できます。
  </div>
)

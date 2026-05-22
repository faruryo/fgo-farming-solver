'use client'

import React from 'react'
import NextLink from 'next/link'
import { ChevronRight, ExternalLink, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { DashboardEvent } from '../../lib/master-data/types'
import type { Quest } from '../../interfaces/fgodrop'
import { formatDuration } from '../../lib/format-duration'
import { resolveCampaignDetail, summarizeCampaignEffects } from '../../lib/campaign-detail'
import { isPodFreeCampaignEvent } from '../../lib/campaign-category'
import { useDrops } from '../../hooks/use-drops'
import { useDashboardMeta } from '../../hooks/use-dashboard-meta'
import { questConsumesPod } from '../../lib/quest-consumes-pod'

interface Props {
  events: DashboardEvent[]
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

export const CampaignDetailDialog: React.FC<Props> = ({ events, open, onOpenChange }) => {
  const { quests = [], campaigns = [] } = useDrops()
  const { data: dashboardMeta } = useDashboardMeta()

  if (events.length === 0) return null

  // 同名キャンペーン群を 1 つのモーダルで扱う。タイトルは共通の name を使う。
  const titleEvent = events[0]
  const isPodFree = isPodFreeCampaignEvent(titleEvent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-2">
            {isPodFree && (
              <Zap size={18} strokeWidth={2.5} fill="#60c890" style={{ color: '#60c890', flexShrink: 0, marginTop: 2 }} />
            )}
            <DialogTitle className="text-[15px] leading-snug">
              {titleEvent.name}
              {events.length > 1 && (
                <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text3)' }}>
                  × {events.length}
                </span>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        {isPodFree && (
          <p className="text-[12px]" style={{ color: 'var(--navy)' }}>
            対象クエストでストーム・ポッドの消費が 0 になります。期間中はポッド上限を気にせず周回できます。
          </p>
        )}

        {events.length > 1 ? (
          <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
            同名のキャンペーンが {events.length} 件開催中です。対象クエスト群や終了日時が異なります。下記で個別に確認できます。
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <CampaignSubCard
              key={event.id}
              event={event}
              isPodFree={isPodFree}
              quests={quests}
              campaigns={campaigns}
              podFreePeriods={dashboardMeta?.podFreePeriods}
              onQuestClick={() => onOpenChange(false)}
            />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

interface SubCardProps {
  event: DashboardEvent
  isPodFree: boolean
  quests: Quest[]
  campaigns: Parameters<typeof resolveCampaignDetail>[2]
  podFreePeriods: Parameters<typeof resolveCampaignDetail>[1]
  onQuestClick: () => void
}

const CampaignSubCard: React.FC<SubCardProps> = ({
  event,
  isPodFree,
  quests,
  campaigns,
  podFreePeriods,
  onQuestClick,
}) => {
  const detail = resolveCampaignDetail(event, podFreePeriods, campaigns)
  const effects = summarizeCampaignEffects(event)
  const targetQuests: Quest[] = detail.questIds
    .map(id => quests.find(q => q.id === id))
    .filter((q): q is Quest => Boolean(q))

  return (
    <li className="flex flex-col gap-2 rounded-md p-3" style={{ background: 'var(--panel2)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="destructive" className="text-[10px]">{formatDuration(event.endedAt)}</Badge>
        <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
          {formatTimestamp(event.startedAt)} 〜 {formatTimestamp(event.endedAt)}
        </span>
      </div>

      {effects.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-[11px]" style={{ color: 'var(--navy)' }}>
          {effects.map((line, i) => (
            <li key={i}>・{line}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
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
          <ul className="flex flex-col gap-1">
            {targetQuests.slice(0, 10).map(q => {
              const consumesPod = questConsumesPod(q.area)
              return (
                <li key={q.id}>
                  <NextLink
                    href={`/quests/${q.id}`}
                    className="u-fgo-card flex items-center gap-2 rounded-md px-3 py-1.5 transition-all hover:-translate-y-0.5"
                    style={{ background: 'var(--bg2)' }}
                    onClick={onQuestClick}
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
            {targetQuests.length > 10 && (
              <li className="text-[11px] pt-1" style={{ color: 'var(--text3)' }}>
                ほか {targetQuests.length - 10} 件
              </li>
            )}
          </ul>
        )}
      </div>

      <a
        href={`https://apps.atlasacademy.io/db/JP/event/${event.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[10px] underline self-start"
        style={{ color: 'var(--text3)' }}
      >
        Atlas Academy で確認 (#{event.id}) <ExternalLink size={10} />
      </a>
    </li>
  )
}

const NoDataState: React.FC<{ event: DashboardEvent }> = ({ event }) => (
  <div className="rounded-md px-3 py-2 text-[11px]" style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>
    {typeof event.campaignQuestsCount === 'number' && event.campaignQuestsCount > 0
      ? `対象 ${event.campaignQuestsCount} クエストの詳細はこのアプリ側の絞り込みデータには含まれていません。`
      : 'このキャンペーンは特定クエストを指定しません (通常クエスト全体に適用される可能性があります)。'}
    <br />
    詳細は Atlas Academy のイベントページで確認できます。
  </div>
)

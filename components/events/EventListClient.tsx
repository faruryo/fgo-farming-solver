'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronRight, FaBox } from 'react-icons/fa'
import { Link } from '../common/link'
import { PageHeader } from '../common/page-header'
import { Badge } from '@/components/ui/badge'
import type { EventSummaryWithFeatures } from '../../lib/event-features'

interface Props {
  events: EventSummaryWithFeatures[]
  updatedAt: number
}

export const formatDate = (unixSec: number): string => {
  const d = new Date(unixSec * 1000)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export const EventListClient: React.FC<Props> = ({ events }) => {
  const { t } = useTranslation('events')
  const [nowSec, setNowSec] = useState(0)
  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000))
  }, [])

  // nowSec=0（SSR/初回描画）時は時刻未確定。全件を「開催予定」に誤分類して
  // マウント後にフラッシュするのを防ぐため、確定するまで空にする。
  const activeEvents = nowSec === 0 ? [] : events.filter(e => e.startedAt <= nowSec && e.endedAt >= nowSec)
  // 終了済みは「最近終わったものが上」になるよう endedAt 降順（新しい順）で並べる。
  const endedEvents =
    nowSec === 0
      ? []
      : events.filter(e => e.endedAt < nowSec).sort((a, b) => b.endedAt - a.endedAt)
  const upcomingEvents = nowSec === 0 ? [] : events.filter(e => e.startedAt > nowSec)

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <PageHeader backLabel={t('ダッシュボードへ戻る')} en="EVENT PLANNER" title={t('event-list-title', 'イベント一覧')}>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              {t('event-list-description', 'イベントごとのボックス計画・料理作成などの計画ツールを開きます。')}
            </p>
          </PageHeader>

          {events.length === 0 && (
            <div
              className="rounded-lg p-8 text-center"
              style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
            >
              <FaBox className="mx-auto mb-3 opacity-40" size={32} />
              <p className="text-sm" style={{ color: 'var(--text3)' }}>
                {t('データなし')}
              </p>
            </div>
          )}

          {activeEvents.length > 0 && (
            <EventGroup
              title={t('開催中')}
              events={activeEvents}
              nowSec={nowSec}
              statusVariant="active"
            />
          )}

          {upcomingEvents.length > 0 && (
            <EventGroup
              title={t('開催予定')}
              events={upcomingEvents}
              nowSec={nowSec}
              statusVariant="upcoming"
            />
          )}

          {endedEvents.length > 0 && (
            <EventGroup
              title={t('終了済み')}
              events={endedEvents}
              nowSec={nowSec}
              statusVariant="ended"
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface GroupProps {
  title: string
  events: EventSummaryWithFeatures[]
  nowSec: number
  statusVariant: 'active' | 'ended' | 'upcoming'
}

const EventGroup: React.FC<GroupProps> = ({ title, events, nowSec, statusVariant }) => (
  <div className="flex flex-col gap-3">
    <div className="u-section-header">
      <h2 className="u-section-header-title">{title}</h2>
      <div className="u-section-header-line" />
    </div>
    <div className="flex flex-col gap-2">
      {events.map(event => (
        <EventCard
          key={event.id}
          event={event}
          nowSec={nowSec}
          statusVariant={statusVariant}
        />
      ))}
    </div>
  </div>
)

const FeatureBadges: React.FC<{ features: EventSummaryWithFeatures['features'] }> = ({ features }) => {
  const { t } = useTranslation('events')
  if (features.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {features.map(feature => (
        <Badge key={feature} variant="outline" className="text-[10px]">
          {feature === 'box' ? t('event-feature-box', 'ボックス計画') : t('event-feature-craft', '料理作成')}
        </Badge>
      ))}
    </div>
  )
}

interface CardProps {
  event: EventSummaryWithFeatures
  nowSec: number
  statusVariant: 'active' | 'ended' | 'upcoming'
}

const EventCard: React.FC<CardProps> = ({ event, nowSec, statusVariant }) => {
  const { t } = useTranslation('events')
  const daysRemaining =
    statusVariant === 'active'
      ? Math.ceil((event.endedAt - nowSec) / 86400)
      : null

  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: 'none' }}>
      <div
        className="u-fgo-card rounded-md px-4 py-3 flex items-center justify-between gap-3 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
        style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-9 h-9 rounded flex items-center justify-center"
            style={{ background: 'var(--panel)' }}
          >
            <FaBox size={14} style={{ color: 'var(--gold)' }} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text1)' }}>
              {event.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
              {formatDate(event.startedAt)} 〜 {formatDate(event.endedAt)}
            </p>
            <FeatureBadges features={event.features} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {statusVariant === 'active' && (
            <>
              <Badge variant="destructive" className="text-[10px]">
                {t('開催中')}
              </Badge>
              {daysRemaining !== null && daysRemaining >= 0 && (
                <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
                  {t('残りN日', { count: daysRemaining })}
                </span>
              )}
            </>
          )}
          {statusVariant === 'ended' && (
            <Badge variant="outline" className="text-[10px]" style={{ color: 'var(--text3)' }}>
              {t('終了')}
            </Badge>
          )}
          {statusVariant === 'upcoming' && (
            <Badge variant="secondary" className="text-[10px]">
              {t('開催予定')}
            </Badge>
          )}
          <FaChevronRight size={10} style={{ color: 'var(--text3)' }} />
        </div>
      </div>
    </Link>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft, FaChevronRight, FaBox } from 'react-icons/fa'
import { Link } from '../common/link'
import { Badge } from '@/components/ui/badge'
import type { EventPlannerEvent } from '../../lib/master-data/types'

interface Props {
  events: EventPlannerEvent[]
  updatedAt: number
}

const formatDate = (unixSec: number): string => {
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
  const endedEvents = nowSec === 0 ? [] : events.filter(e => e.endedAt < nowSec)
  const upcomingEvents = nowSec === 0 ? [] : events.filter(e => e.startedAt > nowSec)

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <div className="c-page-header">
            <div className="flex flex-col gap-2">
              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--text3)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                <FaChevronLeft size={11} /> {t('ダッシュボードへ戻る')}
              </Link>
              <div className="flex flex-col">
                <div className="c-page-en">EVENT PLANNER</div>
                <h1 className="c-page-title">{t('ロトイベント一覧')}</h1>
              </div>
              <p className="text-sm" style={{ color: 'var(--text3)' }}>
                {t('イベント一覧説明')}
              </p>
            </div>
          </div>

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
  events: EventPlannerEvent[]
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

interface CardProps {
  event: EventPlannerEvent
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
    <Link
      href={`/events/${event.id}`}
      style={{ textDecoration: 'none' }}
    >
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

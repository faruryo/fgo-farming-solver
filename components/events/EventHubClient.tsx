'use client'

import React, { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { Link } from '../common/link'
import { Badge } from '@/components/ui/badge'
import type { EventFeature } from '../../data/event-features'
import type { EventSummary } from '../../lib/event-features'
import type { EventPlannerEvent } from '../../lib/master-data/types'
import type { EnrichedItem } from '../../lib/get-items'
import { EventPlannerClient } from './EventPlannerClient'
import { EventCraftSection } from './EventCraftSection'
import { formatDate } from './EventListClient'

interface Props {
  summary: EventSummary
  boxEvent?: EventPlannerEvent
  items?: EnrichedItem[]
  features: EventFeature[]
}

const noopSubscribe = () => () => {}
// getSnapshot は連続呼び出しで同じ値を返す必要があるため分単位に丸める。SSR/hydration 中は 0（未判定）。
const getNowSec = () => Math.floor(Date.now() / 60_000) * 60

const StatusBadge: React.FC<{ summary: EventSummary }> = ({ summary }) => {
  const { t } = useTranslation('events')
  const nowSec = useSyncExternalStore(noopSubscribe, getNowSec, () => 0)
  const isActive = nowSec > 0 && summary.startedAt <= nowSec && summary.endedAt >= nowSec
  const isEnded = nowSec > 0 && summary.endedAt < nowSec
  if (isActive) return <Badge variant="destructive" className="text-[10px]">{t('開催中')}</Badge>
  if (isEnded) return <Badge variant="outline" className="text-[10px]">{t('終了')}</Badge>
  return <Badge variant="secondary" className="text-[10px]">{t('開催予定')}</Badge>
}

const Header: React.FC<{ summary: EventSummary; box?: EventPlannerEvent }> = ({ summary, box }) => {
  const { t } = useTranslation('events')
  return (
    <div className="c-page-header">
      <div className="flex flex-col gap-2">
        <Link
          href="/events"
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
          <FaChevronLeft size={11} /> {t('イベント一覧へ戻る')}
        </Link>
        <div className="flex flex-col">
          <div className="c-page-en">{t('event-planner-eyebrow', 'EVENT PLANNER')}</div>
          <h1 className="c-page-title">{summary.name}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge summary={summary} />
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            {formatDate(summary.startedAt)} 〜 {formatDate(summary.endedAt)}
          </span>
          {box && (
            <>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>
                {t('箱数', { count: box.lotteries.length })}
              </span>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>
                {box.currency.name}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-base font-semibold" style={{ color: 'var(--text1)' }}>
    {children}
  </h2>
)

export const EventHubClient: React.FC<Props> = ({ summary, boxEvent, items, features }) => {
  const { t } = useTranslation('events')
  const box = features.includes('box') ? boxEvent : undefined
  const craftItems = features.includes('craft') ? items : undefined

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <Header summary={summary} box={box} />

          {box && (
            <section className="flex flex-col gap-4">
              <SectionTitle>{t('ロト計画')}</SectionTitle>
              <EventPlannerClient event={box} />
            </section>
          )}

          {craftItems && (
            <section className="flex flex-col gap-4">
              <SectionTitle>{t('event-craft-section-title', '料理作成')}</SectionTitle>
              <EventCraftSection items={craftItems} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { DashboardEvent } from '../../lib/master-data/types'
import { formatDuration } from '../../lib/format-duration'
import { Link } from '../common/link'
import { FaBox } from 'react-icons/fa'
import { CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { buildEventShopTaskId } from '../../lib/todo/period'
import type { TodoTask } from '../../types/todo'

interface EventSectionProps {
  events: DashboardEvent[]
}

const EventCard: React.FC<{
  event: DashboardEvent
  isCompleted: boolean
}> = ({ event, isCompleted }) => {
  const { t } = useTranslation(['dashboard'])
  if (!event.banner) return null

  return (
    <div
      className="u-fgo-card rounded-md overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: 'var(--panel2)', opacity: isCompleted ? 0.8 : 1 }}
    >
      <div className="relative h-[110px]" style={{ background: 'var(--panel)' }}>
        <img
          src={event.banner}
          alt={event.name}
          className="w-full h-full object-cover object-center"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 px-3 py-1.5 flex items-center justify-between gap-2"
          style={{ background: 'linear-gradient(transparent, rgba(10,22,34,0.85))' }}
        >
          <p className="text-xs font-bold text-white truncate flex-1 min-w-0">{event.name}</p>
          {isCompleted && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30 flex-shrink-0">
              <CheckCircle2 size={10} />
              {t('completed-shop', '交換完了')}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive" className="text-[10px]">
              クエスト {formatDuration(event.endedAt)}
            </Badge>
            {event.shopFinishedAt && (
              <Badge variant="outline" className="text-[10px]">
                交換所 {formatDuration(event.shopFinishedAt)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {event.drops.length > 0 && (
              <div className="flex gap-2">
                {event.drops.slice(0, 8).map(drop => (
                  <Tooltip key={drop.id}>
                    <TooltipTrigger render={<span />}>
                      <div className="w-[22px] h-[22px] rounded overflow-hidden flex-shrink-0" style={{ background: 'var(--bg2)' }}>
                        <img src={drop.icon} alt={drop.name} className="w-full h-full" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{drop.name}</TooltipContent>
                  </Tooltip>
                ))}
                {event.drops.length > 8 && (
                  <span className="text-[10px]" style={{ color: 'var(--text3)' }}>+{event.drops.length - 8}</span>
                )}
              </div>
            )}
            {event.hasLottery && (
              <Link
                href={`/events/${event.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  background: 'var(--panel)',
                  color: 'var(--text3)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                <FaBox size={9} />
                {t('ロト計画')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const EventSection: React.FC<EventSectionProps> = ({ events }) => {
  const { t } = useTranslation(['dashboard'])
  const [hideCompleted, setHideCompleted] = useLocalStorage<boolean>(
    STORAGE_KEYS.DASHBOARD_HIDE_COMPLETED_EVENTS,
    false
  )
  const [expandedCompleted, setExpandedCompleted] = useState(false)
  const [todoState] = useLocalStorage<TodoTask[]>(STORAGE_KEYS.TODO_STATE, [])

  const bannerEvents = useMemo(() => events.filter(e => Boolean(e.banner)), [events])

  const completedMap = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const event of bannerEvents) {
      const taskId = buildEventShopTaskId(event.id)
      const isCompleted = todoState.some(task => task.id === taskId && task.completed)
      map.set(event.id, isCompleted)
    }
    return map
  }, [bannerEvents, todoState])

  const { activeEvents, completedEvents } = useMemo(() => {
    const active: DashboardEvent[] = []
    const completed: DashboardEvent[] = []
    for (const e of bannerEvents) {
      if (completedMap.get(e.id)) {
        completed.push(e)
      } else {
        active.push(e)
      }
    }
    return { activeEvents: active, completedEvents: completed }
  }, [bannerEvents, completedMap])

  if (bannerEvents.length === 0) return null

  const showAccordion = hideCompleted && completedEvents.length > 0
  const displayedEvents = hideCompleted ? activeEvents : bannerEvents

  return (
    <div className="flex flex-col gap-3">
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('開催中のイベント')}</h2>
        {completedEvents.length > 0 && (
          <button
            type="button"
            onClick={() => setHideCompleted(prev => !prev)}
            className="ml-auto text-[11px] font-semibold text-[color:var(--text3)] hover:text-[color:var(--gold)] transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
            title={t('hide-completed-events', '完了済みを非表示')}
          >
            {hideCompleted ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{t('hide-completed-events', '完了済みを非表示')}</span>
          </button>
        )}
        <div className="u-section-header-line" />
      </div>

      {displayedEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          isCompleted={Boolean(completedMap.get(event.id))}
        />
      ))}

      {showAccordion && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => setExpandedCompleted(prev => !prev)}
            className="flex items-center justify-between px-3 py-1.5 rounded text-xs font-semibold cursor-pointer border border-dashed border-border/60 hover:border-gold/50 text-text3 hover:text-gold transition-colors"
            style={{ background: 'var(--panel)' }}
          >
            <span>
              {expandedCompleted
                ? t('hide-completed-events-accordion', '完了済みのイベント（{{count}}件）を折りたたむ', { count: completedEvents.length })
                : t('show-completed-events', '完了済みのイベント（{{count}}件）を表示', { count: completedEvents.length })}
            </span>
            {expandedCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {expandedCompleted && completedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isCompleted={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}

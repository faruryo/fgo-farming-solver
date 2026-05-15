'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { DashboardEvent } from '../../lib/master-data/types'
import { formatDuration } from '../../lib/format-duration'

interface EventSectionProps {
  events: DashboardEvent[]
}

export const EventSection: React.FC<EventSectionProps> = ({ events }) => {
  const { t } = useTranslation(['dashboard'])

  if (events.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('開催中のイベント')}</h2>
        <div className="u-section-header-line" />
      </div>

      {events.map(event => (
        <div
          key={event.id}
          className="u-fgo-card rounded-md overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
          style={{ background: 'var(--panel2)' }}
        >
          <div className="relative h-[110px]" style={{ background: 'var(--panel)' }}>
            <img
              src={event.banner}
              alt={event.name}
              className="w-full h-full object-cover object-center"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 px-3 py-1.5"
              style={{ background: 'linear-gradient(transparent, rgba(10,22,34,0.85))' }}
            >
              <p className="text-xs font-bold text-white truncate">{event.name}</p>
            </div>
          </div>

          <div className="px-3 py-2">
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
              {event.drops.length > 0 && (
                <div className="flex gap-1">
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
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

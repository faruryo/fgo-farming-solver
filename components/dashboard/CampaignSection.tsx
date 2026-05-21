'use client'

import React, { useState } from 'react'
import { Zap, Flame, Wrench, Sparkles, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { DashboardEvent } from '../../lib/master-data/types'
import { formatDuration } from '../../lib/format-duration'
import { categorizeCampaignEvent, isPodFreeCampaignEvent, type CampaignCategory } from '../../lib/campaign-category'
import { CampaignDetailDialog } from './CampaignDetailDialog'

interface CampaignSectionProps {
  events: DashboardEvent[]
}

type CategorizedEvent = {
  event: DashboardEvent
  category: CampaignCategory
  isPodFree: boolean
}

const CATEGORY_LABEL: Record<CampaignCategory, string> = {
  farming: 'ファーミング直結',
  upgrade: '強化・育成',
  other: 'その他',
}

const CATEGORY_ORDER: CampaignCategory[] = ['farming', 'upgrade', 'other']

const CategoryIcon: React.FC<{ category: CampaignCategory }> = ({ category }) => {
  if (category === 'farming') return <Flame size={12} style={{ color: '#e89000' }} />
  if (category === 'upgrade') return <Wrench size={12} style={{ color: 'var(--gold)' }} />
  return <Sparkles size={12} style={{ color: 'var(--text3)' }} />
}

type RowClickHandler = (event: DashboardEvent) => void

const PodFreeHighlight: React.FC<{ event: DashboardEvent; onClick: RowClickHandler }> = ({ event, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(event)}
    className="u-fgo-card flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
    style={{
      borderLeft: '3px solid #60c890',
      background: 'linear-gradient(90deg, rgba(96,200,144,0.12), var(--panel2))',
    }}
    aria-label={`${event.name} の詳細を表示`}
  >
    <Zap size={20} strokeWidth={2.5} fill="#60c890" style={{ color: '#60c890', flexShrink: 0 }} />
    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
      <p className="text-[12px] font-bold truncate" style={{ color: 'var(--navy)' }}>{event.name}</p>
      <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
        対象クエストをポッド消費なしで回せます
      </p>
    </div>
    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
      <Badge variant="destructive" className="text-[10px]">
        {formatDuration(event.endedAt)}
      </Badge>
      {typeof event.campaignQuestsCount === 'number' && (
        <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
          対象 {event.campaignQuestsCount}件
        </span>
      )}
    </div>
    <ChevronRight size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
  </button>
)

const CampaignRow: React.FC<{ event: DashboardEvent; category: CampaignCategory; onClick: RowClickHandler }> = ({
  event,
  category,
  onClick,
}) => (
  <button
    type="button"
    onClick={() => onClick(event)}
    className="u-fgo-card flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
    style={{ background: 'var(--panel2)' }}
    aria-label={`${event.name} の詳細を表示`}
  >
    <CategoryIcon category={category} />
    <span className="text-[11px] font-semibold truncate flex-1 min-w-0" style={{ color: 'var(--navy)' }}>
      {event.name}
    </span>
    {typeof event.campaignQuestsCount === 'number' && event.campaignQuestsCount > 0 && (
      <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--text3)' }}>
        {event.campaignQuestsCount}件
      </span>
    )}
    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text3)' }}>
      {formatDuration(event.endedAt)}
    </span>
    <ChevronRight size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
  </button>
)

const CategoryHeader: React.FC<{ category: CampaignCategory }> = ({ category }) => (
  <div className="flex items-center gap-2 text-[9px] font-semibold tracking-wider uppercase" style={{ color: 'var(--text3)' }}>
    <div className="flex-1 h-px" style={{ background: 'rgba(154,114,36,0.25)' }} />
    <span>{CATEGORY_LABEL[category]}</span>
    <div className="flex-1 h-px" style={{ background: 'rgba(154,114,36,0.25)' }} />
  </div>
)

export const CampaignSection: React.FC<CampaignSectionProps> = ({ events }) => {
  const { t } = useTranslation(['dashboard'])
  const [selected, setSelected] = useState<DashboardEvent | null>(null)
  const [open, setOpen] = useState(false)

  const handleOpen: RowClickHandler = (event) => {
    setSelected(event)
    setOpen(true)
  }

  // banner なし questCampaign で campaigns を持つもの (CampaignSection の対象)
  const bannerless = events.filter(
    e => !e.banner && e.type === 'questCampaign' && (e.campaigns?.length ?? 0) > 0,
  )

  if (bannerless.length === 0) return null

  const categorized: CategorizedEvent[] = bannerless.map(event => ({
    event,
    category: categorizeCampaignEvent(event),
    isPodFree: isPodFreeCampaignEvent(event),
  }))

  const podFreeEvents = categorized.filter(c => c.isPodFree)
  const otherEvents = categorized.filter(c => !c.isPodFree)

  const byCategory: Record<CampaignCategory, CategorizedEvent[]> = {
    farming: [],
    upgrade: [],
    other: [],
  }
  for (const c of otherEvents) byCategory[c.category].push(c)
  for (const cat of CATEGORY_ORDER) {
    byCategory[cat].sort((a, b) => a.event.endedAt - b.event.endedAt)
  }
  podFreeEvents.sort((a, b) => a.event.endedAt - b.event.endedAt)

  return (
    <div className="flex flex-col gap-3">
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('開催中のキャンペーン')}</h2>
        <div className="u-section-header-line" />
      </div>

      {podFreeEvents.length > 0 && (
        <div className="flex flex-col gap-2">
          {podFreeEvents.map(c => (
            <PodFreeHighlight key={c.event.id} event={c.event} onClick={handleOpen} />
          ))}
        </div>
      )}

      {CATEGORY_ORDER.map(cat => {
        const list = byCategory[cat]
        if (list.length === 0) return null
        return (
          <div key={cat} className="flex flex-col gap-2">
            <CategoryHeader category={cat} />
            {list.map(c => (
              <CampaignRow key={c.event.id} event={c.event} category={cat} onClick={handleOpen} />
            ))}
          </div>
        )
      })}

      <CampaignDetailDialog event={selected} open={open} onOpenChange={setOpen} />
    </div>
  )
}

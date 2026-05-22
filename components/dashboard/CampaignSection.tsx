'use client'

import React, { useState } from 'react'
import { Zap, Flame, Wrench, Sparkles, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { DashboardEvent } from '../../lib/master-data/types'
import { formatDuration } from '../../lib/format-duration'
import { categorizeCampaignEvent, isPodFreeCampaignEvent, type CampaignCategory } from '../../lib/campaign-category'
import { groupCampaignsByName, type CampaignGroup, type CategorizedEvent } from '../../lib/campaign-grouping'
import { CampaignDetailDialog } from './CampaignDetailDialog'

interface CampaignSectionProps {
  events: DashboardEvent[]
}

type CategorizedEventWithPodFree = CategorizedEvent & { isPodFree: boolean }

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

type RowClickHandler = (events: DashboardEvent[]) => void

const PodFreeHighlight: React.FC<{ event: DashboardEvent; onClick: RowClickHandler }> = ({ event, onClick }) => (
  <button
    type="button"
    onClick={() => onClick([event])}
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

const GroupRow: React.FC<{ group: CampaignGroup; onClick: RowClickHandler }> = ({ group, onClick }) => {
  const groupSize = group.events.length
  return (
    <button
      type="button"
      onClick={() => onClick(group.events)}
      className="u-fgo-card flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ background: 'var(--panel2)' }}
      aria-label={`${group.name} の詳細を表示`}
    >
      <CategoryIcon category={group.category} />
      <span className="text-[11px] font-semibold truncate flex-1 min-w-0" style={{ color: 'var(--navy)' }}>
        {group.name}
      </span>
      {groupSize > 1 && (
        <span
          className="text-[9px] font-bold tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded"
          style={{ color: 'var(--gold)', background: 'rgba(154,114,36,0.12)' }}
          aria-label={`${groupSize} 個のグループ`}
        >
          ×{groupSize}
        </span>
      )}
      {group.totalQuests > 0 && (
        <span className="text-[9px] tabular-nums flex-shrink-0" style={{ color: 'var(--text3)' }}>
          {group.totalQuests}件
        </span>
      )}
      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text3)' }}>
        {formatDuration(group.earliestEndedAt)}
      </span>
      <ChevronRight size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
    </button>
  )
}

const CategoryHeader: React.FC<{ category: CampaignCategory }> = ({ category }) => (
  <div className="flex items-center gap-2 text-[9px] font-semibold tracking-wider uppercase" style={{ color: 'var(--text3)' }}>
    <div className="flex-1 h-px" style={{ background: 'rgba(154,114,36,0.25)' }} />
    <span>{CATEGORY_LABEL[category]}</span>
    <div className="flex-1 h-px" style={{ background: 'rgba(154,114,36,0.25)' }} />
  </div>
)

export const CampaignSection: React.FC<CampaignSectionProps> = ({ events }) => {
  const { t } = useTranslation(['dashboard'])
  const [selected, setSelected] = useState<DashboardEvent[]>([])
  const [open, setOpen] = useState(false)

  const handleOpen: RowClickHandler = (eventList) => {
    setSelected(eventList)
    setOpen(true)
  }

  // banner なし questCampaign で campaigns を持つもの (CampaignSection の対象)
  const bannerless = events.filter(
    e => !e.banner && e.type === 'questCampaign' && (e.campaigns?.length ?? 0) > 0,
  )

  if (bannerless.length === 0) return null

  const categorized: CategorizedEventWithPodFree[] = bannerless.map(event => ({
    event,
    category: categorizeCampaignEvent(event),
    isPodFree: isPodFreeCampaignEvent(event),
  }))

  const podFreeEvents = categorized.filter(c => c.isPodFree)
  const otherEvents = categorized.filter(c => !c.isPodFree)

  // 同名キャンペーンをグループ化 (Atlas が対象 quest 群ごとに別 event を作るため)
  const groupsByCategory: Record<CampaignCategory, CampaignGroup[]> = {
    farming: [],
    upgrade: [],
    other: [],
  }
  for (const cat of CATEGORY_ORDER) {
    const inCat = otherEvents.filter(c => c.category === cat)
    groupsByCategory[cat] = groupCampaignsByName(inCat).sort(
      (a, b) => a.earliestEndedAt - b.earliestEndedAt,
    )
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
        const groups = groupsByCategory[cat]
        if (groups.length === 0) return null
        return (
          <div key={cat} className="flex flex-col gap-2">
            <CategoryHeader category={cat} />
            {groups.map(g => (
              <GroupRow key={g.name} group={g} onClick={handleOpen} />
            ))}
          </div>
        )
      })}

      <CampaignDetailDialog events={selected} open={open} onOpenChange={setOpen} />
    </div>
  )
}

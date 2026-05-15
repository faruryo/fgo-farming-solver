'use client'

import React, { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import NextLink from 'next/link'
import { useTranslation } from 'react-i18next'
import { useDrops } from '../../hooks/use-drops'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { getItemIconUrl } from '../../lib/get-item-icon-url'
import { useRecentResult } from '../../hooks/use-recent-result'
import { isBothResult, Quest } from '../../interfaces/api'

export const RecommendedQuest: React.FC = () => {
  const { t } = useTranslation(['dashboard'])
  const [chaldea] = useLocalStorage<ChaldeaState>('material', {})
  const { items, quests, drop_rates, isLoading: dropsLoading } = useDrops()
  const { result: recentResult, loading: resultLoading } = useRecentResult()

  const recommendations = useMemo(() => {
    if (dropsLoading || !items || !items.length || !quests || !drop_rates) return []

    if (recentResult) {
      const targetQuests = isBothResult(recentResult) ? recentResult.lap.quests : recentResult.quests
      const targetItems = isBothResult(recentResult) ? recentResult.lap.items : recentResult.items
      const targetDropRates = isBothResult(recentResult) ? recentResult.lap.drop_rates : recentResult.drop_rates

      if (targetQuests && targetQuests.length > 0) {
        return targetQuests
          .sort((a, b) => {
            const getPriority = (q: Quest) => {
              if (q.area?.includes('冠位研鑽戦')) return 1
              if (q.area?.includes('オーディール・コール')) return 2
              return 3
            }
            const pa = getPriority(a), pb = getPriority(b)
            if (pa !== pb) return pa - pb
            return b.lap - a.lap
          })
          .slice(0, 4)
          .map((q: Quest) => {
            const relatedRates = targetDropRates.filter(dr => dr.quest_id === q.id)
            const bestRate = relatedRates
              .filter(dr => targetItems.some(ti => ti.id === dr.item_id))
              .sort((a, b) => b.drop_rate - a.drop_rate)[0] || relatedRates[0]
            const item = items.find(i => i.id === bestRate?.item_id)
            return { id: q.id, item, quest: q, rate: bestRate?.drop_rate, lap: q.lap, isRecent: true }
          })
      }
    }

    const targetServantIds = Object.keys(chaldea)
    if (targetServantIds.length === 0) return []

    return items.slice(0, 3).map(item => {
      const bestRate = drop_rates.filter(dr => dr.item_id === item.id).sort((a, b) => b.drop_rate - a.drop_rate)[0]
      const quest = bestRate ? quests.find(q => q.id === bestRate.quest_id) : null
      return { id: quest?.id || item.id, item, quest, rate: bestRate?.drop_rate, lap: 0, isRecent: false }
    }).filter(r => r.quest)
  }, [items, quests, drop_rates, chaldea, dropsLoading, recentResult])

  if (dropsLoading || resultLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="u-section-header">
          <h2 className="u-section-header-title">{t('推奨周回クエスト')}</h2>
          <div className="u-section-header-line" />
        </div>
        <div className="p-4 text-center">
          <Loader2 className="animate-spin mx-auto" style={{ color: 'var(--gold)' }} />
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="u-section-header">
        <h2 className="u-section-header-title">
          {recentResult ? t('直近の周回予定') : t('推奨周回クエスト')}
        </h2>
        <div className="u-section-header-line" />
      </div>

      <div className="flex flex-col gap-3">
        {recommendations.map(({ id, item, quest, rate, lap, isRecent }) => (
          <NextLink
            key={id}
            href={`/quests/${quest?.id}`}
            className="u-fgo-card flex items-start gap-3 py-2 px-3 rounded-md transition-all duration-200 cursor-pointer no-underline hover:no-underline hover:-translate-y-0.5"
            style={{ background: 'var(--panel2)' }}
          >
            <div className="w-9 h-9 flex-shrink-0 mt-0.5">
              {item && (
                <img src={getItemIconUrl(item.icon)} alt={item.name} className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {item && (
                <p className="text-[10px] truncate" style={{ color: 'var(--text3)' }}>
                  {isRecent ? t('主なドロップ') : t('不足素材')}: {item.name}
                </p>
              )}
              <p className="text-sm font-bold truncate" style={{ color: 'var(--navy)' }}>{quest?.name}</p>
              <div className="flex flex-wrap gap-2 mt-0.5">
                <span className="text-[10px]" style={{ color: 'var(--text2)' }}>{quest?.area}</span>
                <span className="text-[10px]" style={{ color: 'var(--text3)' }}>{quest?.ap} AP</span>
                {lap ? (
                  <Badge className="text-[10px] bg-blue-500 text-white">{lap} {t('周')}</Badge>
                ) : (
                  <Badge className="text-[10px] bg-green-600 text-white">{Math.round((rate || 0) * 100)}%</Badge>
                )}
              </div>
            </div>
          </NextLink>
        ))}
      </div>
    </div>
  )
}

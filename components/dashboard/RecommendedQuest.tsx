'use client'

import React, { useMemo } from 'react'
import { Loader2, Info } from 'lucide-react'
import NextLink from 'next/link'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { QuestIdentity } from '../common/QuestIdentity'
import { ItemIdentity } from '../common/ItemIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { useRecentResult } from '../../hooks/use-recent-result'
import { useSpotIcons } from '../../hooks/use-spot-icons'
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
            const topRates = relatedRates
              .filter(dr => targetItems.some(ti => ti.id === dr.item_id))
              .sort((a, b) => b.drop_rate - a.drop_rate)
              .slice(0, 5)
            const topItems = topRates
              .map(dr => items.find(i => i.id === dr.item_id))
              .filter((x): x is NonNullable<typeof x> => Boolean(x))
            const bestRate = topRates[0] || relatedRates[0]
            return { id: q.id, topItems, quest: q, rate: bestRate?.drop_rate, lap: q.lap, isRecent: true }
          })
      }
    }

    const targetServantIds = Object.keys(chaldea)
    if (targetServantIds.length === 0) return []

    return items.slice(0, 3).map(item => {
      const bestRate = drop_rates.filter(dr => dr.item_id === item.id).sort((a, b) => b.drop_rate - a.drop_rate)[0]
      const quest = bestRate ? quests.find(q => q.id === bestRate.quest_id) : null
      const questDrops = quest
        ? drop_rates
            .filter(dr => dr.quest_id === quest.id)
            .sort((a, b) => b.drop_rate - a.drop_rate)
            .slice(0, 5)
            .map(dr => items.find(i => i.id === dr.item_id))
            .filter((x): x is NonNullable<typeof x> => Boolean(x))
        : [item]
      return { id: quest?.id || item.id, topItems: questDrops, quest, rate: bestRate?.drop_rate, lap: 0, isRecent: false }
    }).filter(r => r.quest)
  }, [items, quests, drop_rates, chaldea, dropsLoading, recentResult])

  // aaQuestId comes from drops quests (result quests may not carry it)
  const spotIcons = useSpotIcons(
    recommendations.map(r => {
      if (!r.quest) return null
      const aaQuestId = r.quest.aaQuestId ?? quests?.find(q => q.id === r.quest!.id)?.aaQuestId
      return { id: r.quest.id, aaQuestId }
    })
  )

  if (dropsLoading || resultLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="u-section-header">
          <h2 className="u-section-header-title">{t('周回予定クエスト')}</h2>
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
          {recentResult ? t('周回予定クエスト') : t('推奨周回クエスト')}
        </h2>
        <Tooltip>
          <TooltipTrigger className="flex-shrink-0 -ml-2 cursor-default" style={{ color: 'var(--text3)' }}>
            <Info size={13} />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-left leading-relaxed">
            {recentResult
              ? '直近の計算結果のクエスト Top 4。優先順：冠位研鑽戦 → オーディール・コール → その他。同優先度内は予定周回数が多い順。'
              : '不足素材ごとに最もドロップ率の高いクエスト Top 4。'}
          </TooltipContent>
        </Tooltip>
        <div className="u-section-header-line" />
      </div>

      <div className="flex flex-col gap-3">
        {recommendations.map(({ id, topItems, quest, rate, lap }, index) => (
          <NextLink
            key={id}
            href={`/quests/${quest?.id}`}
            className="u-fgo-card flex items-center gap-2 py-3 px-4 rounded-md transition-all duration-200 cursor-pointer no-underline hover:no-underline hover:-translate-y-0.5"
            style={{ borderLeft: '3px solid var(--gold)' }}
          >
            <span className="w-3 text-[11px] font-bold tabular-nums select-none text-right flex-shrink-0" style={{ color: 'var(--text3)' }}>
              {index + 1}
            </span>

            <QuestIdentity
              area={quest?.area ?? ''}
              name={quest?.name ?? ''}
              ap={quest?.ap ?? 0}
              spotIcon={quest?.id ? spotIcons[quest.id] : undefined}
              className="flex-1"
            />

            {/* ドロップアイコン: スマホ1個、PC最大5個 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {topItems[0] && (
                <ItemIdentity icon={topItems[0].icon} name={topItems[0].name} size={22} />
              )}
              {topItems.slice(1, 5).map((item) => (
                <ItemIdentity key={item.id} icon={item.icon} name={item.name} size={22} className="hidden sm:flex" />
              ))}
            </div>

            {/* 区切り線 */}
            <div className="self-stretch w-px flex-shrink-0 mx-1" style={{ background: 'rgba(154,114,36,0.15)' }} />

            <p className="text-[10px] font-semibold flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--gold)' }}>
              {lap ? `あと${lap}周で達成！` : `ドロップ率 ${Math.round((rate || 0) * 100)}%`}
            </p>
          </NextLink>
        ))}
      </div>
    </div>
  )
}

'use client'

import React, { useMemo } from 'react'
import NextLink from 'next/link'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ItemIdentity } from '../common/ItemIdentity'
import { QuestIdentity } from '../common/QuestIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useRecentResult } from '../../hooks/use-recent-result'
import { useSpotIcons } from '../../hooks/use-spot-icons'
import { isBothResult } from '../../interfaces/api'

export const NearGoalSection: React.FC = () => {
  const { items: dropItems, quests: dropQuests, isLoading: dropsLoading } = useDrops()
  const { result: recentResult, loading: resultLoading } = useRecentResult()

  const nearGoalEntries = useMemo(() => {
    if (!recentResult || !dropItems?.length) return []

    const result = isBothResult(recentResult) ? recentResult.lap : recentResult
    const { quests: targetQuests, drop_rates: targetDropRates, items: targetItems, params } = result

    if (!targetQuests?.length || !targetItems?.length) return []

    const maxLap = Math.max(...targetQuests.map(q => q.lap))
    const threshold = Math.max(50, maxLap * 0.3)

    return targetItems
      .flatMap(ti => {
        const needed = params.items[ti.id] ?? 0
        if (needed <= 0) return []

        const best = targetDropRates
          .filter(dr => dr.item_id === ti.id && dr.drop_rate > 0)
          .map(dr => {
            const quest = targetQuests.find(q => q.id === dr.quest_id)
            if (!quest) return null
            return { quest, lapsNeeded: Math.ceil(needed / dr.drop_rate) }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort((a, b) => a.lapsNeeded - b.lapsNeeded)[0]

        if (!best || best.lapsNeeded > threshold) return []

        const displayItem = dropItems.find(i => i.id === ti.id)
        if (!displayItem) return []

        return [{ item: displayItem, quest: best.quest, needed, lapsNeeded: best.lapsNeeded }]
      })
      .sort((a, b) => a.lapsNeeded - b.lapsNeeded)
      .slice(0, 4)
  }, [dropItems, recentResult])

  // drops側のquestからaaQuestIdを補完してspot画像を取得
  const spotIcons = useSpotIcons(
    nearGoalEntries.map(({ quest }) => {
      const aaQuestId = dropQuests?.find(q => q.id === quest.id)?.aaQuestId
      return { id: quest.id, aaQuestId }
    })
  )

  if (dropsLoading || resultLoading || nearGoalEntries.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="u-section-header">
        <h2 className="u-section-header-title">達成間近の素材</h2>
        <Tooltip>
          <TooltipTrigger className="flex-shrink-0 -ml-2 cursor-default" style={{ color: 'var(--text3)' }}>
            <Info size={13} />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-left leading-relaxed">
            直近の計算結果から、残り周回数が最も少ない素材の Top 4。残り周回数が少ない順（達成が近い順）でランキング。
          </TooltipContent>
        </Tooltip>
        <div className="u-section-header-line" />
      </div>
      <div className="flex flex-col gap-3">
        {nearGoalEntries.map(({ item, quest, needed, lapsNeeded }, index) => {
          const isVeryClose = lapsNeeded <= 10
          const accentColor = isVeryClose ? '#60c890' : 'var(--gold)'
          return (
            <NextLink
              key={item.id}
              href={`/quests/${quest.id}`}
              className="u-fgo-card flex items-center gap-2 py-3 px-4 rounded-md transition-all duration-200 no-underline hover:no-underline hover:-translate-y-0.5"
              style={{ borderLeft: `3px solid ${accentColor}` }}
            >
              <span className="w-3 text-[11px] font-bold tabular-nums select-none text-right flex-shrink-0" style={{ color: 'var(--text3)' }}>
                {index + 1}
              </span>

              <ItemIdentity icon={item.icon} name={item.name} className="flex-shrink-0" />

              {/* 区切り線 */}
              <div className="self-stretch w-px flex-shrink-0 mx-1" style={{ background: 'rgba(154,114,36,0.15)' }} />

              {/* QuestIdentity を横1行で配置（②AP位置修正・①高さ統一） */}
              <QuestIdentity
                area={quest.area}
                name={quest.name}
                ap={quest.ap}
                spotIcon={spotIcons[quest.id]}
                className="flex-1 min-w-0"
              />

              {/* 達成カウント（右端） */}
              <div className="flex-shrink-0 text-right">
                <p className="text-[10px] font-semibold" style={{ color: accentColor }}>
                  あと{lapsNeeded}周で達成！
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
                  あと{needed}個
                </p>
              </div>
            </NextLink>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import React, { useMemo } from 'react'
import Image from 'next/image'
import NextLink from 'next/link'
import { useDrops } from '../../hooks/use-drops'
import { useRecentResult } from '../../hooks/use-recent-result'
import { isBothResult } from '../../interfaces/api'
import { getItemIconUrl } from '../../lib/get-item-icon-url'

export const NearGoalSection: React.FC = () => {
  const { items: dropItems, isLoading: dropsLoading } = useDrops()
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

  if (dropsLoading || resultLoading || nearGoalEntries.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="u-section-header">
        <h2 className="u-section-header-title">もうすぐ達成！</h2>
        <div className="u-section-header-line" />
      </div>
      <div className="flex flex-col gap-3">
        {nearGoalEntries.map(({ item, quest, needed, lapsNeeded }) => {
          const isVeryClose = lapsNeeded <= 10
          return (
            <NextLink
              key={item.id}
              href={`/quests/${quest.id}`}
              className="u-fgo-card flex items-start gap-3 py-3 px-4 rounded-md transition-colors duration-150 no-underline hover:no-underline"
              style={{
                background: 'var(--panel2)',
                borderLeft: `3px solid ${isVeryClose ? '#60c890' : 'var(--gold)'}`,
              }}
            >
              {item.icon && (
                <Image
                  src={getItemIconUrl(item.icon)}
                  alt={item.name}
                  width={36}
                  height={36}
                  style={{ flexShrink: 0, marginTop: '2px' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate" style={{ color: isVeryClose ? '#60c890' : 'var(--gold)' }}>
                  あと{lapsNeeded}周で達成！
                </p>
                <p className="text-sm font-bold truncate" style={{ color: 'var(--navy)' }}>{item.name}</p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text3)' }}>
                  あと{needed}個 · {quest.area} · {quest.name}
                </p>
              </div>
            </NextLink>
          )
        })}
      </div>
    </div>
  )
}

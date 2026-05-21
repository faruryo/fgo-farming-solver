'use client'

import React, { useMemo } from 'react'
import NextLink from 'next/link'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ItemIdentity } from '../common/ItemIdentity'
import { QuestIdentity } from '../common/QuestIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useRecentResult } from '../../hooks/use-recent-result'
import { useSpotIcons } from '../../hooks/use-spot-icons'
import { useDashboardResult } from '../../hooks/use-dashboard-result'
import { useDashboardSortMode } from '../../hooks/use-dashboard-sort-mode'
import { useActiveCampaigns } from '../../hooks/use-active-campaigns'
import { computeEffectiveAp } from '../../lib/solver'
import { isBothResult } from '../../interfaces/api'

const SORT_MODE_STORAGE_KEY = 'dashboard.nearGoal.sortMode'

export const NearGoalSection: React.FC = () => {
  const drops = useDrops()
  const { items: dropItems, quests: dropQuests, isLoading: dropsLoading } = drops
  const { result: recentResult, loading: resultLoading } = useRecentResult()
  const campaignAdjustedResult = useDashboardResult(recentResult, dropsLoading ? null : drops)
  const displayResult = campaignAdjustedResult ?? recentResult
  const [sortMode, setSortMode] = useDashboardSortMode(SORT_MODE_STORAGE_KEY, drops.campaigns)
  const { activeCampaigns } = useActiveCampaigns(drops.campaigns)

  const nearGoalEntries = useMemo(() => {
    if (!displayResult || !dropItems?.length) return []

    const result = isBothResult(displayResult) ? displayResult.lap : displayResult
    const { items: targetItems, params } = result

    if (!targetItems?.length) return []

    // The user's saved calculation pinned a set of allowed quests; respect it so
    // candidate enumeration here does not surface quests the user excluded.
    const allowedQuestIds = new Set<string>(params.quests ?? [])

    // Build a map of original AP (before campaign) from the drops data for badge display
    const originalApById = new Map(dropQuests?.map(q => [q.id, q.ap]) ?? [])
    const dropQuestById = new Map(dropQuests?.map(q => [q.id, q]) ?? [])

    return targetItems
      .flatMap(ti => {
        const needed = params.items[ti.id] ?? 0
        if (needed <= 0) return []

        const candidates = drops.drop_rates
          .filter(dr => dr.item_id === ti.id && dr.drop_rate > 0 && allowedQuestIds.has(dr.quest_id))
          .map(dr => {
            const baseQuest = dropQuestById.get(dr.quest_id)
            if (!baseQuest) return null
            const effectiveAp =
              activeCampaigns.length > 0
                ? computeEffectiveAp(baseQuest.ap, baseQuest.id, activeCampaigns)
                : baseQuest.ap
            const quest = { ...baseQuest, ap: effectiveAp }
            const lapsNeeded = Math.ceil(needed / dr.drop_rate)
            const apPerDrop = effectiveAp > 0 ? effectiveAp / dr.drop_rate : Number.POSITIVE_INFINITY
            return { quest, lapsNeeded, apPerDrop }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)

        const best =
          sortMode === 'ap'
            ? candidates.sort((a, b) => a.apPerDrop - b.apPerDrop || a.lapsNeeded - b.lapsNeeded)[0]
            : candidates.sort((a, b) => a.lapsNeeded - b.lapsNeeded)[0]

        if (!best) return []

        const displayItem = dropItems.find(i => i.id === ti.id)
        if (!displayItem) return []

        return [{ item: displayItem, quest: best.quest, needed, lapsNeeded: best.lapsNeeded }]
      })
      .sort((a, b) => a.lapsNeeded - b.lapsNeeded)
      .slice(0, 4)
      .map(entry => ({
        ...entry,
        originalAp: originalApById.get(entry.quest.id),
      }))
  }, [dropItems, dropQuests, drops.drop_rates, displayResult, sortMode, activeCampaigns])

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
          <TooltipContent side="bottom" className="max-w-[240px] text-left leading-relaxed">
            {sortMode === 'ap'
              ? '直近の計算結果から、各素材を最も少ない AP（1 個あたりの実効 AP が最小）で集められるクエストを選び、残り周回数が少ない順に Top 4 を表示。'
              : '直近の計算結果から、各素材を最も少ない周回数で集められるクエストを選び、達成が近い順に Top 4 を表示。'}
            <span className="block mt-1 opacity-75">AP半減などのキャンペーン情報は最大30分程度の遅れで反映されます。</span>
          </TooltipContent>
        </Tooltip>
        <ToggleGroup
          value={[sortMode]}
          onValueChange={(values: string[]) => {
            const next = values[0]
            if (next === 'laps' || next === 'ap') setSortMode(next)
          }}
          size="sm"
          spacing={0}
          aria-label="並び替え基準"
          className="ml-2 rounded-md border border-[color:var(--gold-dim)] bg-[color:var(--bg2)] overflow-hidden"
        >
          <ToggleGroupItem
            value="laps"
            aria-label="周回数優先"
            className="h-7 px-3 rounded-none text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white"
          >
            周回数
          </ToggleGroupItem>
          <ToggleGroupItem
            value="ap"
            aria-label="AP優先"
            className="h-7 px-3 rounded-none text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white"
          >
            AP
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="u-section-header-line" />
      </div>
      <div className="flex flex-col gap-3">
        {nearGoalEntries.map(({ item, quest, needed, lapsNeeded, originalAp }, index) => {
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

              <QuestIdentity
                area={quest.area}
                name={quest.name}
                ap={quest.ap}
                originalAp={originalAp}
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

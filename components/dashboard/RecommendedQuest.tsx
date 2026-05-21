'use client'

import React, { useMemo } from 'react'
import { Loader2, Info } from 'lucide-react'
import NextLink from 'next/link'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { QuestIdentity } from '../common/QuestIdentity'
import { ItemIdentity } from '../common/ItemIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { useRecentResult } from '../../hooks/use-recent-result'
import { useSpotIcons } from '../../hooks/use-spot-icons'
import { useDashboardResult } from '../../hooks/use-dashboard-result'
import { useDashboardSortMode } from '../../hooks/use-dashboard-sort-mode'
import { isBothResult, Quest } from '../../interfaces/api'

const SORT_MODE_STORAGE_KEY = 'dashboard.recommendedQuest.sortMode'

export const RecommendedQuest: React.FC = () => {
  const { t } = useTranslation(['dashboard'])
  const [chaldea] = useLocalStorage<ChaldeaState>('material', {})
  const drops = useDrops()
  const { items, quests, drop_rates, isLoading: dropsLoading } = drops
  const { result: recentResult, loading: resultLoading } = useRecentResult()
  const campaignAdjustedResult = useDashboardResult(recentResult, dropsLoading ? null : drops)
  const displayResult = campaignAdjustedResult ?? recentResult
  const [sortMode, setSortMode] = useDashboardSortMode(SORT_MODE_STORAGE_KEY, drops.campaigns)

  const recommendations = useMemo(() => {
    if (dropsLoading || !items || !items.length || !quests || !drop_rates) return []

    if (displayResult) {
      const targetQuests = isBothResult(displayResult) ? displayResult.lap.quests : displayResult.quests
      const targetItems = isBothResult(displayResult) ? displayResult.lap.items : displayResult.items
      const targetDropRates = isBothResult(displayResult) ? displayResult.lap.drop_rates : displayResult.drop_rates

      if (targetQuests && targetQuests.length > 0) {
        const isApDiscounted = (q: Quest) => {
          const original = quests?.find((qq) => qq.id === q.id)?.ap
          return original != null && q.ap < original
        }
        const getPriorityLaps = (q: Quest) => {
          if (q.area?.includes('冠位研鑽戦')) return 1
          if (q.area?.includes('オーディール・コール')) return 2
          return 3
        }
        const getPriorityAp = (q: Quest) => (isApDiscounted(q) ? 1 : 2)
        const getPriority = sortMode === 'ap' ? getPriorityAp : getPriorityLaps
        return targetQuests
          .sort((a, b) => {
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
  }, [items, quests, drop_rates, chaldea, dropsLoading, displayResult, sortMode])

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
          <TooltipContent side="bottom" className="max-w-[240px] text-left leading-relaxed">
            {recentResult
              ? sortMode === 'ap'
                ? '直近の計算結果のクエスト Top 4。AP割引対象クエストを最上位、その他をその下に並べ、同優先度内は予定周回数が多い順。'
                : '直近の計算結果のクエスト Top 4。優先順：冠位研鑽戦 → オーディール・コール → その他。ストームポッド消費を促す並びです。同優先度内は予定周回数が多い順。'
              : '不足素材ごとに最もドロップ率の高いクエスト Top 4。'}
            <span className="block mt-1 opacity-75">AP半減などのキャンペーン情報は最大30分程度の遅れで反映されます。</span>
          </TooltipContent>
        </Tooltip>
        {recentResult && (
          <ToggleGroup
            value={[sortMode]}
            onValueChange={(values: string[]) => {
              const next = values[0]
              if (next === 'laps' || next === 'ap') setSortMode(next)
            }}
            size="sm"
            spacing={0}
            aria-label="並び替え基準"
            className="ml-2 rounded-md bg-[color:var(--bg2)] shadow-[inset_0_0_0_1px_var(--gold-dim)] overflow-hidden"
          >
            <ToggleGroupItem
              value="laps"
              aria-label="周回数優先"
              className="h-7 px-3 rounded-none! text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white"
            >
              周回数
            </ToggleGroupItem>
            <ToggleGroupItem
              value="ap"
              aria-label="AP優先"
              className="h-7 px-3 rounded-none! text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white"
            >
              AP
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        <div className="u-section-header-line" />
      </div>

      <div className="flex flex-col gap-3">
        {recommendations.map(({ id, topItems, quest, rate, lap }, index) => {
          const originalAp = quest?.id ? quests?.find(q => q.id === quest.id)?.ap : undefined
          return (
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
              originalAp={originalAp}
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
          )
        })}
      </div>
    </div>
  )
}

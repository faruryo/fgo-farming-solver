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
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useActiveCampaigns } from '../../hooks/use-active-campaigns'
import { useDashboardMeta } from '../../hooks/use-dashboard-meta'
import { usePodFreeQuests } from '../../hooks/use-pod-free-quests'
import { computeEffectiveAp } from '../../lib/solver'
import { isBothResult } from '../../interfaces/api'
import { questConsumesPod } from '../../lib/quest-consumes-pod'

const SORT_MODE_STORAGE_KEY = 'dashboard.nearGoal.sortMode'

type NearGoalSortMode = 'efficiency' | 'laps'

const isNearGoalSortMode = (v: unknown): v is NearGoalSortMode =>
  v === 'efficiency' || v === 'laps'

// Top-N for "総合効率" mode. N=20 surfaces multi-drop heavens (冠位研鑽戦,
// AP-half 修練場, オーディール・コール) plus the occasional outlier free
// quest, without diluting the pool to the point of including everything.
const EFFICIENCY_POOL_SIZE = 20
// Pool size of "items near completion" that are evaluated against the
// efficiency pool. Sliced by smallest `needed` count so the section stays
// focused on what the user is actually close to finishing.
const NEEDED_ITEMS_WINDOW = 10

export const NearGoalSection: React.FC = () => {
  const drops = useDrops()
  const { items: dropItems, quests: dropQuests, isLoading: dropsLoading } = drops
  const { result: recentResult, loading: resultLoading } = useRecentResult()
  const campaignAdjustedResult = useDashboardResult(recentResult, dropsLoading ? null : drops)
  const displayResult = campaignAdjustedResult ?? recentResult
  const [sortMode, setSortMode] = useLocalStorage<NearGoalSortMode>(
    SORT_MODE_STORAGE_KEY,
    'efficiency',
    { onGet: (v) => (isNearGoalSortMode(v) ? v : 'efficiency') },
  )
  const { activeCampaigns, nowSec } = useActiveCampaigns(drops.campaigns)
  const { data: dashboardMeta } = useDashboardMeta()
  const podFree = usePodFreeQuests(dashboardMeta?.podFreePeriods, nowSec)
  const [possession] = useLocalStorage<Record<string, number | undefined>>('posession', {})

  const nearGoalEntries = useMemo(() => {
    if (!displayResult || !dropItems?.length) return []

    const result = isBothResult(displayResult) ? displayResult.lap : displayResult
    const { items: targetItems, params } = result
    if (!targetItems?.length) return []

    // 目標から所持数を引いた不足度。「不足してない素材」は達成間近から外れる。
    const neededOf = (itemId: string): number =>
      Math.max(0, (params.items[itemId] ?? 0) - (possession[itemId] ?? 0))

    const allowedQuestIds = new Set<string>(params.quests ?? [])
    const originalApById = new Map(dropQuests?.map(q => [q.id, q.ap]) ?? [])
    const dropQuestById = new Map(dropQuests?.map(q => [q.id, q]) ?? [])

    const effectiveApFor = (questId: string, originalAp: number): number =>
      activeCampaigns.length > 0
        ? computeEffectiveAp(originalAp, questId, activeCampaigns)
        : originalAp

    // 効率モード: ユーザーの残目標すべてに対し各クエストの効率スコア
    //   score(q) = Σ drop_rate(q, i) / effectiveAp(q)   for i ∈ needed items
    // を計算し、上位 EFFICIENCY_POOL_SIZE 件を「高効率プール」とする。
    let efficiencyPool: Set<string> | null = null
    if (sortMode === 'efficiency') {
      const questScores = new Map<string, number>()
      for (const dr of drops.drop_rates) {
        if (dr.drop_rate <= 0) continue
        if (!allowedQuestIds.has(dr.quest_id)) continue
        const needed = neededOf(dr.item_id)
        if (needed <= 0) continue
        const quest = dropQuestById.get(dr.quest_id)
        if (!quest) continue
        const ap = effectiveApFor(quest.id, quest.ap)
        if (ap <= 0) continue
        questScores.set(dr.quest_id, (questScores.get(dr.quest_id) ?? 0) + dr.drop_rate / ap)
      }
      efficiencyPool = new Set(
        [...questScores.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, EFFICIENCY_POOL_SIZE)
          .map(([id]) => id),
      )
    }

    // 効率モードでは「残量が少ない 10 個」のアイテムのみ評価する。
    // 最短モードでは従来通り全 targetItems を評価する。
    const itemsToEvaluate =
      sortMode === 'efficiency'
        ? [...targetItems]
            .map(ti => ({ ti, needed: neededOf(ti.id) }))
            .filter(x => x.needed > 0)
            .sort((a, b) => a.needed - b.needed)
            .slice(0, NEEDED_ITEMS_WINDOW)
            .map(x => x.ti)
        : targetItems

    const podFreeActive = sortMode === 'efficiency' && podFree.isActive
    const podFreeQuestIds = podFree.questIds

    return itemsToEvaluate
      .flatMap(ti => {
        const needed = neededOf(ti.id)
        if (needed <= 0) return []

        const buildCandidate = (dr: { quest_id: string; drop_rate: number }) => {
          const baseQuest = dropQuestById.get(dr.quest_id)
          if (!baseQuest) return null
          const effectiveAp = effectiveApFor(baseQuest.id, baseQuest.ap)
          const quest = { ...baseQuest, ap: effectiveAp }
          const lapsNeeded = Math.ceil(needed / dr.drop_rate)
          return { quest, lapsNeeded }
        }

        // 効率モード + ポッド消費なし期間中: 対象 questIds 内で当該 item を drop するクエストが
        // あれば、そのクエストで集める想定の lap を最優先で採用する (effectiveAp は無視)。
        if (podFreeActive) {
          const podFreeCandidates = drops.drop_rates
            .filter(dr =>
              dr.item_id === ti.id &&
              dr.drop_rate > 0 &&
              allowedQuestIds.has(dr.quest_id) &&
              podFreeQuestIds.has(dr.quest_id),
            )
            .map(buildCandidate)
            .filter((x): x is NonNullable<ReturnType<typeof buildCandidate>> => x !== null)

          const bestPodFree = podFreeCandidates.sort((a, b) => a.lapsNeeded - b.lapsNeeded)[0]
          if (bestPodFree) {
            const displayItem = dropItems.find(i => i.id === ti.id)
            if (!displayItem) return []
            return [{ item: displayItem, quest: bestPodFree.quest, needed, lapsNeeded: bestPodFree.lapsNeeded }]
          }
        }

        const candidates = drops.drop_rates
          .filter(dr => dr.item_id === ti.id && dr.drop_rate > 0 && allowedQuestIds.has(dr.quest_id))
          .filter(dr => (efficiencyPool ? efficiencyPool.has(dr.quest_id) : true))
          .map(buildCandidate)
          .filter((x): x is NonNullable<ReturnType<typeof buildCandidate>> => x !== null)

        const best = candidates.sort((a, b) => a.lapsNeeded - b.lapsNeeded)[0]
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
  }, [dropItems, dropQuests, drops.drop_rates, displayResult, sortMode, activeCampaigns, podFree.isActive, podFree.questIds, possession])

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
          <TooltipContent side="bottom" className="max-w-[260px] text-left leading-relaxed">
            {sortMode === 'efficiency'
              ? `直近の計算結果から、ユーザー残目標へのスコア (drop/AP 合計) が高い上位 ${EFFICIENCY_POOL_SIZE} クエストを「高効率プール」とし、その中で達成が近い素材を Top 4 表示。冠位研鑽戦・AP半 修練場・オーディール・コールなどが自然に上位に来ます。`
              : '直近の計算結果から、各素材を最も少ない周回数で集められるクエストを選び、達成が近い順に Top 4 を表示。'}
            <span className="block mt-1 opacity-75">AP半減などのキャンペーン情報は最大30分程度の遅れで反映されます。</span>
          </TooltipContent>
        </Tooltip>
        <ToggleGroup
          value={[sortMode]}
          onValueChange={(values: string[]) => {
            const next = values[0]
            if (isNearGoalSortMode(next)) setSortMode(next)
          }}
          size="sm"
          spacing={0}
          aria-label="並び替え基準"
          className="ml-2 rounded-md bg-[color:var(--bg2)] shadow-[inset_0_0_0_1px_var(--gold-dim)] overflow-hidden"
        >
          <ToggleGroupItem
            value="efficiency"
            aria-label="総合効率優先"
            className="h-7 px-3 rounded-none! text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white"
          >
            効率
          </ToggleGroupItem>
          <ToggleGroupItem
            value="laps"
            aria-label="最短周回優先"
            className="h-7 px-3 rounded-none! text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white"
          >
            最短
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="u-section-header-line" />
      </div>
      <div className="flex flex-col gap-3">
        {nearGoalEntries.map(({ item, quest, needed, lapsNeeded, originalAp }, index) => {
          const isVeryClose = lapsNeeded <= 10
          const accentColor = isVeryClose ? '#60c890' : 'var(--gold)'
          const consumesPod = questConsumesPod(quest.area)
          const isPodFreeQuest = consumesPod && podFree.questIds.has(quest.id)
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
                consumesPod={consumesPod}
                podFree={isPodFreeQuest}
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

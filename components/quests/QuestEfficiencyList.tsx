'use client'

import React, { useMemo, useState } from 'react'
import NextLink from 'next/link'
import { Info, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { QuestIdentity } from '../common/QuestIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useActiveCampaigns } from '../../hooks/use-active-campaigns'
import { useDashboardMeta } from '../../hooks/use-dashboard-meta'
import { usePodFreeQuests } from '../../hooks/use-pod-free-quests'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { computeEffectiveAp } from '../../lib/solver'
import {
  computeQuestEfficiency,
  DEFAULT_SURPLUS_THRESHOLD,
  SurplusThreshold,
} from '../../lib/quest-efficiency'
import { questConsumesPod } from '../../lib/quest-consumes-pod'
import { PossessionModal } from './PossessionModal'

const toggleItemClass =
  'h-7 px-3 rounded-none! text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white'
const toggleGroupClass =
  'rounded-md bg-[color:var(--bg2)] shadow-[inset_0_0_0_1px_var(--gold-dim)] overflow-hidden'

const parseGoals = (raw: Record<string, string | number | undefined>): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const [id, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
    if (Number.isFinite(n) && n > 0) out[id] = n
  }
  return out
}

export const QuestEfficiencyList: React.FC = () => {
  const { t } = useTranslation('quests')
  const drops = useDrops()
  const { items: dropItems, quests: dropQuests, isLoading } = drops
  const { activeCampaigns, nowSec } = useActiveCampaigns(drops.campaigns)
  const { data: dashboardMeta } = useDashboardMeta()
  const podFree = usePodFreeQuests(dashboardMeta?.podFreePeriods, nowSec)

  const [possession] = useLocalStorage<Record<string, number | undefined>>('posession', {})
  const [goalsRaw] = useLocalStorage<Record<string, string | number | undefined>>('items', {})
  const [threshold] = useLocalStorage<SurplusThreshold>(
    'efficiency/surplusThreshold',
    DEFAULT_SURPLUS_THRESHOLD,
  )
  const [shortageOnly, setShortageOnly] = useLocalStorage<boolean>(
    'quests/efficiency/shortageOnly',
    true,
  )
  const [includeSkillStones, setIncludeSkillStones] = useLocalStorage<boolean>(
    'quests/efficiency/includeSkillStones',
    true,
  )

  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const goals = useMemo(() => parseGoals(goalsRaw), [goalsRaw])

  const ranked = useMemo(() => {
    if (isLoading || !dropQuests?.length) return []
    const effList = computeQuestEfficiency(drops, {
      possession,
      goals,
      activeCampaigns,
      shortageOnly,
      includeSkillStones,
      surplusThreshold: threshold,
    })
    const questById = new Map(dropQuests.map(q => [q.id, q]))
    return effList
      .filter(e => e.score > 0)
      .map(e => {
        const quest = questById.get(e.questId)!
        const effAp =
          activeCampaigns.length > 0
            ? computeEffectiveAp(quest.ap, quest.id, activeCampaigns)
            : quest.ap
        return { ...e, quest, effAp }
      })
      .filter(r => r.quest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, isLoading, possession, goals, activeCampaigns, shortageOnly, includeSkillStones, threshold])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ranked
    return ranked.filter(
      r =>
        r.quest.name.toLowerCase().includes(q) || r.quest.area.toLowerCase().includes(q),
    )
  }, [ranked, query])

  // 所持数未入力の素材数(効率に効くドロップ素材のうち)
  const unenteredCount = useMemo(() => {
    if (!dropItems?.length) return 0
    const dropItemIds = new Set(drops.drop_rates.map(dr => dr.item_id))
    return dropItems.filter(i => dropItemIds.has(i.id) && possession[i.id] == null).length
  }, [dropItems, drops.drop_rates, possession])

  if (isLoading) return null

  return (
    <div className="flex flex-col gap-4">
      {/* コントロール行 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text3)' }}
          />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('クエストを検索')}
            className="pl-8"
            aria-label={t('クエストを検索')}
          />
        </div>

        <ToggleGroup
          value={[includeSkillStones ? 'incl' : 'excl']}
          onValueChange={(values: string[]) => {
            if (values[0]) setIncludeSkillStones(values[0] === 'incl')
          }}
          size="sm"
          spacing={0}
          aria-label={t('石含む')}
          className={toggleGroupClass}
        >
          <ToggleGroupItem value="incl" className={toggleItemClass}>
            {t('石含む')}
          </ToggleGroupItem>
          <ToggleGroupItem value="excl" className={toggleItemClass}>
            {t('石除く')}
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          value={[shortageOnly ? 'shortage' : 'all']}
          onValueChange={(values: string[]) => {
            if (values[0]) setShortageOnly(values[0] === 'shortage')
          }}
          size="sm"
          spacing={0}
          aria-label={t('不足のみ')}
          className={toggleGroupClass}
        >
          <ToggleGroupItem value="shortage" className={toggleItemClass}>
            {t('不足のみ')}
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className={toggleItemClass}>
            {t('全部')}
          </ToggleGroupItem>
        </ToggleGroup>

        <Tooltip>
          <TooltipTrigger className="flex-shrink-0 cursor-default" style={{ color: 'var(--text3)' }}>
            <Info size={14} />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] text-left leading-relaxed">
            {t('効率ポイントとは')}
            <span className="block mt-1 opacity-80">{t('不足トグル説明')}</span>
            <span className="block mt-1 opacity-80">{t('石トグル説明')}</span>
          </TooltipContent>
        </Tooltip>

        <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
          {t('所持数を入力')}
        </Button>
      </div>

      {/* 所持数未入力ナッジ */}
      {unenteredCount > 0 && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="text-left text-[11px] px-3 py-2 rounded-md"
          style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--gold-dim)' }}
        >
          {t('所持数未入力の素材があります')}（{unenteredCount}）
        </button>
      )}

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text3)' }}>
          {t('該当するクエストがありません')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((r, index) => {
            const consumesPod = questConsumesPod(r.quest.area)
            const isPodFreeQuest = consumesPod && podFree.questIds.has(r.quest.id)
            return (
              <NextLink
                key={r.quest.id}
                href={`/quests/${r.quest.id}`}
                className="u-fgo-card flex items-center gap-3 py-2.5 px-4 rounded-md transition-all duration-200 no-underline hover:no-underline hover:-translate-y-0.5"
                style={{ borderLeft: `3px solid ${isPodFreeQuest ? '#60c890' : 'var(--gold)'}` }}
              >
                <span
                  className="w-5 text-[11px] font-bold tabular-nums select-none text-right flex-shrink-0"
                  style={{ color: 'var(--text3)' }}
                >
                  {index + 1}
                </span>
                <QuestIdentity
                  area={r.quest.area}
                  name={r.quest.name}
                  ap={r.effAp}
                  originalAp={r.quest.ap}
                  className="flex-1 min-w-0"
                  consumesPod={consumesPod}
                  podFree={isPodFreeQuest}
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isPodFreeQuest && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(96,200,144,0.15)', color: '#60c890' }}
                    >
                      {t('ポッド無料中')}
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-[9px]" style={{ color: 'var(--text3)' }}>
                      {t('効率ポイント')}
                    </p>
                    <p className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
                      {r.score.toFixed(2)}
                    </p>
                  </div>
                </div>
              </NextLink>
            )
          })}
        </div>
      )}

      <PossessionModal items={dropItems ?? []} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  )
}

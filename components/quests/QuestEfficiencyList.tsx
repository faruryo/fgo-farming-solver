'use client'

import React, { useMemo, useState } from 'react'
import NextLink from 'next/link'
import { Info, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { QuestIdentity } from '../common/QuestIdentity'
import { ItemIdentity } from '../common/ItemIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useActiveCampaigns } from '../../hooks/use-active-campaigns'
import { useDashboardMeta } from '../../hooks/use-dashboard-meta'
import { usePodFreeQuests } from '../../hooks/use-pod-free-quests'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { computeEffectiveAp } from '../../lib/solver'
import {
  computeQuestEfficiency,
  DEFAULT_SURPLUS_THRESHOLD,
  EfficiencyDenominator,
  mergeGoals,
  SurplusThreshold,
} from '../../lib/quest-efficiency'
import { questConsumesPod } from '../../lib/quest-consumes-pod'
import { PossessionModal } from './PossessionModal'

const toggleItemClass =
  'h-7 px-3 rounded-none! text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white'
const toggleGroupClass =
  'rounded-md bg-[color:var(--bg2)] shadow-[inset_0_0_0_1px_var(--gold-dim)] overflow-hidden'

// クエスト名から段位(ローマ数字 I〜VIII。ASCII / 全角の両対応)を抽出。冠位研鑽戦の VI以下 判定に使う。
const TIER_TOKENS: [string, number][] = [
  ['Ⅷ', 8], ['VIII', 8], ['Ⅶ', 7], ['VII', 7], ['Ⅵ', 6], ['VI', 6],
  ['Ⅴ', 5], ['V', 5], ['Ⅳ', 4], ['IV', 4], ['Ⅲ', 3], ['III', 3], ['Ⅱ', 2], ['II', 2], ['Ⅰ', 1], ['I', 1],
]
const kanniTier = (name: string): number | null => {
  for (const [token, n] of TIER_TOKENS) if (name.includes(token)) return n
  return null
}
const isLowKanni = (area: string, name: string): boolean =>
  area.includes('冠位研鑽戦') && (kanniTier(name) ?? 99) <= 6

const CheckLabel: React.FC<{
  checked: boolean
  onChange: (b: boolean) => void
  children: React.ReactNode
}> = ({ checked, onChange, children }) => (
  <label
    className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
    style={{ color: 'var(--text2)' }}
  >
    <Checkbox checked={checked} onCheckedChange={(c: boolean) => onChange(Boolean(c))} />
    {children}
  </label>
)

const filterRowLabelClass = 'text-[10px] font-semibold tracking-wide w-16 flex-shrink-0'

export const QuestEfficiencyList: React.FC = () => {
  const { t } = useTranslation('quests')
  const drops = useDrops()
  const { items: dropItems, quests: dropQuests, isLoading } = drops
  const { activeCampaigns, nowSec } = useActiveCampaigns(drops.campaigns)
  const { data: dashboardMeta } = useDashboardMeta()
  const podFree = usePodFreeQuests(dashboardMeta?.podFreePeriods, nowSec)

  // 所持数・必要数は育成計算機と同じ Atlas ID 空間で持つ。
  const [possession] = useLocalStorage<Record<string, number | undefined>>('posession', {})
  const [materialResult] = useLocalStorage<Record<string, number>>('material/result', {})
  const [itemsRaw] = useLocalStorage<Record<string, string | number | undefined>>('items', {})
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
  const [includePieces, setIncludePieces] = useLocalStorage<boolean>(
    'quests/efficiency/includePieces',
    true,
  )
  const [denominator, setDenominator] = useLocalStorage<EfficiencyDenominator>(
    'quests/efficiency/denominator',
    'ap',
  )
  const [includeQp, setIncludeQp] = useLocalStorage<boolean>('quests/efficiency/includeQp', false)
  const [includeBond, setIncludeBond] = useLocalStorage<boolean>('quests/efficiency/includeBond', false)
  const [includeExp, setIncludeExp] = useLocalStorage<boolean>('quests/efficiency/includeExp', false)
  const [showLowKanni, setShowLowKanni] = useLocalStorage<boolean>('quests/efficiency/showLowKanni', false)

  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  // 必要数(目標)は material/result(Atlas ID)を主に、無ければ items(短縮ID→atlasId 変換)で補完。
  const goals = useMemo(
    () => mergeGoals(materialResult, itemsRaw, dropItems ?? []),
    [materialResult, itemsRaw, dropItems],
  )

  const ranked = useMemo(() => {
    if (isLoading || !dropQuests?.length) return []
    const effList = computeQuestEfficiency(drops, {
      possession,
      goals,
      activeCampaigns,
      shortageOnly,
      includeSkillStones,
      includePieces,
      surplusThreshold: threshold,
      denominator,
      includeQp,
      includeBond,
      includeExp,
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
      // 冠位研鑽戦の VI以下 は既定で隠す(showLowKanni で表示)。
      .filter(r => showLowKanni || !isLowKanni(r.quest.area, r.quest.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, isLoading, possession, goals, activeCampaigns, shortageOnly, includeSkillStones, includePieces, threshold, denominator, includeQp, includeBond, includeExp, showLowKanni])

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
    return dropItems.filter(
      i => dropItemIds.has(i.id) && i.atlasId != null && possession[String(i.atlasId)] == null,
    ).length
  }, [dropItems, drops.drop_rates, possession])

  // クエストごとの入手アイテム(ドロップ率降順)。行のアイコン表示に使う。
  const dropItemsByQuest = useMemo(() => {
    type Entry = { id: string; name: string; icon?: string; dropRate: number }
    const itemById = new Map((dropItems ?? []).map(i => [i.id, i]))
    const m = new Map<string, Entry[]>()
    for (const dr of drops.drop_rates) {
      if (dr.drop_rate <= 0) continue
      const it = itemById.get(dr.item_id)
      if (!it) continue
      const arr = m.get(dr.quest_id) ?? []
      arr.push({ id: it.id, name: it.name, icon: it.icon, dropRate: dr.drop_rate })
      m.set(dr.quest_id, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => b.dropRate - a.dropRate)
    return m
  }, [dropItems, drops.drop_rates])

  if (isLoading) return null

  const activeFilterCount =
    (shortageOnly ? 0 : 1) +
    (includeSkillStones ? 0 : 1) +
    (includePieces ? 0 : 1) +
    (includeQp ? 1 : 0) +
    (includeBond ? 1 : 0) +
    (includeExp ? 1 : 0) +
    (showLowKanni ? 1 : 0)

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

        {/* 分母(AP効率/周回効率)はメイン行に常設 */}
        <ToggleGroup
          value={[denominator]}
          onValueChange={(values: string[]) => {
            const v = values[0]
            if (v === 'ap' || v === 'turn') setDenominator(v)
          }}
          size="sm"
          spacing={0}
          aria-label={t('効率の分母')}
          className={toggleGroupClass}
        >
          <ToggleGroupItem value="ap" className={toggleItemClass}>
            {t('AP効率')}
          </ToggleGroupItem>
          <ToggleGroupItem value="turn" className={toggleItemClass}>
            {t('周回効率')}
          </ToggleGroupItem>
        </ToggleGroup>

        {/* フィルター(ポップオーバー) */}
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" />}>
            <SlidersHorizontal size={14} className="mr-1.5" />
            {t('フィルター')}
            {activeFilterCount > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold text-white"
                style={{ background: 'var(--gold)' }}
              >
                {activeFilterCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 gap-3">
            <div className="flex items-center gap-2">
              <span className={filterRowLabelClass} style={{ color: 'var(--text3)' }}>
                {t('素材対象')}
              </span>
              <ToggleGroup
                value={[shortageOnly ? 'shortage' : 'all']}
                onValueChange={(values: string[]) => {
                  if (values[0]) setShortageOnly(values[0] === 'shortage')
                }}
                size="sm"
                spacing={0}
                className={toggleGroupClass}
              >
                <ToggleGroupItem value="shortage" className={toggleItemClass}>
                  {t('不足のみ')}
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className={toggleItemClass}>
                  {t('全部')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex items-center gap-2">
              <span className={filterRowLabelClass} style={{ color: 'var(--text3)' }}>
                {t('スキル石')}
              </span>
              <ToggleGroup
                value={[includeSkillStones ? 'incl' : 'excl']}
                onValueChange={(values: string[]) => {
                  if (values[0]) setIncludeSkillStones(values[0] === 'incl')
                }}
                size="sm"
                spacing={0}
                className={toggleGroupClass}
              >
                <ToggleGroupItem value="incl" className={toggleItemClass}>
                  {t('含む')}
                </ToggleGroupItem>
                <ToggleGroupItem value="excl" className={toggleItemClass}>
                  {t('除く')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex items-center gap-2">
              <span className={filterRowLabelClass} style={{ color: 'var(--text3)' }}>
                {t('ピース')}
              </span>
              <ToggleGroup
                value={[includePieces ? 'incl' : 'excl']}
                onValueChange={(values: string[]) => {
                  if (values[0]) setIncludePieces(values[0] === 'incl')
                }}
                size="sm"
                spacing={0}
                className={toggleGroupClass}
              >
                <ToggleGroupItem value="incl" className={toggleItemClass}>
                  {t('含む')}
                </ToggleGroupItem>
                <ToggleGroupItem value="excl" className={toggleItemClass}>
                  {t('除く')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex items-center gap-3">
              <span className={filterRowLabelClass} style={{ color: 'var(--text3)' }}>
                {t('報酬加算')}
              </span>
              <CheckLabel checked={includeQp} onChange={setIncludeQp}>
                QP
              </CheckLabel>
              <CheckLabel checked={includeBond} onChange={setIncludeBond}>
                {t('絆')}
              </CheckLabel>
              <CheckLabel checked={includeExp} onChange={setIncludeExp}>
                EXP
              </CheckLabel>
            </div>

            <div className="flex items-center gap-2">
              <span className={filterRowLabelClass} style={{ color: 'var(--text3)' }}>
                {t('表示')}
              </span>
              <CheckLabel checked={showLowKanni} onChange={setShowLowKanni}>
                {t('冠位研鑽戦VI以下を表示')}
              </CheckLabel>
            </div>

            <p className="text-[10px] leading-relaxed pt-1" style={{ color: 'var(--text3)' }}>
              {t('効率ポイントとは')}
            </p>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger className="flex-shrink-0 cursor-default" style={{ color: 'var(--text3)' }}>
            <Info size={14} />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-left leading-relaxed">
            {t('効率ポイントとは')}
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
                  className="min-w-0 max-w-[44%]"
                  consumesPod={consumesPod}
                  podFree={isPodFreeQuest}
                />

                {/* 入手アイテムのアイコン(ドロップ率上位) */}
                <div className="hidden sm:flex flex-1 items-center gap-1 min-w-0 overflow-hidden">
                  {(dropItemsByQuest.get(r.quest.id) ?? []).slice(0, 8).map(it => (
                    <ItemIdentity key={it.id} icon={it.icon} name={it.name} size={22} />
                  ))}
                </div>

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

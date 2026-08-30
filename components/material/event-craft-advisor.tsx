'use client'

import Image from 'next/image'
import { KeyboardEvent, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useDrops } from '../../hooks/use-drops'
import { Item } from '../../interfaces/atlas-academy'
import { Drops } from '../../lib/get-drops'
import { getItemIconUrl } from '../../lib/get-item-icon-url'
import {
  computeEventCraftPlan,
  generateCraftAdvice,
  resolveVisiblePatternId,
  CraftAllocationItem,
  EventCraftPatternId,
  EventCraftPlanPattern,
  EventCraftPlanResult,
  AdviceTranslator,
} from '../../lib/event-craft-advisor'
import {
  EVENT_INGREDIENTS,
  EventCraftRecipe,
  ExpectedCraftYieldEntry,
  IngredientCounts,
  IngredientType,
  RecipeMaterialRarity,
  getRecipeYields,
  sumExpectedCraftYields,
} from '../../data/event-craft-recipes'
import { ServantPraise } from '../farming/ServantPraise'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type EventCraftAdvisorProps = {
  items?: Item[]
  fullNeed: Record<string, number>
}

export type EventCraftAdvisorConfig = {
  ingredients: IngredientCounts
  planPattern: EventCraftPatternId
}

const DEFAULT_EVENT_CRAFT_CONFIG: EventCraftAdvisorConfig = {
  ingredients: { seafood: 0, meat: 0, vegetable: 0 },
  planPattern: 'runs',
}

const PATTERN_IDS: readonly EventCraftPatternId[] = [
  'runs',
  'ap',
  'even-turn',
  'even-ap',
  'exhaust',
]

const isPatternId = (v: unknown): v is EventCraftPatternId =>
  typeof v === 'string' && (PATTERN_IDS as readonly string[]).includes(v)

/** 旧 exhaustIngredients フラグ形式からの移行を含む、localStorage 読み出し時の正規化。 */
export const migrateEventCraftConfig = (raw: unknown): EventCraftAdvisorConfig => {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ingredients =
    obj.ingredients && typeof obj.ingredients === 'object'
      ? (obj.ingredients as IngredientCounts)
      : DEFAULT_EVENT_CRAFT_CONFIG.ingredients

  if ('planPattern' in obj && isPatternId(obj.planPattern)) {
    return { ingredients, planPattern: obj.planPattern }
  }
  if ('exhaustIngredients' in obj) {
    return { ingredients, planPattern: obj.exhaustIngredients === true ? 'exhaust' : 'runs' }
  }
  return { ingredients, planPattern: 'runs' }
}

const PATTERN_NAME_KEYS: Record<EventCraftPatternId, [string, string]> = {
  runs: ['event-craft-pattern-runs', '周回を減らす'],
  ap: ['event-craft-pattern-ap', 'APを減らす'],
  'even-turn': ['event-craft-pattern-even-turn', '満遍なく（周回）'],
  'even-ap': ['event-craft-pattern-even-ap', '満遍なく（AP）'],
  exhaust: ['event-craft-pattern-exhaust', '食材を使い切る'],
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const getItemIcon = (
  catItem?: Item,
  dropItem?: Drops['items'][number],
): string | null => {
  if (catItem?.icon) return getItemIconUrl(catItem.icon)
  if (dropItem?.icon) return getItemIconUrl(dropItem.icon)
  return null
}

const IngredientInputs = ({
  ingredients,
  onChange,
}: {
  ingredients: IngredientCounts
  onChange: (type: IngredientType, count: number) => void
}) => {
  const { t } = useTranslation('material')
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <div
        className="mb-2 text-xs font-semibold"
        style={{ color: 'var(--text2)' }}
      >
        {t('event-craft-ingredients-heading', 'イベント食材所持数')}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {EVENT_INGREDIENTS.map((ing) => (
          <label
            key={ing.id}
            className="flex items-center justify-between gap-2 rounded px-2 py-1"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            <span
              className="truncate text-xs font-medium"
              style={{ color: 'var(--text)' }}
            >
              {t(`ingredient-${ing.id}`, ing.name)}
            </span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              className="h-8 w-20 text-right"
              value={ingredients[ing.id] === 0 ? '' : ingredients[ing.id]}
              placeholder="0"
              onChange={(e) => onChange(ing.id, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

const CraftCardBadges = ({ item }: { item: CraftAllocationItem }) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      {item.deficitCount > 0 && (
        <span
          className="rounded px-2 py-0.5 text-xs font-bold"
          style={{ background: 'var(--accent)', color: 'var(--gold)' }}
        >
          {t('event-craft-rec-badge', '推奨 +{{count}}', {
            count: item.deficitCount,
          })}
        </span>
      )}
      {item.surplusCount > 0 && (
        <span
          className="rounded px-2 py-0.5 text-xs font-bold"
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: 'var(--blue, #3b82f6)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          {t('event-craft-surplus-badge', '余剰 +{{count}}', {
            count: item.surplusCount,
          })}
        </span>
      )}
    </div>
  )
}

const CraftCardMeta = ({
  costs,
  deficitSaved,
  surplusValue,
  unitLabel,
}: {
  costs: IngredientCounts
  deficitSaved: number
  surplusValue: number
  unitLabel: string
}) => {
  const { t } = useTranslation('material')
  return (
    <div
      className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-xs"
      style={{ color: 'var(--text2)' }}
    >
      <span>
        {t(
          'event-craft-costs-format',
          '{{seafood}}海鮮 / {{meat}}お肉 / {{vegetable}}野菜',
          {
            seafood: costs.seafood,
            meat: costs.meat,
            vegetable: costs.vegetable,
          },
        )}
      </span>
      <div className="flex items-center gap-2 font-medium">
        {deficitSaved > 0 && (
          <span style={{ color: 'var(--green)' }}>
            {t('event-craft-saved-equiv', '−{{amount}} {{unit}}', {
              amount: fmt(deficitSaved),
              unit: unitLabel,
            })}
          </span>
        )}
        {surplusValue > 0 && (
          <span style={{ color: 'var(--blue, #3b82f6)' }}>
            {t('event-craft-surplus-equiv', '+{{amount}} {{unit}}相当', {
              amount: fmt(surplusValue),
              unit: unitLabel,
            })}
          </span>
        )}
      </div>
    </div>
  )
}

const CraftCardImage = ({ iconUrl, name }: { iconUrl: string | null; name: string }) =>
  iconUrl ? (
    <Image src={iconUrl} alt={name} width={36} height={36} className="flex-shrink-0 rounded" />
  ) : (
    <div className="h-9 w-9 flex-shrink-0 rounded" style={{ background: 'var(--border)' }} />
  )

const RARITY_FALLBACK: Record<RecipeMaterialRarity, string> = {
  bronze: '銅',
  silver: '銀',
  gold: '金',
}

const PerDishYieldLine = ({
  recipe,
  materialName,
}: {
  recipe: EventCraftRecipe
  materialName: string
}) => {
  const { t } = useTranslation('material')
  const yields = getRecipeYields(recipe)
  const featuredYield = yields[recipe.targetItem.shortId] ?? 0
  const otherEntries = Object.entries(yields).filter(
    ([id]) => id !== recipe.targetItem.shortId,
  )
  const rarityKey = recipe.targetItem.rarity
  let rarityJa = RARITY_FALLBACK.bronze
  if (rarityKey === 'silver') rarityJa = RARITY_FALLBACK.silver
  if (rarityKey === 'gold') rarityJa = RARITY_FALLBACK.gold
  return (
    <p className="mt-0.5 text-xs" style={{ color: 'var(--text3)' }}>
      {t(
        'event-craft-per-dish-yields',
        '期待: {{featured}} {{featuredAmount}} / 他{{rarity}} {{otherAmount}}×{{otherCount}}',
        {
          featured: materialName,
          featuredAmount: featuredYield.toFixed(2),
          rarity: t(`event-craft-rarity-${rarityKey}`, rarityJa),
          otherAmount: (otherEntries[0]?.[1] ?? 0).toFixed(2),
          otherCount: otherEntries.length,
        },
      )}
    </p>
  )
}

const CraftCard = ({
  item,
  catItem,
  dropItem,
  unitLabel,
}: {
  item: CraftAllocationItem
  catItem?: Item
  dropItem?: Drops['items'][number]
  unitLabel: string
}) => {
  const { t } = useTranslation('material')
  const recipe = item.recipe
  const iconUrl = getItemIcon(catItem, dropItem)
  const materialName = t(
    `material-${recipe.targetItem.shortId}`,
    catItem?.name ?? recipe.targetItem.name,
  )

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
    >
      <CraftCardImage iconUrl={iconUrl} name={materialName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {t(`recipe-${recipe.id}`, recipe.name)}
            </span>
            <span className="truncate text-xs" style={{ color: 'var(--text3)' }}>
              ({materialName})
            </span>
          </div>
          <CraftCardBadges item={item} />
        </div>
        <PerDishYieldLine recipe={recipe} materialName={materialName} />
        <CraftCardMeta
          costs={recipe.costs}
          deficitSaved={item.deficitSaved}
          surplusValue={item.surplusValue}
          unitLabel={unitLabel}
        />
      </div>
    </div>
  )
}

export const EventCraftExpectedYields = ({
  entries,
}: {
  entries: ExpectedCraftYieldEntry[]
}) => {
  const { t } = useTranslation('material')
  if (entries.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
        {t('event-craft-expected-yields-heading', 'この配分での期待獲得')}
      </span>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text)' }}>
        {entries.map((entry) => (
          <span key={entry.shortId}>
            {t('event-craft-expected-yield-amount', '{{name}} {{amount}}', {
              name: t(`material-${entry.shortId}`, entry.name),
              amount: fmt(entry.amount),
            })}
          </span>
        ))}
      </div>
    </div>
  )
}

const LeftoverList = ({ leftover }: { leftover: IngredientCounts }) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium text-xs" style={{ color: 'var(--text2)' }}>
        {t('event-craft-leftover-title', '残余食材')}:
      </span>
      <div className="flex items-center gap-3 text-xs font-semibold">
        <span style={{ color: 'var(--text)' }}>
          {t('ingredient-seafood-short', '海鮮')} {leftover.seafood}
        </span>
        <span style={{ color: 'var(--text)' }}>
          {t('ingredient-meat-short', 'お肉')} {leftover.meat}
        </span>
        <span style={{ color: 'var(--text)' }}>
          {t('ingredient-vegetable-short', '野菜')} {leftover.vegetable}
        </span>
      </div>
    </div>
  )
}

const LeftoverFooter = ({
  leftover,
  hasInputs,
  totalSaved,
  totalSurplusValue,
  unitLabel,
  onReset,
}: {
  leftover: IngredientCounts
  hasInputs: boolean
  totalSaved: number
  totalSurplusValue: number
  unitLabel: string
  onReset: () => void
}) => {
  const { t } = useTranslation('material')
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 text-sm"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <LeftoverList leftover={leftover} />
      <div className="flex items-center gap-3 ml-auto">
        {hasInputs && (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            {t('event-craft-clear-inputs', '食材数をリセット')}
          </Button>
        )}
        {totalSaved > 0 && (
          <span className="font-semibold text-sm" style={{ color: 'var(--green)' }}>
            {t('event-craft-total-saved', '合計 −{{amount}} {{unit}} 節約', {
              amount: fmt(totalSaved),
              unit: unitLabel,
            })}
          </span>
        )}
        {totalSurplusValue > 0 && (
          <span className="font-semibold text-sm" style={{ color: 'var(--blue, #3b82f6)' }}>
            {t('event-craft-total-surplus', '余剰獲得 +{{amount}} {{unit}} 相当', {
              amount: fmt(totalSurplusValue),
              unit: unitLabel,
            })}
          </span>
        )}
      </div>
    </div>
  )
}

const EMPTY_PLAN_RESULT: EventCraftPlanResult = { patterns: [], absorbedInto: {} }

const sortAllocations = (allocations: CraftAllocationItem[]) =>
  [...allocations].sort(
    (a, b) => b.deficitSaved + b.surplusValue - (a.deficitSaved + a.surplusValue),
  )

const CraftCardList = ({
  allocations,
  items,
  dropItems,
  unitLabel,
}: {
  allocations: CraftAllocationItem[]
  items: Item[]
  dropItems: Drops['items']
  unitLabel: string
}) => {
  const itemsByAtlasId = useMemo(() => {
    const m = new Map<number, Item>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const dropItemByAtlasId = useMemo(() => {
    const m = new Map<number, Drops['items'][number]>()
    for (const it of dropItems) if (it.atlasId != null) m.set(it.atlasId, it)
    return m
  }, [dropItems])

  return (
    <div className="flex flex-col gap-2">
      {allocations.map((item) => (
        <CraftCard
          key={item.recipe.id}
          item={item}
          catItem={itemsByAtlasId.get(item.recipe.targetItem.atlasId)}
          dropItem={dropItemByAtlasId.get(item.recipe.targetItem.atlasId)}
          unitLabel={unitLabel}
        />
      ))}
    </div>
  )
}

const PatternEvaluation = ({ pattern }: { pattern: EventCraftPlanPattern }) => {
  const { t } = useTranslation('material')
  if (pattern.metric === 'both') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
        <span style={{ color: 'var(--text2)' }}>
          {t(
            'event-craft-residual-reference',
            '残余参考: {{turn}} 周 / {{ap}} AP',
            { turn: fmt(pattern.residualTurnCost), ap: fmt(pattern.residualApCost) },
          )}
        </span>
        {pattern.totalSurplusValue > 0 && (
          <span style={{ color: 'var(--blue, #3b82f6)' }}>
            {t('event-craft-total-surplus', '余剰獲得 +{{amount}} {{unit}} 相当', {
              amount: fmt(pattern.totalSurplusValue),
              unit: t('unit-runs-full', '周回'),
            })}
          </span>
        )}
      </div>
    )
  }
  const unit = pattern.metric === 'ap' ? t('unit-ap', 'AP') : t('unit-runs-full', '周回')
  const residual = pattern.metric === 'ap' ? pattern.residualApCost : pattern.residualTurnCost
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span style={{ color: 'var(--text2)' }}>
        {t('event-craft-residual-single', '残余: {{amount}} {{unit}}', {
          amount: fmt(residual),
          unit,
        })}
      </span>
      {pattern.totalSaved > 0 && (
        <span className="font-semibold" style={{ color: 'var(--green)' }}>
          {t('event-craft-total-saved', '合計 −{{amount}} {{unit}} 節約', {
            amount: fmt(pattern.totalSaved),
            unit,
          })}
        </span>
      )}
    </div>
  )
}

const PatternCard = ({
  pattern,
  isSelected,
  onSelect,
  items,
  dropItems,
}: {
  pattern: EventCraftPlanPattern
  isSelected: boolean
  onSelect: () => void
  items: Item[]
  dropItems: Drops['items']
}) => {
  const { t } = useTranslation('material')
  const allocations = useMemo(
    () => sortAllocations(pattern.allocations.filter((a) => a.totalCount > 0)),
    [pattern.allocations],
  )
  const unitLabel = pattern.metric === 'ap' ? t('unit-ap', 'AP') : t('unit-runs', '周')
  const patternName = t(...PATTERN_NAME_KEYS[pattern.id])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      aria-label={patternName}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="flex cursor-pointer flex-col gap-2 rounded-lg p-3"
      style={{
        background: isSelected ? 'var(--panel2)' : 'var(--panel)',
        border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="text-sm font-bold"
          style={{ color: isSelected ? 'var(--gold)' : 'var(--text)' }}
        >
          {patternName}
        </span>
        <PatternEvaluation pattern={pattern} />
      </div>
      {pattern.aliasOf.length > 0 && (
        <span className="text-xs" style={{ color: 'var(--text3)' }}>
          {t('event-craft-alias-label', '同じ: {{names}}', {
            names: pattern.aliasOf.map((id) => t(...PATTERN_NAME_KEYS[id])).join('・'),
          })}
        </span>
      )}
      {allocations.length > 0 && (
        <CraftCardList
          allocations={allocations}
          items={items}
          dropItems={dropItems}
          unitLabel={unitLabel}
        />
      )}
      <LeftoverList leftover={pattern.leftoverIngredients} />
    </div>
  )
}

const PatternCardGroup = ({
  plan,
  selectedId,
  onSelect,
  items,
  dropItems,
}: {
  plan: EventCraftPlanResult
  selectedId: EventCraftPatternId
  onSelect: (id: EventCraftPatternId) => void
  items: Item[]
  dropItems: Drops['items']
}) => {
  const { t } = useTranslation('material')
  return (
    <div
      role="radiogroup"
      aria-label={t('event-craft-pattern-group-label', '最適化パターン')}
      className="flex flex-col gap-2"
    >
      {plan.patterns.map((pattern) => (
        <PatternCard
          key={pattern.id}
          pattern={pattern}
          isSelected={pattern.id === selectedId}
          onSelect={() => onSelect(pattern.id)}
          items={items}
          dropItems={dropItems}
        />
      ))}
    </div>
  )
}

type AdviceResolutionParams = {
  isDataLoading: boolean
  hasQuests: boolean
  selectedPattern: EventCraftPlanPattern | undefined
  ingredients: IngredientCounts
  t: AdviceTranslator
}

const resolveAdviceMessage = (params: AdviceResolutionParams): string => {
  const { isDataLoading, hasQuests, selectedPattern, ingredients, t } = params
  if (isDataLoading) {
    return t('event-craft-loading', 'ドロップデータを読み込み中です、先輩...')
  }
  if (!hasQuests || !selectedPattern) {
    return t(
      'event-craft-data-unavailable',
      'ドロップデータを取得できませんでした、先輩。通信環境を確認するか、時間をおいて再度お試しください。',
    )
  }
  return generateCraftAdvice(selectedPattern, ingredients, t)
}

const useEventCraftPlan = (
  drops: Drops & { isLoading?: boolean },
  fullNeed: Record<string, number>,
  config: EventCraftAdvisorConfig,
) => {
  const { t } = useTranslation('material')
  const questIds = useMemo(() => drops.quests.map((q) => q.id), [drops.quests])
  const isDataReady = !drops.isLoading && questIds.length > 0

  const plan = useMemo(() => {
    if (!isDataReady) return EMPTY_PLAN_RESULT
    return computeEventCraftPlan(drops, fullNeed, config.ingredients, questIds)
  }, [drops, fullNeed, config.ingredients, questIds, isDataReady])

  const selectedPatternId = resolveVisiblePatternId(plan, config.planPattern)
  const selectedPattern = plan.patterns.find((p) => p.id === selectedPatternId)

  const advice = useMemo(
    () =>
      resolveAdviceMessage({
        isDataLoading: !!drops.isLoading,
        hasQuests: questIds.length > 0,
        selectedPattern,
        ingredients: config.ingredients,
        t: (k, d, o) => t(k, d, o),
      }),
    [drops.isLoading, questIds.length, selectedPattern, config.ingredients, t],
  )

  return { plan, selectedPatternId, selectedPattern, advice, isDataReady }
}

const useAdvisorState = () => {
  const [config, setConfig] = useLocalStorage<EventCraftAdvisorConfig>(
    STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
    DEFAULT_EVENT_CRAFT_CONFIG,
    { onGet: migrateEventCraftConfig },
  )

  const setIngredientCount = useCallback(
    (type: IngredientType, count: number) => {
      setConfig((prev) => ({
        ...prev,
        ingredients: {
          ...prev.ingredients,
          [type]: Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)),
        },
      }))
    },
    [setConfig],
  )

  const selectPattern = useCallback(
    (planPattern: EventCraftPatternId) =>
      setConfig((prev) => ({ ...prev, planPattern })),
    [setConfig],
  )

  const reset = useCallback(
    () => setConfig(DEFAULT_EVENT_CRAFT_CONFIG),
    [setConfig],
  )

  return { config, setIngredientCount, selectPattern, reset }
}

export const EventCraftAdvisor = ({
  items = [],
  fullNeed,
}: EventCraftAdvisorProps) => {
  const drops = useDrops()
  const { config, setIngredientCount, selectPattern, reset } = useAdvisorState()
  const { plan, selectedPatternId, selectedPattern, advice, isDataReady } =
    useEventCraftPlan(drops, fullNeed, config)
  const { t } = useTranslation('material')
  const unitLabel =
    selectedPattern?.metric === 'ap' ? t('unit-ap', 'AP') : t('unit-runs', '周')

  return (
    <div className="flex flex-col gap-4">
      <IngredientInputs
        ingredients={config.ingredients}
        onChange={setIngredientCount}
      />
      <ServantPraise message={advice} size={44} />
      {plan.patterns.length > 0 && (
        <PatternCardGroup
          plan={plan}
          selectedId={selectedPatternId}
          onSelect={selectPattern}
          items={items}
          dropItems={drops.items}
        />
      )}
      {isDataReady && selectedPattern && (
        <>
          <EventCraftExpectedYields
            entries={sumExpectedCraftYields(
              selectedPattern.allocations.filter((a) => a.totalCount > 0),
            )}
          />
          <LeftoverFooter
            leftover={selectedPattern.leftoverIngredients}
            hasInputs={Object.values(config.ingredients).some((v) => v > 0)}
            totalSaved={selectedPattern.totalSaved}
            totalSurplusValue={selectedPattern.totalSurplusValue}
            unitLabel={unitLabel}
            onReset={reset}
          />
        </>
      )}
    </div>
  )
}

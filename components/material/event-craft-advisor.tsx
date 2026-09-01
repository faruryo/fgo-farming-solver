'use client'

import Image from 'next/image'
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useDrops } from '../../hooks/use-drops'
import { Item } from '../../interfaces/atlas-academy'
import { Drops } from '../../lib/get-drops'
import { getItemIconUrl } from '../../lib/get-item-icon-url'
import type { EventCraftAllocationWorkerRequest } from '../../lib/event-craft-allocation.worker'
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
  EVENT_CRAFT_RECIPES_2026,
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
  stockEnabled?: boolean
}

export type EventCraftAdvisorConfig = {
  ingredients: IngredientCounts
  planPattern: EventCraftPatternId
}

const DEFAULT_EVENT_CRAFT_CONFIG: EventCraftAdvisorConfig = {
  ingredients: { seafood: 0, meat: 0, vegetable: 0 },
  planPattern: 'runs',
}

export const INGREDIENT_COMMIT_DELAY_MS = 3000

const clampIngredientCount = (count: number) =>
  Math.max(0, Math.floor(Number.isFinite(count) ? count : 0))

const sameIngredientCounts = (a: IngredientCounts, b: IngredientCounts) =>
  a.seafood === b.seafood && a.meat === b.meat && a.vegetable === b.vegetable

const PATTERN_IDS: readonly EventCraftPatternId[] = [
  'runs',
  'ap',
  'even-turn',
  'even-ap',
  'exhaust',
]

const isPatternId = (value: unknown): value is EventCraftPatternId =>
  typeof value === 'string' &&
  (PATTERN_IDS as readonly string[]).includes(value)

export const migrateEventCraftConfig = (
  raw: unknown,
): EventCraftAdvisorConfig => {
  const value =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ingredients =
    value.ingredients && typeof value.ingredients === 'object'
      ? (value.ingredients as IngredientCounts)
      : DEFAULT_EVENT_CRAFT_CONFIG.ingredients
  if (isPatternId(value.planPattern)) {
    return { ingredients, planPattern: value.planPattern }
  }
  if ('exhaustIngredients' in value) {
    return {
      ingredients,
      planPattern: value.exhaustIngredients === true ? 'exhaust' : 'runs',
    }
  }
  return { ingredients, planPattern: 'runs' }
}

const ingredientCount = (
  ingredients: IngredientCounts,
  type: IngredientType,
) => {
  if (type === 'seafood') return ingredients.seafood ?? 0
  if (type === 'meat') return ingredients.meat ?? 0
  return ingredients.vegetable ?? 0
}

const patternNameArgs = (id: EventCraftPatternId): [string, string] => {
  if (id === 'ap') return ['event-craft-pattern-ap', 'APを減らす']
  if (id === 'even-turn')
    return ['event-craft-pattern-even-turn', '満遍なく（周回）']
  if (id === 'even-ap') return ['event-craft-pattern-even-ap', '満遍なく（AP）']
  if (id === 'exhaust') return ['event-craft-pattern-exhaust', '食材を使い切る']
  return ['event-craft-pattern-runs', '周回を減らす']
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

type IngredientInputItemProps = {
  ing: (typeof EVENT_INGREDIENTS)[number]
  count: number
  onChange: (type: IngredientType, count: number) => void
}

const IngredientInputItem = ({
  ing,
  count,
  onChange,
}: IngredientInputItemProps) => {
  const { t } = useTranslation('material')
  return (
    <label
      className="flex items-center justify-between gap-2 rounded px-2 py-1.5 cursor-pointer"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Image
          src={ing.iconUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 flex-shrink-0 object-contain rounded"
        />
        <span
          className="truncate text-xs font-medium"
          style={{ color: 'var(--text)' }}
        >
          {t(`ingredient-${ing.id}`, ing.name)}
        </span>
      </div>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        className="h-8 w-20 text-right"
        value={count === 0 ? '' : count}
        placeholder="0"
        onChange={(e) => onChange(ing.id, Number(e.target.value))}
      />
    </label>
  )
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
          <IngredientInputItem
            key={ing.id}
            ing={ing}
            count={ingredientCount(ingredients, ing.id)}
            onChange={onChange}
          />
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
      {item.totalCount === 0 && (
        <span className="text-xs" style={{ color: 'var(--text3)' }}>
          {t('event-craft-rec-zero', '推奨 0')}
        </span>
      )}
    </div>
  )
}

const CraftCardCosts = ({ costs }: { costs: IngredientCounts }) => {
  const { t } = useTranslation('material')
  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      aria-label={t(
        'event-craft-costs-format',
        '{{seafood}}海鮮 / {{meat}}お肉 / {{vegetable}}野菜',
        {
          seafood: costs.seafood,
          meat: costs.meat,
          vegetable: costs.vegetable,
        },
      )}
    >
      {EVENT_INGREDIENTS.map((ing) => {
        const amount = costs[ing.id]
        if (amount <= 0) return null
        return (
          <span
            key={ing.id}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            <Image
              src={ing.iconUrl}
              alt={t(`ingredient-${ing.id}-short`, ing.shortName)}
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
            />
            <span className="font-semibold" style={{ color: 'var(--text)' }}>
              {amount}
            </span>
          </span>
        )
      })}
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
      className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"
      style={{ color: 'var(--text2)' }}
    >
      <CraftCardCosts costs={costs} />
      <div className="flex items-center gap-2 font-medium ml-auto">
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

const CraftCardImage = ({
  dishIconUrl,
  materialIconUrl,
  materialName,
}: {
  dishIconUrl?: string
  materialIconUrl: string | null
  materialName: string
}) => {
  const mainIcon = dishIconUrl || materialIconUrl

  return (
    <div className="relative h-10 w-10 flex-shrink-0">
      {mainIcon ? (
        <Image
          src={mainIcon}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 object-contain rounded"
        />
      ) : (
        <div
          className="h-10 w-10 rounded"
          style={{ background: 'var(--border)' }}
        />
      )}
      {dishIconUrl && materialIconUrl && (
        <div
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full p-0.5 shadow"
          style={{
            background: 'var(--panel2)',
            border: '1px solid var(--border)',
          }}
        >
          <Image
            src={materialIconUrl}
            alt={materialName}
            width={18}
            height={18}
            className="h-4 w-4 object-contain rounded-full"
          />
        </div>
      )}
    </div>
  )
}

const RARITY_FALLBACK: Record<RecipeMaterialRarity, string> = {
  bronze: '銅',
  silver: '銀',
  gold: '金',
}

const PerDishYieldLine = ({
  recipe,
  materialName,
  deficitNeed,
  deficitCount,
}: {
  recipe: EventCraftRecipe
  materialName: string
  deficitNeed: number
  deficitCount: number
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
      {deficitNeed > 0 ? (
        <span className="ml-2">
          {t('event-craft-deficit-need', '不足 あと{{amount}}個', {
            amount: deficitNeed,
          })}
        </span>
      ) : (
        deficitCount > 0 && (
          <span className="ml-2">
            {t(
              'event-craft-deficit-need-byproduct',
              'この素材の不足はなし(同レア素材のついで獲得のため採用)',
            )}
          </span>
        )
      )}
    </p>
  )
}

const CraftCardHeader = ({
  dishName,
  materialName,
  item,
}: {
  dishName: string
  materialName: string
  item: CraftAllocationItem
}) => (
  <div className="flex items-center justify-between gap-2">
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="truncate text-sm font-semibold"
        style={{ color: 'var(--text)' }}
      >
        {dishName}
      </span>
      <span className="truncate text-xs" style={{ color: 'var(--text3)' }}>
        ({materialName})
      </span>
    </div>
    <CraftCardBadges item={item} />
  </div>
)

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
  const materialIconUrl = getItemIcon(catItem, dropItem)
  const isSelected = item.totalCount > 0
  const dishName = t(`recipe-${recipe.id}`, recipe.name)
  const materialName = t(
    `material-${recipe.targetItem.shortId}`,
    catItem?.name ?? recipe.targetItem.name,
  )

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{
        background: isSelected ? 'var(--panel2)' : 'var(--panel)',
        border: isSelected
          ? '1px solid var(--border2)'
          : '1px solid var(--border)',
        opacity: isSelected ? 1 : 0.75,
      }}
    >
      <CraftCardImage
        dishIconUrl={recipe.iconUrl}
        materialIconUrl={materialIconUrl}
        materialName={materialName}
      />
      <div className="min-w-0 flex-1">
        <CraftCardHeader
          dishName={dishName}
          materialName={materialName}
          item={item}
        />
        <PerDishYieldLine
          recipe={recipe}
          materialName={materialName}
          deficitNeed={item.deficitNeed}
          deficitCount={item.deficitCount}
        />
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
    <div
      className="flex flex-col gap-2 rounded-lg p-3"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <span className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>
        {t('event-craft-expected-yields-heading', 'この配分での期待獲得')}
      </span>
      <div
        className="flex flex-wrap gap-2 text-xs"
        style={{ color: 'var(--text)' }}
      >
        {entries.map((entry) => {
          const iconUrl = entry.atlasId
            ? getItemIconUrl(String(entry.atlasId))
            : ''
          return (
            <div
              key={entry.shortId}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              {iconUrl && (
                <Image
                  src={iconUrl}
                  alt={t(`material-${entry.shortId}`, entry.name)}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain rounded"
                />
              )}
              <span className="font-medium" style={{ color: 'var(--text)' }}>
                {t('event-craft-expected-yield-amount', '{{name}} {{amount}}', {
                  name: t(`material-${entry.shortId}`, entry.name),
                  amount: fmt(entry.amount),
                })}
              </span>
            </div>
          )
        })}
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
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
        {EVENT_INGREDIENTS.map((ing) => (
          <div key={ing.id} className="flex items-center gap-1">
            <Image
              src={ing.iconUrl}
              alt=""
              width={18}
              height={18}
              className="h-4.5 w-4.5 object-contain"
            />
            <span style={{ color: 'var(--text)' }}>
              {t(`ingredient-${ing.id}-short`, ing.shortName)}{' '}
              {leftover[ing.id]}
            </span>
          </div>
        ))}
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
          <span
            className="font-semibold text-sm"
            style={{ color: 'var(--green)' }}
          >
            {t('event-craft-total-saved', '合計 −{{amount}} {{unit}} 節約', {
              amount: fmt(totalSaved),
              unit: unitLabel,
            })}
          </span>
        )}
        {totalSurplusValue > 0 && (
          <span
            className="font-semibold text-sm"
            style={{ color: 'var(--blue, #3b82f6)' }}
          >
            {t(
              'event-craft-total-surplus',
              '余剰獲得 +{{amount}} {{unit}} 相当',
              {
                amount: fmt(totalSurplusValue),
                unit: unitLabel,
              },
            )}
          </span>
        )}
      </div>
    </div>
  )
}

const EMPTY_PLAN_RESULT: EventCraftPlanResult = {
  patterns: [],
  absorbedInto: {},
}

const sortAllocations = (allocations: CraftAllocationItem[]) =>
  [...allocations].sort((a, b) => {
    if (a.totalCount > 0 && b.totalCount === 0) return -1
    if (a.totalCount === 0 && b.totalCount > 0) return 1
    return b.deficitSaved + b.surplusValue - (a.deficitSaved + a.surplusValue)
  })

type AdviceResolutionParams = {
  isDataLoading: boolean
  isPlanLoading: boolean
  didPlanTimeout: boolean
  hasQuests: boolean
  selectedPattern: EventCraftPlanPattern | undefined
  ingredients: IngredientCounts
  t: AdviceTranslator
}

const resolveAdviceMessage = (params: AdviceResolutionParams) => {
  const {
    isDataLoading,
    isPlanLoading,
    didPlanTimeout,
    hasQuests,
    selectedPattern,
    ingredients,
    t,
  } = params
  if (isDataLoading) {
    return t('event-craft-loading', 'ドロップデータを読み込み中です、先輩...')
  }
  if (isPlanLoading) {
    return t(
      'event-craft-plan-computing',
      '最適な配分を計算しています、先輩...',
    )
  }
  if (didPlanTimeout) {
    return t(
      'event-craft-plan-timeout',
      '配分の計算が時間内に終わりませんでした、先輩。通信や端末の負荷を確認するか、時間をおいて再度お試しください。',
    )
  }
  if (!hasQuests || !selectedPattern) {
    return t(
      'event-craft-data-unavailable',
      'ドロップデータを取得できませんでした、先輩。通信環境を確認するか、時間をおいて再度お試しください。',
    )
  }
  const mode = selectedPattern.metric === 'ap' ? 'ap' : 'turn'
  return generateCraftAdvice(
    {
      ...selectedPattern,
      baselineCost:
        mode === 'ap'
          ? selectedPattern.baselineApCost
          : selectedPattern.baselineTurnCost,
      optimalCost:
        mode === 'ap'
          ? selectedPattern.residualApCost
          : selectedPattern.residualTurnCost,
    },
    ingredients,
    mode,
    selectedPattern.id === 'exhaust',
    (k, d, o) => t(k, d, o),
  )
}

const WORKER_HARD_TIMEOUT_MS = 10000

const spawnEventCraftAllocationWorker = (
  request: EventCraftAllocationWorkerRequest,
  onSettled: (result: EventCraftPlanResult, timedOut: boolean) => void,
): (() => void) => {
  let settled = false
  const worker = new Worker(
    new URL('../../lib/event-craft-allocation.worker', import.meta.url),
  )

  const finish = (result: EventCraftPlanResult, timedOut: boolean) => {
    if (settled) return
    settled = true
    clearTimeout(hardTimeout)
    worker.terminate()
    onSettled(result, timedOut)
  }
  const hardTimeout = setTimeout(
    () => finish(EMPTY_PLAN_RESULT, true),
    WORKER_HARD_TIMEOUT_MS,
  )

  worker.onmessage = (e: MessageEvent<EventCraftPlanResult>) =>
    finish(e.data, false)
  worker.onerror = () => finish(EMPTY_PLAN_RESULT, true)
  worker.postMessage(request)

  return () => {
    settled = true
    clearTimeout(hardTimeout)
    worker.terminate()
  }
}

const useEventCraftWorkerResult = (
  enabled: boolean,
  request: EventCraftAllocationWorkerRequest | null,
  requestKey: string,
) => {
  const [settled, setSettled] = useState<{
    key: string
    result: EventCraftPlanResult
    timedOut: boolean
  } | null>(null)

  useEffect(() => {
    if (!enabled || request == null) return
    const key = requestKey
    return spawnEventCraftAllocationWorker(request, (result, timedOut) => {
      setSettled({ key, result, timedOut })
    })
  }, [enabled, request, requestKey])

  const isPlanLoading = enabled && settled?.key !== requestKey
  const result = settled?.key === requestKey ? settled.result : null
  const didPlanTimeout = settled?.key === requestKey && settled.timedOut
  return { result, isPlanLoading, didPlanTimeout }
}

const useEventCraftPlan = (
  drops: Drops & { isLoading?: boolean },
  fullNeed: Record<string, number>,
  ingredients: IngredientCounts,
  isIngredientCommitPending: boolean,
) => {
  const questIds = useMemo(() => drops.quests.map((q) => q.id), [drops.quests])
  const isDataReady = !drops.isLoading && questIds.length > 0
  const canUseWorker = typeof Worker !== 'undefined'
  const workerRequest =
    useMemo((): EventCraftAllocationWorkerRequest | null => {
      if (!canUseWorker || !isDataReady) return null
      return {
        drops,
        fullNeed,
        ownedIngredients: ingredients,
        questIds,
        options: { recipes: EVENT_CRAFT_RECIPES_2026 },
      }
    }, [canUseWorker, isDataReady, drops, fullNeed, ingredients, questIds])
  const requestKey = `${questIds.join(',')}:${JSON.stringify(ingredients)}:${JSON.stringify(fullNeed)}`
  const worker = useEventCraftWorkerResult(
    canUseWorker && isDataReady,
    workerRequest,
    requestKey,
  )
  const syncPlan = useMemo(
    () =>
      canUseWorker || !isDataReady
        ? EMPTY_PLAN_RESULT
        : computeEventCraftPlan(drops, fullNeed, ingredients, questIds),
    [canUseWorker, isDataReady, drops, fullNeed, ingredients, questIds],
  )
  return {
    questIds,
    isDataReady,
    plan: canUseWorker ? (worker.result ?? EMPTY_PLAN_RESULT) : syncPlan,
    isPlanLoading: isIngredientCommitPending || worker.isPlanLoading,
    didPlanTimeout: worker.didPlanTimeout,
  }
}

const useEventCraftCalculation = (
  drops: Drops & { isLoading?: boolean },
  fullNeed: Record<string, number>,
  config: EventCraftAdvisorConfig,
  isIngredientCommitPending: boolean,
) => {
  const { questIds, isDataReady, plan, isPlanLoading, didPlanTimeout } =
    useEventCraftPlan(
      drops,
      fullNeed,
      config.ingredients,
      isIngredientCommitPending,
    )
  const selectedPatternId = resolveVisiblePatternId(plan, config.planPattern)
  const selectedPattern = plan.patterns.find(
    (pattern) => pattern.id === selectedPatternId,
  )
  const { t } = useTranslation('material')
  const advice = useMemo(
    () =>
      resolveAdviceMessage({
        isDataLoading: !!drops.isLoading,
        isPlanLoading,
        didPlanTimeout,
        hasQuests: questIds.length > 0,
        selectedPattern,
        ingredients: config.ingredients,
        t: (key, fallback, options) => t(key, fallback, options),
      }),
    [
      config.ingredients,
      didPlanTimeout,
      drops.isLoading,
      isPlanLoading,
      questIds.length,
      selectedPattern,
      t,
    ],
  )
  return {
    plan,
    selectedPattern,
    selectedPatternId,
    advice,
    isDataReady,
    isPlanLoading,
    didPlanTimeout,
  }
}

const useAdvisorState = () => {
  const [config, setConfig] = useLocalStorage<EventCraftAdvisorConfig>(
    STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
    DEFAULT_EVENT_CRAFT_CONFIG,
    { onGet: migrateEventCraftConfig },
  )
  const [draftIngredients, setDraftIngredients] = useState(
    DEFAULT_EVENT_CRAFT_CONFIG.ingredients,
  )
  const [ingredientsDirty, setIngredientsDirty] = useState(false)
  const visibleIngredients = ingredientsDirty
    ? draftIngredients
    : config.ingredients
  const isIngredientCommitPending =
    ingredientsDirty &&
    !sameIngredientCounts(draftIngredients, config.ingredients)

  useEffect(() => {
    if (!isIngredientCommitPending) return
    const timer = window.setTimeout(() => {
      setConfig((previous) => ({
        ...previous,
        ingredients: draftIngredients,
      }))
    }, INGREDIENT_COMMIT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draftIngredients, isIngredientCommitPending, setConfig])

  const setIngredientCount = useCallback(
    (type: IngredientType, count: number) => {
      const next = clampIngredientCount(count)
      setDraftIngredients((previous) => {
        const base = ingredientsDirty ? previous : config.ingredients
        if (type === 'seafood') return { ...base, seafood: next }
        if (type === 'meat') return { ...base, meat: next }
        return { ...base, vegetable: next }
      })
      setIngredientsDirty(true)
    },
    [config.ingredients, ingredientsDirty],
  )

  const selectPattern = useCallback(
    (planPattern: EventCraftPatternId) =>
      setConfig((prev) => ({ ...prev, planPattern })),
    [setConfig],
  )

  const reset = useCallback(() => {
    setIngredientsDirty(false)
    setDraftIngredients(DEFAULT_EVENT_CRAFT_CONFIG.ingredients)
    setConfig(DEFAULT_EVENT_CRAFT_CONFIG)
  }, [setConfig])

  return {
    config,
    draftIngredients: visibleIngredients,
    isIngredientCommitPending,
    setConfig,
    setIngredientCount,
    selectPattern,
    reset,
  }
}

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
      <span className="text-xs" style={{ color: 'var(--text2)' }}>
        {t(
          'event-craft-residual-reference',
          '残余参考: {{turn}} 周 / {{ap}} AP',
          {
            turn: fmt(pattern.residualTurnCost),
            ap: fmt(pattern.residualApCost),
          },
        )}
      </span>
    )
  }
  const unit =
    pattern.metric === 'ap' ? t('unit-ap', 'AP') : t('unit-runs-full', '周回')
  const amount =
    pattern.metric === 'ap' ? pattern.residualApCost : pattern.residualTurnCost
  return (
    <span className="text-xs" style={{ color: 'var(--text2)' }}>
      {t('event-craft-residual-single', '残余: {{amount}} {{unit}}', {
        amount: fmt(amount),
        unit,
      })}
    </span>
  )
}

const PatternAliasLine = ({
  aliases,
}: {
  aliases: readonly EventCraftPatternId[]
}) => {
  const { t } = useTranslation('material')
  if (aliases.length === 0) return null
  return (
    <span className="text-xs" style={{ color: 'var(--text3)' }}>
      {t('event-craft-alias-label', '同じ: {{names}}', {
        names: aliases
          .map((id) => {
            const args = patternNameArgs(id)
            return t(args[0], args[1])
          })
          .join('・'),
      })}
    </span>
  )
}

type PatternCardProps = {
  pattern: EventCraftPlanPattern
  selected: boolean
  onSelect: () => void
  items: Item[]
  dropItems: Drops['items']
}

const PatternCardContent = ({
  pattern,
  name,
  selected,
  allocations,
  items,
  dropItems,
  unit,
}: {
  pattern: EventCraftPlanPattern
  name: string
  selected: boolean
  allocations: CraftAllocationItem[]
  items: Item[]
  dropItems: Drops['items']
  unit: string
}) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span
        className="text-sm font-bold"
        style={{ color: selected ? 'var(--gold)' : 'var(--text)' }}
      >
        {name}
      </span>
      <PatternEvaluation pattern={pattern} />
    </div>
    <PatternAliasLine aliases={pattern.aliasOf} />
    {allocations.length > 0 && (
      <CraftCardList
        allocations={allocations}
        items={items}
        dropItems={dropItems}
        unitLabel={unit}
      />
    )}
    <LeftoverList leftover={pattern.leftoverIngredients} />
  </>
)

const PatternCard = ({
  pattern,
  selected,
  onSelect,
  items,
  dropItems,
}: PatternCardProps) => {
  const { t } = useTranslation('material')
  const nameArgs = patternNameArgs(pattern.id)
  const name = t(nameArgs[0], nameArgs[1])
  const allocations = sortAllocations(
    pattern.allocations.filter((allocation) => allocation.totalCount > 0),
  )
  const unit =
    pattern.metric === 'ap' ? t('unit-ap', 'AP') : t('unit-runs', '周')
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect()
  }
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-label={name}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="flex cursor-pointer flex-col gap-2 rounded-lg p-3"
      style={{
        background: selected ? 'var(--panel2)' : 'var(--panel)',
        border: selected ? '1px solid var(--gold)' : '1px solid var(--border)',
      }}
    >
      <PatternCardContent
        pattern={pattern}
        name={name}
        selected={selected}
        allocations={allocations}
        items={items}
        dropItems={dropItems}
        unit={unit}
      />
    </div>
  )
}

type EventCraftPlanSectionProps = {
  plan: EventCraftPlanResult
  selectedPattern?: EventCraftPlanPattern
  selectedPatternId: EventCraftPatternId
  items: Item[]
  dropItems: Drops['items']
  unitLabel: string
  leftover: IngredientCounts
  hasInputs: boolean
  onSelectPattern: (id: EventCraftPatternId) => void
  onReset: () => void
}

const EventCraftPlanSection = ({
  plan,
  selectedPattern,
  selectedPatternId,
  items,
  dropItems,
  unitLabel,
  leftover,
  hasInputs,
  onSelectPattern,
  onReset,
}: EventCraftPlanSectionProps) => {
  const { t } = useTranslation('material')
  return (
    <>
      <div
        role="radiogroup"
        aria-label={t('event-craft-pattern-group-label', '最適化パターン')}
        className="flex flex-col gap-2"
      >
        {plan.patterns.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            selected={pattern.id === selectedPatternId}
            onSelect={() => onSelectPattern(pattern.id)}
            items={items}
            dropItems={dropItems}
          />
        ))}
      </div>
      {selectedPattern && (
        <>
          <EventCraftExpectedYields
            entries={sumExpectedCraftYields(
              selectedPattern.allocations.filter(
                (allocation) => allocation.totalCount > 0,
              ),
            )}
          />
          <LeftoverFooter
            leftover={leftover}
            hasInputs={hasInputs}
            totalSaved={selectedPattern.totalSaved}
            totalSurplusValue={selectedPattern.totalSurplusValue}
            unitLabel={unitLabel}
            onReset={onReset}
          />
        </>
      )}
    </>
  )
}

const EMPTY_LEFTOVER: IngredientCounts = {
  seafood: 0,
  meat: 0,
  vegetable: 0,
}

const StockEvalBadge = () => {
  const { t } = useTranslation('material')
  return (
    <span
      className="self-start text-xs font-semibold"
      style={{ color: 'var(--gold)' }}
    >
      {t('event-craft-stock-eval', 'ストック込みで評価中')}
    </span>
  )
}

export const EventCraftAdvisor = ({
  items = [],
  fullNeed,
  stockEnabled = false,
}: EventCraftAdvisorProps) => {
  const drops = useDrops()
  const state = useAdvisorState()
  const calc = useEventCraftCalculation(
    drops,
    fullNeed,
    state.config,
    state.isIngredientCommitPending,
  )
  const { t } = useTranslation('material')
  const unitLabel =
    calc.selectedPattern?.metric === 'ap'
      ? t('unit-ap', 'AP')
      : t('unit-runs', '周')
  const showPlan =
    calc.isDataReady && !calc.isPlanLoading && !calc.didPlanTimeout
  return (
    <div className="flex flex-col gap-4">
      {stockEnabled && <StockEvalBadge />}
      <IngredientInputs
        ingredients={state.draftIngredients}
        onChange={state.setIngredientCount}
      />
      <ServantPraise message={calc.advice} size={44} />
      {showPlan && (
        <EventCraftPlanSection
          plan={calc.plan}
          selectedPattern={calc.selectedPattern}
          selectedPatternId={calc.selectedPatternId}
          items={items}
          dropItems={drops.items}
          unitLabel={unitLabel}
          leftover={calc.selectedPattern?.leftoverIngredients ?? EMPTY_LEFTOVER}
          hasInputs={Object.values(state.config.ingredients).some(
            (value) => value > 0,
          )}
          onSelectPattern={state.selectPattern}
          onReset={state.reset}
        />
      )}
    </div>
  )
}

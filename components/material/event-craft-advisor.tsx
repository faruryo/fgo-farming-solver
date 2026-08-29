'use client'

import Image from 'next/image'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useDrops } from '../../hooks/use-drops'
import { Item } from '../../interfaces/atlas-academy'
import { Drops } from '../../lib/get-drops'
import { getItemIconUrl } from '../../lib/get-item-icon-url'
import { DenominatorMode } from '../../lib/material-selection-advisor'
import {
  solveEventCraftAllocation,
  generateCraftAdvice,
  computeSingleItemBaseValues,
  CraftAllocationItem,
  EventCraftSolverResult,
  AdviceTranslator,
} from '../../lib/event-craft-advisor'
import {
  EVENT_CRAFT_RECIPES_2026,
  EVENT_INGREDIENTS,
  IngredientCounts,
  IngredientType,
} from '../../data/event-craft-recipes'
import { ServantPraise } from '../farming/ServantPraise'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export type EventCraftAdvisorProps = {
  items?: Item[]
  fullNeed: Record<string, number>
  mode: DenominatorMode
  onModeChange: (mode: DenominatorMode) => void
  stockEnabled: boolean
}

export type EventCraftAdvisorConfig = {
  ingredients: IngredientCounts
  exhaustIngredients: boolean
}

const DEFAULT_EVENT_CRAFT_CONFIG: EventCraftAdvisorConfig = {
  ingredients: { seafood: 0, meat: 0, vegetable: 0 },
  exhaustIngredients: false,
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

const AdvisorModeSwitch = ({
  mode,
  onModeChange,
  stockEnabled,
}: {
  mode: DenominatorMode
  onModeChange: (mode: DenominatorMode) => void
  stockEnabled: boolean
}) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        style={{
          color: mode === 'ap' ? 'var(--gold)' : 'var(--text3)',
          fontWeight: 600,
        }}
      >
        {t('event-craft-ap-mode', 'AP節約優先')}
      </span>
      <Switch
        checked={mode === 'turn'}
        onCheckedChange={(c) => onModeChange(c ? 'turn' : 'ap')}
        aria-label={t('mode-switch', '最適化モード切り替え')}
      />
      <span
        style={{
          color: mode === 'turn' ? 'var(--gold)' : 'var(--text3)',
          fontWeight: 600,
        }}
      >
        {t('event-craft-turn-mode', '周回数節約優先')}
      </span>
      {stockEnabled && (
        <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 11 }}>
          {t('event-craft-stock-eval', 'ストック込みで評価中')}
        </span>
      )}
    </div>
  )
}

const AdvisorExhaustSwitch = ({
  exhaust,
  onExhaustChange,
}: {
  exhaust: boolean
  onExhaustChange: (exhaust: boolean) => void
}) => {
  const { t } = useTranslation('material')
  return (
    <div className="flex items-center gap-2 text-sm">
      <span style={{ color: exhaust ? 'var(--gold)' : 'var(--text2)' }}>
        {t('event-craft-exhaust-label', '食材を使い切る')}
      </span>
      <Switch
        checked={exhaust}
        onCheckedChange={onExhaustChange}
        aria-label={t('event-craft-exhaust-label', '食材を使い切る')}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={t('detail-desc', '詳しい説明')}
              className="inline-flex items-center justify-center rounded-full outline-none"
              style={{ color: 'var(--text3)' }}
            />
          }
        >
          <Info className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[16rem] text-left">
          {t(
            'event-craft-exhaust-tooltip',
            '不足素材を満たした後も、余った食材で単体価値の高い料理を作成して食材の余剰を最小化します。',
          )}
        </TooltipContent>
      </Tooltip>
    </div>
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
      {item.totalCount === 0 && (
        <span className="text-xs" style={{ color: 'var(--text3)' }}>
          {t('event-craft-rec-zero', '推奨 0')}
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
  const isSelected = item.totalCount > 0
  const materialName = t(
    `material-${recipe.targetItem.shortId}`,
    catItem?.name ?? recipe.targetItem.name,
  )

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{
        background: isSelected ? 'var(--panel2)' : 'var(--panel)',
        border: isSelected ? '1px solid var(--border2)' : '1px solid var(--border)',
        opacity: isSelected ? 1 : 0.75,
      }}
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

const EMPTY_ALLOCATION_RESULT: EventCraftSolverResult = {
  allocations: [],
  totalCrafted: 0,
  totalDeficitCrafted: 0,
  totalSurplusCrafted: 0,
  totalSaved: 0,
  totalSurplusValue: 0,
  spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
  leftoverIngredients: { seafood: 0, meat: 0, vegetable: 0 },
  baselineCost: 0,
  optimalCost: 0,
}

const sortAllocations = (allocations: CraftAllocationItem[]) =>
  [...allocations].sort((a, b) => {
    if (a.totalCount > 0 && b.totalCount === 0) return -1
    if (a.totalCount === 0 && b.totalCount > 0) return 1
    return b.deficitSaved + b.surplusValue - (a.deficitSaved + a.surplusValue)
  })

type AdviceResolutionParams = {
  isDataLoading: boolean
  hasQuests: boolean
  result: EventCraftSolverResult
  config: EventCraftAdvisorConfig
  mode: DenominatorMode
  t: AdviceTranslator
}

const resolveAdviceMessage = (params: AdviceResolutionParams) => {
  const { isDataLoading, hasQuests, result, config, mode, t } = params
  if (isDataLoading) {
    return t('event-craft-loading', 'ドロップデータを読み込み中です、先輩...')
  }
  if (!hasQuests) {
    return t(
      'event-craft-data-unavailable',
      'ドロップデータを取得できませんでした、先輩。通信環境を確認するか、時間をおいて再度お試しください。',
    )
  }
  return generateCraftAdvice(
    result,
    config.ingredients,
    mode,
    config.exhaustIngredients,
    (k, d, o) => t(k, d, o),
  )
}

type CalculationParams = {
  drops: Drops & { isLoading?: boolean }
  fullNeed: Record<string, number>
  config: EventCraftAdvisorConfig
  mode: DenominatorMode
  questIds: string[]
  singleItemBaseValues: Map<string, number>
  isDataReady: boolean
}

const calculateEventCraftResult = (params: CalculationParams): EventCraftSolverResult => {
  const {
    drops,
    fullNeed,
    config,
    mode,
    questIds,
    singleItemBaseValues,
    isDataReady,
  } = params
  if (!isDataReady) {
    return {
      ...EMPTY_ALLOCATION_RESULT,
      leftoverIngredients: { ...config.ingredients },
    }
  }
  return solveEventCraftAllocation(
    drops,
    fullNeed,
    config.ingredients,
    mode,
    questIds,
    {
      exhaustIngredients: config.exhaustIngredients,
      recipes: EVENT_CRAFT_RECIPES_2026,
      singleItemBaseValues,
    },
  )
}

const useEventCraftCalculation = (
  drops: Drops & { isLoading?: boolean },
  fullNeed: Record<string, number>,
  config: EventCraftAdvisorConfig,
  mode: DenominatorMode,
) => {
  const { t } = useTranslation('material')
  const questIds = useMemo(() => drops.quests.map((q) => q.id), [drops.quests])
  const isDataReady = !drops.isLoading && questIds.length > 0

  const singleItemBaseValues = useMemo(() => {
    if (!isDataReady) return new Map<string, number>()
    return computeSingleItemBaseValues(drops, questIds, mode, {
      recipes: EVENT_CRAFT_RECIPES_2026,
    })
  }, [drops, questIds, mode, isDataReady])

  const result = useMemo(
    () =>
      calculateEventCraftResult({
        drops,
        fullNeed,
        config,
        mode,
        questIds,
        singleItemBaseValues,
        isDataReady,
      }),
    [
      drops,
      fullNeed,
      config,
      mode,
      questIds,
      singleItemBaseValues,
      isDataReady,
    ],
  )

  const advice = useMemo(
    () =>
      resolveAdviceMessage({
        isDataLoading: !!drops.isLoading,
        hasQuests: questIds.length > 0,
        result,
        config,
        mode,
        t: (k, d, o) => t(k, d, o),
      }),
    [drops.isLoading, questIds.length, result, config, mode, t],
  )

  const sortedAllocations = useMemo(
    () => (isDataReady ? sortAllocations(result.allocations) : []),
    [result.allocations, isDataReady],
  )

  return { result, advice, sortedAllocations, isDataReady }
}

const useAdvisorState = () => {
  const [config, setConfig] = useLocalStorage<EventCraftAdvisorConfig>(
    STORAGE_KEYS.EVENT_CRAFT_ADVISOR,
    DEFAULT_EVENT_CRAFT_CONFIG,
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

  const setExhaust = useCallback(
    (exhaustIngredients: boolean) =>
      setConfig((prev) => ({ ...prev, exhaustIngredients })),
    [setConfig],
  )

  const reset = useCallback(
    () => setConfig(DEFAULT_EVENT_CRAFT_CONFIG),
    [setConfig],
  )

  return { config, setIngredientCount, setExhaust, reset }
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

export const EventCraftAdvisor = ({
  items = [],
  fullNeed,
  mode,
  onModeChange,
  stockEnabled,
}: EventCraftAdvisorProps) => {
  const drops = useDrops()
  const { config, setIngredientCount, setExhaust, reset } = useAdvisorState()
  const { result, advice, sortedAllocations, isDataReady } =
    useEventCraftCalculation(drops, fullNeed, config, mode)
  const { t } = useTranslation('material')
  const unitLabel = mode === 'ap' ? t('unit-ap', 'AP') : t('unit-runs', '周')

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdvisorModeSwitch
            mode={mode}
            onModeChange={onModeChange}
            stockEnabled={stockEnabled}
          />
          <AdvisorExhaustSwitch
            exhaust={config.exhaustIngredients}
            onExhaustChange={setExhaust}
          />
        </div>
        <IngredientInputs
          ingredients={config.ingredients}
          onChange={setIngredientCount}
        />
        <ServantPraise message={advice} size={44} />
        {isDataReady && (
          <>
            <CraftCardList
              allocations={sortedAllocations}
              items={items}
              dropItems={drops.items}
              unitLabel={unitLabel}
            />
            <LeftoverFooter
              leftover={result.leftoverIngredients}
              hasInputs={Object.values(config.ingredients).some((v) => v > 0)}
              totalSaved={result.totalSaved}
              totalSurplusValue={result.totalSurplusValue}
              unitLabel={unitLabel}
              onReset={reset}
            />
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

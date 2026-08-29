import solver from 'javascript-lp-solver'
import { Drops } from './get-drops'
import {
  continuousOptimalCost,
  DenominatorMode,
} from './material-selection-advisor'
import {
  EVENT_CRAFT_RECIPES_2026,
  EventCraftRecipe,
  IngredientCounts,
} from '../data/event-craft-recipes'

export type CraftAllocationItem = {
  recipe: EventCraftRecipe
  deficitCount: number
  surplusCount: number
  totalCount: number
  unitSaved: number
  deficitSaved: number
  surplusValue: number
  spentIngredients: IngredientCounts
}

export type EventCraftSolverResult = {
  allocations: CraftAllocationItem[]
  totalCrafted: number
  totalDeficitCrafted: number
  totalSurplusCrafted: number
  totalSaved: number
  totalSurplusValue: number
  spentIngredients: IngredientCounts
  leftoverIngredients: IngredientCounts
  baselineCost: number
  optimalCost: number
}

export type EventCraftSolverOptions = {
  exhaustIngredients?: boolean
  recipes?: readonly EventCraftRecipe[]
}

const EPSILON = 1e-6

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

type SolverContext = {
  drops: Drops
  fullNeed: Record<string, number>
  farmableNeed: Map<string, number>
  ownedIngredients: IngredientCounts
  mode: DenominatorMode
  allowedQuests: Set<string>
  recipes: readonly EventCraftRecipe[]
  baselineCost: number
  itemsWithDropData: Set<string>
}

const computeSingleItemBaseValues = (
  drops: Drops,
  questIds: string[],
  mode: DenominatorMode,
  recipes: readonly EventCraftRecipe[],
  itemsWithDropData: Set<string>,
): Map<string, number> => {
  const values = new Map<string, number>()
  for (const recipe of recipes) {
    const shortId = recipe.targetItem.shortId
    if (itemsWithDropData.has(shortId)) {
      const singleCost = continuousOptimalCost(
        drops,
        { [shortId]: 1 },
        questIds,
        mode,
      )
      values.set(
        recipe.id,
        Number.isFinite(singleCost) ? singleCost * recipe.yieldCount : 0,
      )
    } else {
      values.set(recipe.id, 0)
    }
  }
  return values
}

const extractFarmableNeed = (
  fullNeed: Record<string, number>,
  itemsWithDropData: Set<string>,
): Map<string, number> => {
  const farmable = new Map<string, number>()
  for (const [itemId, count] of Object.entries(fullNeed)) {
    if (count > 0 && itemsWithDropData.has(itemId)) {
      farmable.set(itemId, count)
    }
  }
  return farmable
}

const populateQuestVars = (
  model: solver.Model,
  ctx: SolverContext,
  isTieBreak: boolean,
) => {
  for (const q of ctx.drops.quests) {
    if (!ctx.allowedQuests.has(q.id)) continue
    const qVars: Record<string, number> = {
      totalCost: ctx.mode === 'turn' ? 1 : q.ap,
    }
    if (isTieBreak) qVars.totalIngredients = 0
    Reflect.set(model.variables, `quest_${q.id}`, qVars)
  }

  for (const dr of ctx.drops.drop_rates) {
    const qVar = Reflect.get(model.variables, `quest_${dr.quest_id}`) as
      | Record<string, number>
      | undefined
    if (dr.drop_rate > 0 && ctx.farmableNeed.has(dr.item_id) && qVar) {
      Reflect.set(qVar, `item_${dr.item_id}`, dr.drop_rate)
    }
  }
}

const populateCraftVars = (
  model: solver.Model,
  ints: Record<string, number>,
  ctx: SolverContext,
  isTieBreak: boolean,
) => {
  for (const recipe of ctx.recipes) {
    const shortId = recipe.targetItem.shortId
    if ((ctx.farmableNeed.get(shortId) ?? 0) <= 0) continue
    const varName = `craft_${recipe.id}`
    const totalIng =
      recipe.costs.seafood + recipe.costs.meat + recipe.costs.vegetable
    const craftVars: Record<string, number> = {
      totalCost: 0,
      [`item_${shortId}`]: recipe.yieldCount,
      [`cap_${shortId}`]: recipe.yieldCount,
      seafood: recipe.costs.seafood,
      meat: recipe.costs.meat,
      vegetable: recipe.costs.vegetable,
      ...(isTieBreak ? { totalIngredients: totalIng } : {}),
    }
    Reflect.set(model.variables, varName, craftVars)
    Reflect.set(ints, varName, 1)
  }
}

const populateStage1Vars = (
  model: solver.Model,
  ints: Record<string, number>,
  ctx: SolverContext,
  isTieBreak: boolean,
) => {
  populateQuestVars(model, ctx, isTieBreak)
  populateCraftVars(model, ints, ctx, isTieBreak)
}

const initStage1Model = (
  ctx: SolverContext,
  optimize: string,
  costCap?: number,
): { model: solver.Model; ints: Record<string, number> } => {
  const ints: Record<string, number> = {}
  const constraints: solver.Model['constraints'] = {
    seafood: { max: Math.max(0, ctx.ownedIngredients.seafood ?? 0) },
    meat: { max: Math.max(0, ctx.ownedIngredients.meat ?? 0) },
    vegetable: { max: Math.max(0, ctx.ownedIngredients.vegetable ?? 0) },
  }
  if (costCap != null) {
    Reflect.set(constraints, 'totalCost', { max: costCap + EPSILON })
  }
  for (const [itemId, count] of ctx.farmableNeed.entries()) {
    Reflect.set(constraints, `item_${itemId}`, { min: count })
    Reflect.set(constraints, `cap_${itemId}`, { max: count })
  }
  const model: solver.Model = {
    optimize,
    opType: 'min',
    constraints,
    variables: {},
    ints,
  }
  return { model, ints }
}

const buildStage1aModel = (ctx: SolverContext): solver.Model => {
  const { model, ints } = initStage1Model(ctx, 'totalCost')
  populateStage1Vars(model, ints, ctx, false)
  return model
}

const buildStage1bModel = (
  ctx: SolverContext,
  optCost1a: number,
): solver.Model => {
  const { model, ints } = initStage1Model(ctx, 'totalIngredients', optCost1a)
  populateStage1Vars(model, ints, ctx, true)
  return model
}

const solveStage1 = (ctx: SolverContext) => {
  const deficitCounts = new Map<string, number>()
  for (const r of ctx.recipes) deficitCounts.set(r.id, 0)

  const hasDeficits = ctx.farmableNeed.size > 0
  const hasIngredients = Object.values(ctx.ownedIngredients).some(
    (c) => (c ?? 0) > 0,
  )
  if (
    !hasDeficits ||
    !hasIngredients ||
    !Number.isFinite(ctx.baselineCost) ||
    ctx.baselineCost <= 0
  ) {
    return { deficitCounts, optimalCost: ctx.baselineCost }
  }

  const model1a = buildStage1aModel(ctx)
  const res1a = solver.Solve(model1a)
  const optCost1a =
    res1a.feasible && typeof res1a.result === 'number'
      ? res1a.result
      : ctx.baselineCost

  if (optCost1a >= ctx.baselineCost - EPSILON) {
    return { deficitCounts, optimalCost: ctx.baselineCost }
  }

  const model1b = buildStage1bModel(ctx, optCost1a)
  const res1b = solver.Solve(model1b)
  const targetRes = res1b.feasible ? res1b : res1a
  for (const recipe of ctx.recipes) {
    const varName = `craft_${recipe.id}`
    const rawVal = Reflect.get(targetRes, varName)
    const count =
      typeof rawVal === 'number' ? Math.max(0, Math.round(rawVal)) : 0
    deficitCounts.set(recipe.id, count)
  }
  return { deficitCounts, optimalCost: optCost1a }
}

const calculateRemainingIngredients = (
  ownedIngredients: IngredientCounts,
  deficitCounts: Map<string, number>,
  recipes: readonly EventCraftRecipe[],
): IngredientCounts => {
  const remaining: IngredientCounts = {
    seafood: Math.max(0, ownedIngredients.seafood ?? 0),
    meat: Math.max(0, ownedIngredients.meat ?? 0),
    vegetable: Math.max(0, ownedIngredients.vegetable ?? 0),
  }
  for (const recipe of recipes) {
    const count = deficitCounts.get(recipe.id) ?? 0
    remaining.seafood -= recipe.costs.seafood * count
    remaining.meat -= recipe.costs.meat * count
    remaining.vegetable -= recipe.costs.vegetable * count
  }
  return {
    seafood: Math.max(0, remaining.seafood),
    meat: Math.max(0, remaining.meat),
    vegetable: Math.max(0, remaining.vegetable),
  }
}

const buildStage2bModel = (
  remainingIngredients: IngredientCounts,
  singleItemBaseValues: Map<string, number>,
  recipes: readonly EventCraftRecipe[],
  maxSurplusVal: number,
): solver.Model => {
  const ints: Record<string, number> = {}
  const model: solver.Model = {
    optimize: 'totalIngredientsSpent',
    opType: 'max',
    constraints: {
      seafood: { max: remainingIngredients.seafood },
      meat: { max: remainingIngredients.meat },
      vegetable: { max: remainingIngredients.vegetable },
      totalSurplusValue: { min: Math.max(0, maxSurplusVal - EPSILON) },
    },
    variables: {},
    ints,
  }

  for (const recipe of recipes) {
    const varName = `surplus_${recipe.id}`
    const baseVal = singleItemBaseValues.get(recipe.id) ?? 0
    const totalIng =
      recipe.costs.seafood + recipe.costs.meat + recipe.costs.vegetable
    Reflect.set(model.variables, varName, {
      totalSurplusValue: baseVal,
      totalIngredientsSpent: totalIng,
      seafood: recipe.costs.seafood,
      meat: recipe.costs.meat,
      vegetable: recipe.costs.vegetable,
    })
    Reflect.set(ints, varName, 1)
  }

  return model
}

const solveStage2 = (
  remainingIngredients: IngredientCounts,
  singleItemBaseValues: Map<string, number>,
  recipes: readonly EventCraftRecipe[],
): Map<string, number> => {
  const surplusCounts = new Map<string, number>()
  for (const r of recipes) surplusCounts.set(r.id, 0)

  const ints2a: Record<string, number> = {}
  const model2a: solver.Model = {
    optimize: 'totalSurplusValue',
    opType: 'max',
    constraints: {
      seafood: { max: remainingIngredients.seafood },
      meat: { max: remainingIngredients.meat },
      vegetable: { max: remainingIngredients.vegetable },
    },
    variables: {},
    ints: ints2a,
  }

  for (const recipe of recipes) {
    const varName = `surplus_${recipe.id}`
    const baseVal = singleItemBaseValues.get(recipe.id) ?? 0
    Reflect.set(model2a.variables, varName, {
      totalSurplusValue: baseVal,
      seafood: recipe.costs.seafood,
      meat: recipe.costs.meat,
      vegetable: recipe.costs.vegetable,
    })
    Reflect.set(ints2a, varName, 1)
  }

  const res2a = solver.Solve(model2a)
  const maxSurplusVal =
    res2a.feasible && typeof res2a.result === 'number' ? res2a.result : 0
  if (maxSurplusVal <= 0) return surplusCounts

  const model2b = buildStage2bModel(
    remainingIngredients,
    singleItemBaseValues,
    recipes,
    maxSurplusVal,
  )
  const res2b = solver.Solve(model2b)
  const targetRes = res2b.feasible ? res2b : res2a
  for (const recipe of recipes) {
    const varName = `surplus_${recipe.id}`
    const rawVal = Reflect.get(targetRes, varName)
    const count =
      typeof rawVal === 'number' ? Math.max(0, Math.round(rawVal)) : 0
    surplusCounts.set(recipe.id, count)
  }
  return surplusCounts
}

const calculateUnitMarginalSavings = (
  ctx: SolverContext,
): Map<string, number> => {
  const unitMarginalSaved = new Map<string, number>()
  for (const recipe of ctx.recipes) {
    const shortId = recipe.targetItem.shortId
    const need = ctx.farmableNeed.get(shortId) ?? 0
    if (need > 0 && Number.isFinite(ctx.baselineCost)) {
      const reduced = { ...ctx.fullNeed, [shortId]: Math.max(0, need - 1) }
      const reducedCost = continuousOptimalCost(
        ctx.drops,
        reduced,
        Array.from(ctx.allowedQuests),
        ctx.mode,
      )
      unitMarginalSaved.set(
        recipe.id,
        Math.max(0, ctx.baselineCost - reducedCost) * recipe.yieldCount,
      )
    } else {
      unitMarginalSaved.set(recipe.id, 0)
    }
  }
  return unitMarginalSaved
}

const buildAllocations = (
  recipes: readonly EventCraftRecipe[],
  deficitCounts: Map<string, number>,
  surplusCounts: Map<string, number>,
  unitMarginalSaved: Map<string, number>,
  singleItemBaseValues: Map<string, number>,
) => {
  const spentIngredients: IngredientCounts = {
    seafood: 0,
    meat: 0,
    vegetable: 0,
  }
  let totalDeficitCrafted = 0
  let totalSurplusCrafted = 0
  let totalSurplusValue = 0

  const allocations: CraftAllocationItem[] = recipes.map((recipe) => {
    const deficitCount = deficitCounts.get(recipe.id) ?? 0
    const surplusCount = surplusCounts.get(recipe.id) ?? 0
    const totalCount = deficitCount + surplusCount
    const unitSaved = unitMarginalSaved.get(recipe.id) ?? 0
    const deficitSaved = unitSaved * deficitCount
    const surplusValue =
      (singleItemBaseValues.get(recipe.id) ?? 0) * surplusCount

    const spent: IngredientCounts = {
      seafood: recipe.costs.seafood * totalCount,
      meat: recipe.costs.meat * totalCount,
      vegetable: recipe.costs.vegetable * totalCount,
    }

    spentIngredients.seafood += spent.seafood
    spentIngredients.meat += spent.meat
    spentIngredients.vegetable += spent.vegetable
    totalDeficitCrafted += deficitCount
    totalSurplusCrafted += surplusCount
    totalSurplusValue += surplusValue

    return {
      recipe,
      deficitCount,
      surplusCount,
      totalCount,
      unitSaved,
      deficitSaved,
      surplusValue,
      spentIngredients: spent,
    }
  })

  return {
    allocations,
    spentIngredients,
    totalDeficitCrafted,
    totalSurplusCrafted,
    totalSurplusValue,
  }
}

const createSolverContext = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  mode: DenominatorMode,
  questIds: string[],
  recipes: readonly EventCraftRecipe[],
): { ctx: SolverContext; singleItemBaseValues: Map<string, number> } => {
  const itemsWithDropData = new Set(drops.drop_rates.map((dr) => dr.item_id))
  const allowedQuests = new Set(questIds)
  const baselineCost = continuousOptimalCost(drops, fullNeed, questIds, mode)
  const farmableNeed = extractFarmableNeed(fullNeed, itemsWithDropData)

  const ctx: SolverContext = {
    drops,
    fullNeed,
    farmableNeed,
    ownedIngredients,
    mode,
    allowedQuests,
    recipes,
    baselineCost,
    itemsWithDropData,
  }

  const singleItemBaseValues = computeSingleItemBaseValues(
    drops,
    questIds,
    mode,
    recipes,
    itemsWithDropData,
  )

  return { ctx, singleItemBaseValues }
}

const computeSurplusCounts = (
  exhaust: boolean,
  remainingIngredients: IngredientCounts,
  singleItemBaseValues: Map<string, number>,
  recipes: readonly EventCraftRecipe[],
): Map<string, number> => {
  const canCraftAny = recipes.some(
    (r) =>
      r.costs.seafood <= remainingIngredients.seafood &&
      r.costs.meat <= remainingIngredients.meat &&
      r.costs.vegetable <= remainingIngredients.vegetable,
  )

  if (exhaust && canCraftAny) {
    return solveStage2(remainingIngredients, singleItemBaseValues, recipes)
  }
  return new Map(recipes.map((r) => [r.id, 0]))
}

const calculateLeftovers = (
  owned: IngredientCounts,
  spent: IngredientCounts,
): IngredientCounts => ({
  seafood: Math.max(0, (owned.seafood ?? 0) - spent.seafood),
  meat: Math.max(0, (owned.meat ?? 0) - spent.meat),
  vegetable: Math.max(0, (owned.vegetable ?? 0) - spent.vegetable),
})

const executeSolveStages = (
  ctx: SolverContext,
  ownedIngredients: IngredientCounts,
  singleItemBaseValues: Map<string, number>,
  recipes: readonly EventCraftRecipe[],
  exhaust: boolean,
) => {
  const { deficitCounts, optimalCost } = solveStage1(ctx)
  const remaining = calculateRemainingIngredients(ownedIngredients, deficitCounts, recipes)
  const surplusCounts = computeSurplusCounts(exhaust, remaining, singleItemBaseValues, recipes)
  const unitMarginalSaved = calculateUnitMarginalSavings(ctx)
  const allocated = buildAllocations(
    recipes,
    deficitCounts,
    surplusCounts,
    unitMarginalSaved,
    singleItemBaseValues,
  )
  return { allocated, optimalCost }
}

export const solveEventCraftAllocation = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  mode: DenominatorMode,
  questIds: string[],
  optionsOrExhaust: boolean | EventCraftSolverOptions = false,
): EventCraftSolverResult => {
  const exhaust =
    typeof optionsOrExhaust === 'boolean'
      ? optionsOrExhaust
      : (optionsOrExhaust.exhaustIngredients ?? false)
  const recipes =
    typeof optionsOrExhaust === 'object' && optionsOrExhaust.recipes
      ? optionsOrExhaust.recipes
      : EVENT_CRAFT_RECIPES_2026

  const { ctx, singleItemBaseValues } = createSolverContext(
    drops,
    fullNeed,
    ownedIngredients,
    mode,
    questIds,
    recipes,
  )

  const { allocated, optimalCost } = executeSolveStages(
    ctx,
    ownedIngredients,
    singleItemBaseValues,
    recipes,
    exhaust,
  )

  return {
    allocations: allocated.allocations,
    totalCrafted: allocated.totalDeficitCrafted + allocated.totalSurplusCrafted,
    totalDeficitCrafted: allocated.totalDeficitCrafted,
    totalSurplusCrafted: allocated.totalSurplusCrafted,
    totalSaved: Math.max(0, ctx.baselineCost - optimalCost),
    totalSurplusValue: allocated.totalSurplusValue,
    spentIngredients: allocated.spentIngredients,
    leftoverIngredients: calculateLeftovers(ownedIngredients, allocated.spentIngredients),
    baselineCost: ctx.baselineCost,
    optimalCost,
  }
}

const findTopAllocation = (allocations: CraftAllocationItem[]) => {
  const deficitTop = allocations
    .filter((a) => a.deficitCount > 0)
    .reduce<CraftAllocationItem | null>(
      (best, a) =>
        best == null || a.deficitSaved > best.deficitSaved ? a : best,
      null,
    )
  const surplusTop = allocations
    .filter((a) => a.surplusCount > 0)
    .reduce<CraftAllocationItem | null>(
      (best, a) =>
        best == null || a.surplusValue > best.surplusValue ? a : best,
      null,
    )
  const top = deficitTop ?? surplusTop
  let topCount = 0
  if (top) {
    topCount = deficitTop ? top.deficitCount : top.surplusCount
  }
  return { top, topCount, deficitTop }
}

export type AdviceTranslator = (
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>,
) => string

const defaultAdviceTranslator: AdviceTranslator = (_key, defaultVal, options) => {
  if (!options) return defaultVal
  let res = defaultVal
  for (const [k, v] of Object.entries(options)) {
    res = res.replaceAll(`{{${k}}}`, String(v))
  }
  return res
}

const buildAdviceEffectText = (
  result: EventCraftSolverResult,
  mode: DenominatorMode,
  deficitTop: CraftAllocationItem | null,
  t: AdviceTranslator,
): string => {
  const u = mode === 'ap' ? t('unit-ap', 'AP') : t('unit-runs-full', '周回')
  const modeTail =
    mode === 'ap'
      ? t('event-craft-advice-ap-tail', 'りんごや石の温存に最適な配分です。')
      : t('event-craft-advice-turn-tail', 'リアルの周回時間を最小化する配分です。')

  let effectText = ''
  if (result.totalSaved > 0) {
    effectText = t(
      'event-craft-advice-saved',
      'この配分により、フリクエ周回から合計 約 {{amount}} {{unit}} を削減できます。{{tail}}',
      { amount: fmt(result.totalSaved), unit: u, tail: modeTail },
    )
  } else if (result.totalSurplusValue > 0) {
    effectText = t(
      'event-craft-advice-surplus-only',
      '余剰食材を使い切り、合計 約 +{{amount}} {{unit}} 相当の素材を獲得できます。',
      { amount: fmt(result.totalSurplusValue), unit: u },
    )
  }

  const surplusList = result.allocations.filter((a) => a.surplusCount > 0 && a !== deficitTop)
  const surplusNote =
    result.totalSaved > 0 && surplusList.length > 0
      ? t(
          'event-craft-advice-surplus-note',
          ' また余った食材で「{{dishes}}」を作成し、+約 {{amount}} {{unit}} 相当の素材を追加獲得できます。',
          {
            dishes: surplusList
              .map((a) => t(`recipe-${a.recipe.id}`, a.recipe.name))
              .join('・'),
            amount: fmt(result.totalSurplusValue),
            unit: u,
          },
        )
      : ''

  return `${effectText}${surplusNote}`.trim()
}

export const generateCraftAdvice = (
  result: EventCraftSolverResult,
  ownedIngredients: IngredientCounts,
  mode: DenominatorMode,
  exhaustIngredients: boolean,
  t: AdviceTranslator = defaultAdviceTranslator,
): string => {
  const totalOwned =
    (ownedIngredients.seafood ?? 0) +
    (ownedIngredients.meat ?? 0) +
    (ownedIngredients.vegetable ?? 0)

  if (totalOwned <= 0) {
    return t(
      'event-craft-advice-prompt',
      '指令を確認します、先輩。お持ちのイベント食材数（海鮮・お肉・野菜）を入力してください。育成不足素材とフリクエ効率から、最も効率的な料理作成配分を算出します。',
    )
  }

  if (result.totalCrafted === 0) {
    if (result.baselineCost <= 0 && !exhaustIngredients) {
      return t(
        'event-craft-advice-no-shortage',
        '現在、不足している対象素材がありません、先輩。食材を使い切りたい場合は「食材を使い切る」をONにしてください。',
      )
    }
    return t(
      'event-craft-advice-cannot-craft',
      '手持ちの食材数では料理を作成できないようです、先輩。もう少しフリクエで食材を集めてみましょう。',
    )
  }

  const { top, topCount, deficitTop } = findTopAllocation(result.allocations)
  const topName = top ? t(`recipe-${top.recipe.id}`, top.recipe.name) : ''
  const head = top
    ? t(
        'event-craft-advice-head',
        '最優先は「{{name}}」です、先輩。これを {{count}} 個作成するのが最も効率的です。',
        { name: topName, count: topCount },
      )
    : ''

  const effect = buildAdviceEffectText(result, mode, deficitTop, t)
  return `${head} ${effect}`.trim()
}

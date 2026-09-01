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
  getRecipeYields,
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
  singleItemBaseValues?: Map<string, number>
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
  eligibleRecipeIds?: Set<string>
}

const baseValuesCache = new WeakMap<object, Map<string, Map<string, number>>>()

export type SingleItemBaseValuesOptions = {
  recipes?: readonly EventCraftRecipe[]
  itemsWithDropData?: Set<string>
}

export const computeSingleItemBaseValues = (
  drops: Drops,
  questIds: string[],
  mode: DenominatorMode,
  options?: SingleItemBaseValuesOptions,
): Map<string, number> => {
  const recipes = options?.recipes ?? EVENT_CRAFT_RECIPES_2026
  const questKey = questIds
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .join(',')
  const recipeKey = recipes
    .map((r) => {
      const yields = getRecipeYields(r, recipes)
      const yieldKey = Object.keys(yields)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => `${id}:${Number(Reflect.get(yields, id) ?? 0)}`)
        .join('|')
      return `${r.id}:{${yieldKey}}`
    })
    .join(',')
  const cacheKey = `${mode}:${questKey}:${recipeKey}`

  const cacheTarget = drops.drop_rates ?? drops
  let dropsCache = baseValuesCache.get(cacheTarget)
  if (!dropsCache) {
    dropsCache = new Map()
    baseValuesCache.set(cacheTarget, dropsCache)
  }

  const cached = dropsCache.get(cacheKey)
  if (cached) return cached

  const dropDataSet =
    options?.itemsWithDropData ??
    new Set(drops.drop_rates.map((dr) => dr.item_id))
  const isolatedCost = new Map<string, number>()
  const costOf = (shortId: string): number => {
    if (!dropDataSet.has(shortId)) return 0
    const cachedIsolated = isolatedCost.get(shortId)
    if (cachedIsolated != null) return cachedIsolated
    const needMap: Record<string, number> = {}
    Reflect.set(needMap, shortId, 1)
    const singleCost = continuousOptimalCost(drops, needMap, questIds, mode)
    const value = Number.isFinite(singleCost) ? singleCost : 0
    isolatedCost.set(shortId, value)
    return value
  }

  const values = new Map<string, number>()
  for (const recipe of recipes) {
    const yields = getRecipeYields(recipe, recipes)
    let basket = 0
    for (const [shortId, y] of Object.entries(yields)) {
      if (y > 0) basket += costOf(shortId) * y
    }
    values.set(recipe.id, basket)
  }
  dropsCache.set(cacheKey, values)
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

const getRecipeYieldTargets = (
  recipes: readonly EventCraftRecipe[],
): Set<string> => {
  const targets = new Set<string>()
  for (const recipe of recipes) {
    for (const [shortId, y] of Object.entries(getRecipeYields(recipe, recipes))) {
      if (y > 0) targets.add(shortId)
    }
  }
  return targets
}

const findRelevantQuestIds = (
  drops: Drops,
  allowedQuests: Set<string>,
  farmableNeed: Map<string, number>,
): Set<string> => {
  const relevant = new Set<string>()
  for (const dr of drops.drop_rates) {
    if (dr.drop_rate > 0 && farmableNeed.has(dr.item_id) && allowedQuests.has(dr.quest_id)) {
      relevant.add(dr.quest_id)
    }
  }
  return relevant
}

const populateQuestVars = (
  model: solver.Model,
  ctx: SolverContext,
  isTieBreak: boolean,
) => {
  const relevantQuestIds = findRelevantQuestIds(ctx.drops, ctx.allowedQuests, ctx.farmableNeed)
  for (const q of ctx.drops.quests) {
    if (!relevantQuestIds.has(q.id)) continue
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
    if (ctx.eligibleRecipeIds && !ctx.eligibleRecipeIds.has(recipe.id)) continue
    const yields = getRecipeYields(recipe, ctx.recipes)
    const helpsDeficit = Object.entries(yields).some(
      ([shortId, y]) => y > 0 && (ctx.farmableNeed.get(shortId) ?? 0) > 0,
    )
    if (!helpsDeficit) continue
    const varName = `craft_${recipe.id}`
    const totalIng =
      recipe.costs.seafood + recipe.costs.meat + recipe.costs.vegetable
    const craftVars: Record<string, number> = {
      totalCost: 0,
      seafood: recipe.costs.seafood,
      meat: recipe.costs.meat,
      vegetable: recipe.costs.vegetable,
      ...(isTieBreak ? { totalIngredients: totalIng } : {}),
    }
    for (const [shortId, y] of Object.entries(yields)) {
      if (y > 0) Reflect.set(craftVars, `item_${shortId}`, y)
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

const subtractCraftYieldsFromNeed = (
  fullNeed: Record<string, number>,
  recipes: readonly EventCraftRecipe[],
  counts: Map<string, number>,
  excludeRecipeId?: string,
): Record<string, number> => {
  const next: Record<string, number> = { ...fullNeed }
  for (const recipe of recipes) {
    if (recipe.id === excludeRecipeId) continue
    const count = counts.get(recipe.id) ?? 0
    if (count <= 0) continue
    for (const [shortId, y] of Object.entries(getRecipeYields(recipe, recipes))) {
      if (y <= 0) continue
      const cur = (Reflect.get(next, shortId) as number | undefined) ?? 0
      Reflect.set(next, shortId, Math.max(0, cur - count * y))
    }
  }
  return next
}

const calculateAllocatedDeficitSavings = (
  ctx: SolverContext,
  deficitCounts: Map<string, number>,
  optimalCost: number,
): Map<string, { totalSaved: number; unitSaved: number }> => {
  const savings = new Map<string, { totalSaved: number; unitSaved: number }>()
  const allowedQuestsList = Array.from(ctx.allowedQuests)

  for (const recipe of ctx.recipes) {
    const count = deficitCounts.get(recipe.id) ?? 0
    if (count > 0 && Number.isFinite(optimalCost)) {
      const withoutRecipeNeed = subtractCraftYieldsFromNeed(
        ctx.fullNeed,
        ctx.recipes,
        deficitCounts,
        recipe.id,
      )
      const costWithout = continuousOptimalCost(
        ctx.drops,
        withoutRecipeNeed,
        allowedQuestsList,
        ctx.mode,
      )
      const totalSaved = Math.max(0, costWithout - optimalCost)
      savings.set(recipe.id, {
        totalSaved,
        unitSaved: totalSaved / count,
      })
    } else {
      savings.set(recipe.id, { totalSaved: 0, unitSaved: 0 })
    }
  }

  return savings
}

const buildAllocations = (
  recipes: readonly EventCraftRecipe[],
  deficitCounts: Map<string, number>,
  surplusCounts: Map<string, number>,
  allocatedSavings: Map<string, { totalSaved: number; unitSaved: number }>,
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
    const recipeSaving = allocatedSavings.get(recipe.id) ?? { totalSaved: 0, unitSaved: 0 }
    const deficitSaved = recipeSaving.totalSaved
    const unitSaved = recipeSaving.unitSaved
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

type ContextBuilderOptions = {
  mode: DenominatorMode
  questIds: string[]
  recipes: readonly EventCraftRecipe[]
  providedBaseValues?: Map<string, number>
}

const createSolverContext = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  options: ContextBuilderOptions,
): { ctx: SolverContext; singleItemBaseValues: Map<string, number> } => {
  const { mode, questIds, recipes, providedBaseValues } = options
  const itemsWithDropData = new Set(drops.drop_rates.map((dr) => dr.item_id))
  const allowedQuests = new Set(questIds)
  const baselineCost = continuousOptimalCost(drops, fullNeed, questIds, mode)
  const recipeYieldTargets = getRecipeYieldTargets(recipes)
  const farmableNeed = new Map(
    [...extractFarmableNeed(fullNeed, itemsWithDropData)].filter(([itemId]) =>
      recipeYieldTargets.has(itemId),
    ),
  )

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

  const singleItemBaseValues =
    providedBaseValues ??
    computeSingleItemBaseValues(drops, questIds, mode, {
      recipes,
      itemsWithDropData,
    })

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

const dropDeficitsThatDoNotReduceResidual = (
  recipes: readonly EventCraftRecipe[],
  deficitCounts: Map<string, number>,
  allocatedSavings: Map<string, { totalSaved: number; unitSaved: number }>,
): { counts: Map<string, number>; dropped: boolean } => {
  const counts = new Map(deficitCounts)
  let dropped = false
  for (const recipe of recipes) {
    const count = counts.get(recipe.id) ?? 0
    const saved = allocatedSavings.get(recipe.id)?.totalSaved ?? 0
    if (count > 0 && saved <= EPSILON) {
      counts.set(recipe.id, 0)
      dropped = true
    }
  }
  return { counts, dropped }
}

const findFirstZeroSavingRecipe = (
  ctx: SolverContext,
  recipes: readonly EventCraftRecipe[],
  deficitCounts: Map<string, number>,
  residualCost: number,
): EventCraftRecipe | undefined => {
  const allowedQuestsList = Array.from(ctx.allowedQuests)
  for (const recipe of recipes) {
    const count = deficitCounts.get(recipe.id) ?? 0
    if (count <= 0) continue
    const withoutRecipeNeed = subtractCraftYieldsFromNeed(
      ctx.fullNeed,
      recipes,
      deficitCounts,
      recipe.id,
    )
    const costWithout = continuousOptimalCost(
      ctx.drops,
      withoutRecipeNeed,
      allowedQuestsList,
      ctx.mode,
    )
    if (costWithout - residualCost <= EPSILON) return recipe
  }
}

const evaluateDeficitPlan = (
  ctx: SolverContext,
  deficitCounts: Map<string, number>,
  recipes: readonly EventCraftRecipe[],
) => {
  const remainingNeed = subtractCraftYieldsFromNeed(ctx.fullNeed, recipes, deficitCounts)
  const residualCost = continuousOptimalCost(
    ctx.drops,
    remainingNeed,
    Array.from(ctx.allowedQuests),
    ctx.mode,
  )
  const allocatedSavings = calculateAllocatedDeficitSavings(ctx, deficitCounts, residualCost)
  return { residualCost, allocatedSavings }
}

// ponytail: at most 4 Stage1 solves; do not ban unless another solve can reallocate
const MAX_STAGE1_SOLVES = 4

const executeSolveStages = (
  ctx: SolverContext,
  ownedIngredients: IngredientCounts,
  singleItemBaseValues: Map<string, number>,
  recipes: readonly EventCraftRecipe[],
  exhaust: boolean,
) => {
  const banned = new Set<string>()
  let deficitCounts = new Map(recipes.map((r) => [r.id, 0]))
  for (let i = 0; i < MAX_STAGE1_SOLVES; i++) {
    const stageCtx: SolverContext = {
      ...ctx,
      eligibleRecipeIds: new Set(recipes.filter((r) => !banned.has(r.id)).map((r) => r.id)),
    }
    const solved = solveStage1(stageCtx)
    deficitCounts = new Map(recipes.map((r) => [r.id, solved.deficitCounts.get(r.id) ?? 0]))
    const remainingNeed = subtractCraftYieldsFromNeed(ctx.fullNeed, recipes, deficitCounts)
    const residualCost = continuousOptimalCost(
      ctx.drops,
      remainingNeed,
      Array.from(ctx.allowedQuests),
      ctx.mode,
    )
    const zeroSaving = findFirstZeroSavingRecipe(ctx, recipes, deficitCounts, residualCost)
    if (!zeroSaving) break
    if (i + 1 >= MAX_STAGE1_SOLVES) break
    banned.add(zeroSaving.id)
  }
  let plan = evaluateDeficitPlan(ctx, deficitCounts, recipes)
  const pruned = dropDeficitsThatDoNotReduceResidual(recipes, deficitCounts, plan.allocatedSavings)
  if (pruned.dropped) {
    deficitCounts = pruned.counts
    plan = evaluateDeficitPlan(ctx, deficitCounts, recipes)
  }
  const remaining = calculateRemainingIngredients(ownedIngredients, deficitCounts, recipes)
  const surplusCounts = computeSurplusCounts(
    exhaust,
    remaining,
    singleItemBaseValues,
    recipes,
  )
  const allocated = buildAllocations(
    recipes,
    deficitCounts,
    surplusCounts,
    plan.allocatedSavings,
    singleItemBaseValues,
  )
  return { allocated, optimalCost: plan.residualCost }
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
  const providedBaseValues =
    typeof optionsOrExhaust === 'object'
      ? optionsOrExhaust.singleItemBaseValues
      : undefined

  const { ctx, singleItemBaseValues } = createSolverContext(
    drops,
    fullNeed,
    ownedIngredients,
    {
      mode,
      questIds,
      recipes,
      providedBaseValues,
    },
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

const compareDeficitAllocation = (
  a: CraftAllocationItem,
  b: CraftAllocationItem,
) => {
  if (a.unitSaved !== b.unitSaved) return a.unitSaved - b.unitSaved
  if (a.deficitSaved !== b.deficitSaved) return a.deficitSaved - b.deficitSaved
  return a.deficitCount - b.deficitCount
}

const compareSurplusAllocation = (
  a: CraftAllocationItem,
  b: CraftAllocationItem,
) => {
  const unitSurplusA = a.surplusCount > 0 ? a.surplusValue / a.surplusCount : 0
  const unitSurplusB = b.surplusCount > 0 ? b.surplusValue / b.surplusCount : 0
  if (unitSurplusA !== unitSurplusB) return unitSurplusA - unitSurplusB
  if (a.surplusValue !== b.surplusValue) return a.surplusValue - b.surplusValue
  return a.surplusCount - b.surplusCount
}

const findTopAllocation = (allocations: CraftAllocationItem[]) => {
  const deficitTop = allocations
    .filter((a) => a.deficitCount > 0)
    .reduce<CraftAllocationItem | null>(
      (best, a) =>
        best == null || compareDeficitAllocation(a, best) > 0 ? a : best,
      null,
    )
  const surplusTop = allocations
    .filter((a) => a.surplusCount > 0)
    .reduce<CraftAllocationItem | null>(
      (best, a) =>
        best == null || compareSurplusAllocation(a, best) > 0 ? a : best,
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

  const surplusList = result.allocations.filter((a) => a.surplusCount > 0)
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
    const canCraftAny = result.allocations.some(
      (a) =>
        a.recipe.costs.seafood <= (ownedIngredients.seafood ?? 0) &&
        a.recipe.costs.meat <= (ownedIngredients.meat ?? 0) &&
        a.recipe.costs.vegetable <= (ownedIngredients.vegetable ?? 0),
    )
    if (canCraftAny && !exhaustIngredients) {
      return t(
        'event-craft-advice-no-saving',
        '現在の周回計画では料理作成による周回削減効果がありません、先輩。食材を素材に変換したい場合は「食材を使い切る」をONにしてください。',
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

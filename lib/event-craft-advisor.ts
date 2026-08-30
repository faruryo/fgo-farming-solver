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

export type EventCraftPatternId = 'runs' | 'ap' | 'even-turn' | 'even-ap' | 'exhaust'

export type EventCraftPatternMetric = 'turn' | 'ap' | 'both'

export type EventCraftPatternResult = {
  id: EventCraftPatternId
  metric: EventCraftPatternMetric
  allocations: CraftAllocationItem[]
  totalCrafted: number
  totalDeficitCrafted: number
  totalSurplusCrafted: number
  totalSaved: number
  totalSurplusValue: number
  spentIngredients: IngredientCounts
  leftoverIngredients: IngredientCounts
  residualTurnCost: number
  residualApCost: number
  baselineTurnCost: number
  baselineApCost: number
}

export type EventCraftPlanPattern = EventCraftPatternResult & {
  aliasOf: EventCraftPatternId[]
}

export type EventCraftPlanResult = {
  patterns: EventCraftPlanPattern[]
  absorbedInto: Partial<Record<EventCraftPatternId, EventCraftPatternId>>
}

export type EventCraftPlanOptions = {
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

/** 素材ごとの単独周回/AP負担（1個だけを許可クエストから集めるコスト）。 */
const computeSingleItemUnitCosts = (
  drops: Drops,
  questIds: string[],
  mode: DenominatorMode,
  itemIds: Iterable<string>,
  itemsWithDropData: Set<string>,
): Map<string, number> => {
  const costs = new Map<string, number>()
  for (const itemId of itemIds) {
    if (!itemsWithDropData.has(itemId)) {
      costs.set(itemId, 0)
      continue
    }
    const needMap: Record<string, number> = {}
    Reflect.set(needMap, itemId, 1)
    const c = continuousOptimalCost(drops, needMap, questIds, mode)
    costs.set(itemId, Number.isFinite(c) ? c : 0)
  }
  return costs
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
  includeAll: boolean = false,
) => {
  for (const recipe of ctx.recipes) {
    const yields = getRecipeYields(recipe, ctx.recipes)
    const helpsDeficit = Object.entries(yields).some(
      ([shortId, y]) => y > 0 && (ctx.farmableNeed.get(shortId) ?? 0) > 0,
    )
    if (!helpsDeficit && !includeAll) continue
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
  includeAll: boolean = false,
) => {
  populateQuestVars(model, ctx, isTieBreak)
  populateCraftVars(model, ints, ctx, isTieBreak, includeAll)
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

const readCraftCounts = (
  recipes: readonly EventCraftRecipe[],
  target: Record<string, unknown>,
): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const recipe of recipes) {
    const raw = Reflect.get(target, `craft_${recipe.id}`)
    counts.set(recipe.id, typeof raw === 'number' ? Math.max(0, Math.round(raw)) : 0)
  }
  return counts
}

const solveStage1 = (ctx: SolverContext): Map<string, number> => {
  const zero = new Map(ctx.recipes.map((r) => [r.id, 0]))

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
    return zero
  }

  const model1a = buildStage1aModel(ctx)
  const res1a = solver.Solve(model1a)
  const optCost1a =
    res1a.feasible && typeof res1a.result === 'number'
      ? res1a.result
      : ctx.baselineCost

  if (optCost1a >= ctx.baselineCost - EPSILON) {
    return zero
  }

  const model1b = buildStage1bModel(ctx, optCost1a)
  const res1b = solver.Solve(model1b)
  const targetRes = res1b.feasible ? res1b : res1a
  return readCraftCounts(ctx.recipes, targetRes)
}

/** 満遍なく（周回/AP）: 単位負担 remaining_i * unitCost_i の最大値を最小化する。 */
const populateEvenBurdenVars = (
  model: solver.Model,
  ints: Record<string, number>,
  ctx: SolverContext,
  unitCosts: Map<string, number>,
  isTieBreak: boolean,
) => {
  for (const itemId of ctx.farmableNeed.keys()) {
    Reflect.set(model.variables, `remaining_${itemId}`, {
      [`remain_${itemId}`]: 1,
      [`cap_${itemId}`]: -(unitCosts.get(itemId) ?? 0),
    })
  }

  const burdenVar: Record<string, number> = { burdenObj: 1 }
  for (const itemId of ctx.farmableNeed.keys()) {
    burdenVar[`cap_${itemId}`] = 1
  }
  Reflect.set(model.variables, 'burden', burdenVar)

  for (const recipe of ctx.recipes) {
    const yields = getRecipeYields(recipe, ctx.recipes)
    const relevant = Object.entries(yields).some(
      ([shortId, y]) => y > 0 && ctx.farmableNeed.has(shortId),
    )
    if (!relevant) continue
    const varName = `craft_${recipe.id}`
    const totalIng =
      recipe.costs.seafood + recipe.costs.meat + recipe.costs.vegetable
    const craftVars: Record<string, number> = {
      seafood: recipe.costs.seafood,
      meat: recipe.costs.meat,
      vegetable: recipe.costs.vegetable,
      ...(isTieBreak ? { totalIngredients: totalIng } : {}),
    }
    for (const [shortId, y] of Object.entries(yields)) {
      if (y > 0 && ctx.farmableNeed.has(shortId)) {
        Reflect.set(craftVars, `remain_${shortId}`, y)
      }
    }
    Reflect.set(model.variables, varName, craftVars)
    Reflect.set(ints, varName, 1)
  }
}

const buildEvenBurdenModel = (
  ctx: SolverContext,
  unitCosts: Map<string, number>,
  isTieBreak: boolean,
  burdenCap?: number,
): solver.Model => {
  const ints: Record<string, number> = {}
  const constraints: solver.Model['constraints'] = {
    seafood: { max: Math.max(0, ctx.ownedIngredients.seafood ?? 0) },
    meat: { max: Math.max(0, ctx.ownedIngredients.meat ?? 0) },
    vegetable: { max: Math.max(0, ctx.ownedIngredients.vegetable ?? 0) },
  }
  for (const [itemId, count] of ctx.farmableNeed.entries()) {
    Reflect.set(constraints, `remain_${itemId}`, { min: count })
    Reflect.set(constraints, `cap_${itemId}`, { min: 0 })
  }
  if (burdenCap != null) {
    Reflect.set(constraints, 'burdenObj', { max: burdenCap + EPSILON })
  }
  const model: solver.Model = {
    optimize: isTieBreak ? 'totalIngredients' : 'burdenObj',
    opType: 'min',
    constraints,
    variables: {},
    ints,
  }
  populateEvenBurdenVars(model, ints, ctx, unitCosts, isTieBreak)
  return model
}

const solveEvenBurden = (
  ctx: SolverContext,
  unitCosts: Map<string, number>,
): Map<string, number> => {
  const zero = new Map(ctx.recipes.map((r) => [r.id, 0]))
  if (ctx.farmableNeed.size === 0) return zero
  const hasIngredients = Object.values(ctx.ownedIngredients).some(
    (c) => (c ?? 0) > 0,
  )
  if (!hasIngredients) return zero

  const modelA = buildEvenBurdenModel(ctx, unitCosts, false)
  const resA = solver.Solve(modelA)
  if (!resA.feasible) return zero
  const burdenOpt = typeof resA.result === 'number' ? resA.result : 0

  const modelB = buildEvenBurdenModel(ctx, unitCosts, true, burdenOpt)
  const resB = solver.Solve(modelB)
  const targetRes = resB.feasible ? resB : resA
  return readCraftCounts(ctx.recipes, targetRes)
}

/** 食材を使い切る: (1) 消費食材合計の最大化 → (2) その制約下で周回コスト最小化。 */
const buildExhaustPhaseAModel = (
  recipes: readonly EventCraftRecipe[],
  ownedIngredients: IngredientCounts,
): solver.Model => {
  const ints: Record<string, number> = {}
  const model: solver.Model = {
    optimize: 'totalIngredientsSpent',
    opType: 'max',
    constraints: {
      seafood: { max: Math.max(0, ownedIngredients.seafood ?? 0) },
      meat: { max: Math.max(0, ownedIngredients.meat ?? 0) },
      vegetable: { max: Math.max(0, ownedIngredients.vegetable ?? 0) },
    },
    variables: {},
    ints,
  }
  for (const recipe of recipes) {
    const varName = `craft_${recipe.id}`
    const totalIng =
      recipe.costs.seafood + recipe.costs.meat + recipe.costs.vegetable
    Reflect.set(model.variables, varName, {
      totalIngredientsSpent: totalIng,
      seafood: recipe.costs.seafood,
      meat: recipe.costs.meat,
      vegetable: recipe.costs.vegetable,
    })
    Reflect.set(ints, varName, 1)
  }
  return model
}

const buildExhaustPhaseBModel = (
  ctx: SolverContext,
  maxSpend: number,
): solver.Model => {
  const { model, ints } = initStage1Model(ctx, 'totalCost')
  populateStage1Vars(model, ints, ctx, false, true)
  for (const recipe of ctx.recipes) {
    const varName = `craft_${recipe.id}`
    const craftVar = Reflect.get(model.variables, varName) as
      | Record<string, number>
      | undefined
    if (!craftVar) continue
    const totalIng =
      recipe.costs.seafood + recipe.costs.meat + recipe.costs.vegetable
    craftVar.totalIngredientsSpent = totalIng
  }
  Reflect.set(model.constraints, 'totalIngredientsSpent', {
    min: Math.max(0, maxSpend - EPSILON),
  })
  return model
}

const solveExhaust = (
  ctxTurn: SolverContext,
  recipes: readonly EventCraftRecipe[],
  ownedIngredients: IngredientCounts,
): Map<string, number> => {
  const zero = new Map(recipes.map((r) => [r.id, 0]))
  const canCraftAny = recipes.some(
    (r) =>
      r.costs.seafood <= (ownedIngredients.seafood ?? 0) &&
      r.costs.meat <= (ownedIngredients.meat ?? 0) &&
      r.costs.vegetable <= (ownedIngredients.vegetable ?? 0),
  )
  if (!canCraftAny) return zero

  const modelA = buildExhaustPhaseAModel(recipes, ownedIngredients)
  const resA = solver.Solve(modelA)
  const maxSpend =
    resA.feasible && typeof resA.result === 'number' ? resA.result : 0
  if (maxSpend <= EPSILON) return zero

  const modelB = buildExhaustPhaseBModel(ctxTurn, maxSpend)
  const resB = solver.Solve(modelB)
  const targetRes = resB.feasible
    ? (resB as unknown as Record<string, unknown>)
    : (resA as unknown as Record<string, unknown>)
  return readCraftCounts(recipes, targetRes)
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

const evaluateResidualCost = (
  drops: Drops,
  fullNeed: Record<string, number>,
  recipes: readonly EventCraftRecipe[],
  counts: Map<string, number>,
  allowedQuestsList: string[],
  mode: DenominatorMode,
): number => {
  const remaining = subtractCraftYieldsFromNeed(fullNeed, recipes, counts)
  return continuousOptimalCost(drops, remaining, allowedQuestsList, mode)
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

const calculateLeftovers = (
  owned: IngredientCounts,
  spent: IngredientCounts,
): IngredientCounts => ({
  seafood: Math.max(0, (owned.seafood ?? 0) - spent.seafood),
  meat: Math.max(0, (owned.meat ?? 0) - spent.meat),
  vegetable: Math.max(0, (owned.vegetable ?? 0) - spent.vegetable),
})

const createSolverContext = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  options: {
    mode: DenominatorMode
    questIds: string[]
    recipes: readonly EventCraftRecipe[]
  },
): SolverContext => {
  const { mode, questIds, recipes } = options
  const itemsWithDropData = new Set(drops.drop_rates.map((dr) => dr.item_id))
  const allowedQuests = new Set(questIds)
  const baselineCost = continuousOptimalCost(drops, fullNeed, questIds, mode)
  const farmableNeed = extractFarmableNeed(fullNeed, itemsWithDropData)

  return {
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
}

type PatternBuildContext = {
  drops: Drops
  fullNeed: Record<string, number>
  recipes: readonly EventCraftRecipe[]
  allowedQuestsList: string[]
  ownedIngredients: IngredientCounts
  singleValues: Map<string, number>
  baselineTurn: number
  baselineAp: number
  /** even-turn/even-ap のみ: 素材ごとの単独負担単価。指定時はこの目的(最大負担)で不足/余剰を判定する。 */
  burdenUnitCosts?: Map<string, number>
}

/** counts の下での最大単独負担(満遍なくパターン自身の目的関数の値)。 */
const evaluateBurden = (
  fullNeed: Record<string, number>,
  recipes: readonly EventCraftRecipe[],
  counts: Map<string, number>,
  unitCosts: Map<string, number>,
): number => {
  const remaining = subtractCraftYieldsFromNeed(fullNeed, recipes, counts)
  let burden = 0
  for (const [itemId, unitCost] of unitCosts) {
    const rem = (Reflect.get(remaining, itemId) as number | undefined) ?? 0
    burden = Math.max(burden, rem * unitCost)
  }
  return burden
}

const evaluateBurdenAtCount = (
  fullNeed: Record<string, number>,
  recipes: readonly EventCraftRecipe[],
  workingCounts: Map<string, number>,
  recipeId: string,
  k: number,
  unitCosts: Map<string, number>,
): number => {
  const capped = new Map(workingCounts)
  capped.set(recipeId, k)
  return evaluateBurden(fullNeed, recipes, capped, unitCosts)
}

/** workingCounts 上でこのレシピだけを k 個に差し替えたときの残余コスト。 */
const evaluateResidualAtCount = (
  drops: Drops,
  fullNeed: Record<string, number>,
  recipes: readonly EventCraftRecipe[],
  workingCounts: Map<string, number>,
  recipeId: string,
  k: number,
  allowedQuestsList: string[],
  mode: DenominatorMode,
): number => {
  const capped = new Map(workingCounts)
  capped.set(recipeId, k)
  const need = subtractCraftYieldsFromNeed(fullNeed, recipes, capped)
  return continuousOptimalCost(drops, need, allowedQuestsList, mode)
}

/**
 * count 個のうち、referenceCost と同等の効果を得るのに必要な最小個数(=不足枠)を段階的に探す。
 * 残余コストは個数を増やすほど単調非増加なので、線形走査で最初に referenceCost に達した個数が
 * そのレシピの不足枠、残りは余剰枠になる（同一レシピ内の混在を分離できる）。
 */
const findMinimalUsefulCount = (
  drops: Drops,
  fullNeed: Record<string, number>,
  recipes: readonly EventCraftRecipe[],
  workingCounts: Map<string, number>,
  recipeId: string,
  count: number,
  allowedQuestsList: string[],
  mode: DenominatorMode,
  referenceCost: number,
): number => {
  // 残余コストは個数を増やすほど単調非増加なので、線形走査ではなく二分探索で
  // 最小の充足個数を求める(所持数が多いときの毎回LP解決によるUI固まりを避ける)。
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2)
    const cost = evaluateResidualAtCount(drops, fullNeed, recipes, workingCounts, recipeId, mid, allowedQuestsList, mode)
    if (cost <= referenceCost + EPSILON) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return lo
}

const buildPatternResult = (
  id: EventCraftPatternId,
  metric: EventCraftPatternMetric,
  classifyMode: DenominatorMode,
  counts: Map<string, number>,
  bctx: PatternBuildContext,
): EventCraftPatternResult => {
  const {
    drops,
    fullNeed,
    recipes,
    allowedQuestsList,
    ownedIngredients,
    singleValues,
    baselineTurn,
    baselineAp,
    burdenUnitCosts,
  } = bctx

  const residualTurnCost = evaluateResidualCost(
    drops, fullNeed, recipes, counts, allowedQuestsList, 'turn',
  )
  const residualApCost = evaluateResidualCost(
    drops, fullNeed, recipes, counts, allowedQuestsList, 'ap',
  )
  const referenceCost = classifyMode === 'turn' ? residualTurnCost : residualApCost
  // exhaust だけレシピ単位のゼロ化では「1個は不足充足に効くが残りは純粋な余剰」という
  // 混在を分離できない（他の4パターンは各々のtie-breakが無駄な皿を既に消すため混在しない）。
  const useMarginalSplit = id === 'exhaust'
  // even-turn/even-ap は自分の目的関数(最大単独負担)で不足/余剰を判定する。continuousOptimalCost
  // (合計コスト最小化LP)で判定すると、周回セット全体では他素材のついでで賄える皿を誤って余剰にする。
  const actualBurden = burdenUnitCosts ? evaluateBurden(fullNeed, recipes, counts, burdenUnitCosts) : 0

  const deficitCounts = new Map<string, number>()
  const surplusCounts = new Map<string, number>()
  const savings = new Map<string, { totalSaved: number; unitSaved: number }>()
  // 判定済みレシピは確定した個数(0 か deficitCount)に固定してから次のレシピを評価する。
  // 独立に(他レシピを元の個数のまま)ゼロ化すると、同レアの代替レシピ同士で「片方だけでも足りる」が
  // 両方に成立し、両方とも余剰扱いになってしまう(実際は両方消すと不足が復活する)。固定順の逐次帰属で防ぐ。
  const workingCounts = new Map(counts)

  for (const recipe of recipes) {
    const count = counts.get(recipe.id) ?? 0
    savings.set(recipe.id, { totalSaved: 0, unitSaved: 0 })
    if (count <= 0) continue

    const costWithout = evaluateResidualAtCount(
      drops, fullNeed, recipes, workingCounts, recipe.id, 0, allowedQuestsList, classifyMode,
    )
    const totalSaved = Number.isFinite(referenceCost)
      ? Math.max(0, costWithout - referenceCost)
      : 0

    const isUseful = burdenUnitCosts
      ? evaluateBurdenAtCount(fullNeed, recipes, workingCounts, recipe.id, 0, burdenUnitCosts) > actualBurden + EPSILON
      : totalSaved > EPSILON

    let deficitCount = 0
    if (isUseful) {
      deficitCount = useMarginalSplit
        ? findMinimalUsefulCount(
            drops, fullNeed, recipes, workingCounts, recipe.id, count, allowedQuestsList, classifyMode, referenceCost,
          )
        : count
    }
    workingCounts.set(recipe.id, deficitCount)

    if (deficitCount > 0) {
      deficitCounts.set(recipe.id, deficitCount)
      savings.set(recipe.id, { totalSaved, unitSaved: totalSaved / deficitCount })
    }
    if (deficitCount < count) {
      surplusCounts.set(recipe.id, count - deficitCount)
    }
  }

  const built = buildAllocations(recipes, deficitCounts, surplusCounts, savings, singleValues)
  const baseline = classifyMode === 'turn' ? baselineTurn : baselineAp

  return {
    id,
    metric,
    allocations: built.allocations,
    totalCrafted: built.totalDeficitCrafted + built.totalSurplusCrafted,
    totalDeficitCrafted: built.totalDeficitCrafted,
    totalSurplusCrafted: built.totalSurplusCrafted,
    totalSaved: Math.max(0, baseline - referenceCost),
    totalSurplusValue: built.totalSurplusValue,
    spentIngredients: built.spentIngredients,
    leftoverIngredients: calculateLeftovers(ownedIngredients, built.spentIngredients),
    residualTurnCost,
    residualApCost,
    baselineTurnCost: baselineTurn,
    baselineApCost: baselineAp,
  }
}

const PATTERN_ORDER: readonly EventCraftPatternId[] = [
  'runs',
  'ap',
  'even-turn',
  'even-ap',
  'exhaust',
]

/**
 * 表示済みカード（exhaust 除く）と正の (recipeId, count) 多重集合が一致するパターンを畳む。
 * runs / exhaust は常に表示。
 */
export const foldEventCraftPatterns = (
  patternsInOrder: readonly EventCraftPatternResult[],
): EventCraftPlanResult => {
  const positiveKey = (r: EventCraftPatternResult) =>
    r.allocations
      .filter((a) => a.totalCount > 0)
      .map((a) => `${a.recipe.id}:${a.totalCount}`)
      .sort()
      .join('|')

  const displayed: EventCraftPatternResult[] = []
  const aliasMap = new Map<EventCraftPatternId, EventCraftPatternId[]>()
  const absorbedInto: Partial<Record<EventCraftPatternId, EventCraftPatternId>> = {}

  for (const pattern of patternsInOrder) {
    if (pattern.id === 'runs' || pattern.id === 'exhaust') {
      displayed.push(pattern)
      continue
    }
    const key = positiveKey(pattern)
    const match = displayed.find(
      (d) => d.id !== 'exhaust' && positiveKey(d) === key,
    )
    if (match) {
      const list = aliasMap.get(match.id) ?? []
      list.push(pattern.id)
      aliasMap.set(match.id, list)
      absorbedInto[pattern.id] = match.id
    } else {
      displayed.push(pattern)
    }
  }

  const patterns: EventCraftPlanPattern[] = displayed.map((p) => ({
    ...p,
    aliasOf: aliasMap.get(p.id) ?? [],
  }))

  return { patterns, absorbedInto }
}

/** 保存済み選択パターンが非表示のとき、吸収先の表示カードへフォールバックする。 */
export const resolveVisiblePatternId = (
  plan: EventCraftPlanResult,
  id: EventCraftPatternId,
): EventCraftPatternId => {
  if (plan.patterns.some((p) => p.id === id)) return id
  return plan.absorbedInto[id] ?? 'runs'
}

export const computeEventCraftPlan = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  questIds: string[],
  options?: EventCraftPlanOptions,
): EventCraftPlanResult => {
  const recipes = options?.recipes ?? EVENT_CRAFT_RECIPES_2026
  const allowedQuestsList = questIds
  const itemsWithDropData = new Set(drops.drop_rates.map((dr) => dr.item_id))
  const farmableNeed = extractFarmableNeed(fullNeed, itemsWithDropData)

  const ctxTurn = createSolverContext(drops, fullNeed, ownedIngredients, {
    mode: 'turn', questIds, recipes,
  })
  const ctxAp = createSolverContext(drops, fullNeed, ownedIngredients, {
    mode: 'ap', questIds, recipes,
  })

  const singleValuesTurn = computeSingleItemBaseValues(drops, questIds, 'turn', {
    recipes, itemsWithDropData,
  })
  const singleValuesAp = computeSingleItemBaseValues(drops, questIds, 'ap', {
    recipes, itemsWithDropData,
  })

  const runsCounts = solveStage1(ctxTurn)
  const apCounts = solveStage1(ctxAp)

  const unitCostsTurn = computeSingleItemUnitCosts(
    drops, questIds, 'turn', farmableNeed.keys(), itemsWithDropData,
  )
  const unitCostsAp = computeSingleItemUnitCosts(
    drops, questIds, 'ap', farmableNeed.keys(), itemsWithDropData,
  )
  const evenTurnCounts = solveEvenBurden(ctxTurn, unitCostsTurn)
  const evenApCounts = solveEvenBurden(ctxAp, unitCostsAp)

  const exhaustCounts = solveExhaust(ctxTurn, recipes, ownedIngredients)

  const bctxBase = {
    drops,
    fullNeed,
    recipes,
    allowedQuestsList,
    ownedIngredients,
    baselineTurn: ctxTurn.baselineCost,
    baselineAp: ctxAp.baselineCost,
  }

  const all: EventCraftPatternResult[] = [
    buildPatternResult('runs', 'turn', 'turn', runsCounts, { ...bctxBase, singleValues: singleValuesTurn }),
    buildPatternResult('ap', 'ap', 'ap', apCounts, { ...bctxBase, singleValues: singleValuesAp }),
    buildPatternResult('even-turn', 'turn', 'turn', evenTurnCounts, {
      ...bctxBase, singleValues: singleValuesTurn, burdenUnitCosts: unitCostsTurn,
    }),
    buildPatternResult('even-ap', 'ap', 'ap', evenApCounts, {
      ...bctxBase, singleValues: singleValuesAp, burdenUnitCosts: unitCostsAp,
    }),
    buildPatternResult('exhaust', 'both', 'turn', exhaustCounts, { ...bctxBase, singleValues: singleValuesTurn }),
  ]

  // PATTERN_ORDER と一致させる（並び替えは不要だが将来の並び変更に備えて明示）
  const ordered = PATTERN_ORDER.map((id) => all.find((p) => p.id === id)!)

  return foldEventCraftPatterns(ordered)
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

const buildAdviceEffectText = (
  result: EventCraftPatternResult,
  mode: DenominatorMode,
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
  result: EventCraftPatternResult,
  ownedIngredients: IngredientCounts,
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

  const mode: DenominatorMode = result.metric === 'ap' ? 'ap' : 'turn'
  const baseline = mode === 'ap' ? result.baselineApCost : result.baselineTurnCost

  if (result.totalCrafted === 0) {
    if (baseline <= 0) {
      return t(
        'event-craft-advice-no-shortage',
        '現在、不足している対象素材がありません、先輩。食材が余っているなら「食材を使い切る」パターンも確認してみましょう。',
      )
    }
    const canCraftAny = result.allocations.some(
      (a) =>
        a.recipe.costs.seafood <= (ownedIngredients.seafood ?? 0) &&
        a.recipe.costs.meat <= (ownedIngredients.meat ?? 0) &&
        a.recipe.costs.vegetable <= (ownedIngredients.vegetable ?? 0),
    )
    if (canCraftAny) {
      return t(
        'event-craft-advice-no-saving',
        'この配分では周回削減効果がありません、先輩。「食材を使い切る」パターンも確認してみましょう。',
      )
    }
    return t(
      'event-craft-advice-cannot-craft',
      '手持ちの食材数では料理を作成できないようです、先輩。もう少しフリクエで食材を集めてみましょう。',
    )
  }

  const { top, topCount } = findTopAllocation(result.allocations)
  const topName = top ? t(`recipe-${top.recipe.id}`, top.recipe.name) : ''
  const head = top
    ? t(
        'event-craft-advice-head',
        '最優先は「{{name}}」です、先輩。これを {{count}} 個作成するのが最も効率的です。',
        { name: topName, count: topCount },
      )
    : ''

  const effect = buildAdviceEffectText(result, mode, t)
  return `${head} ${effect}`.trim()
}

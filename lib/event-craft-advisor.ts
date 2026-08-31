import solver from 'javascript-lp-solver'
import { Drops } from './get-drops'
import { Quest } from '../interfaces/fgodrop'
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
  timeoutMs?: number
}

const EPSILON = 1e-6

/**
 * 前段の最適値をタイブレーク制約の上限/下限に使うとき、固定epsilonだと値が大きい場合
 * (AP周回コストは万のオーダーになり得る)にソルバー内部の再計算との浮動小数点誤差で
 * feasible領域が消え、branch-and-boundが解けないまま極端に遅くなる。値の大きさに応じた
 * 相対許容を確保する。
 */
const boundaryTolerance = (value: number): number => Math.max(EPSILON, Math.abs(value) * 1e-6)

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
  remainingTimeoutMs?: () => number
}

const baseValuesCache = new WeakMap<object, Map<string, Map<string, number>>>()

export type SingleItemBaseValuesOptions = {
  recipes?: readonly EventCraftRecipe[]
  itemsWithDropData?: Set<string>
}

const findBestUnitCostForItem = (
  itemId: string,
  drops: Drops,
  allowedQuestSet: Set<string>,
  questMap: Map<string, Quest>,
  mode: DenominatorMode,
): number => {
  let best = Infinity
  for (const dr of drops.drop_rates) {
    if (dr.item_id !== itemId || dr.drop_rate <= 0) continue
    if (!allowedQuestSet.has(dr.quest_id)) continue
    const q = questMap.get(dr.quest_id)
    if (!q) continue
    const qCost = mode === 'turn' ? 1 : q.ap
    const unit = qCost / dr.drop_rate
    if (unit < best) best = unit
  }
  return Number.isFinite(best) ? best : 0
}

const buildBaseValuesCacheKey = (
  mode: DenominatorMode,
  questIds: string[],
  recipes: readonly EventCraftRecipe[],
): string => {
  const questKey = questIds.slice().sort((a, b) => a.localeCompare(b)).join(',')
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
  return `${mode}:${questKey}:${recipeKey}`
}

export const computeSingleItemBaseValues = (
  drops: Drops,
  questIds: string[],
  mode: DenominatorMode,
  options?: SingleItemBaseValuesOptions,
): Map<string, number> => {
  const recipes = options?.recipes ?? EVENT_CRAFT_RECIPES_2026
  const cacheKey = buildBaseValuesCacheKey(mode, questIds, recipes)

  const cacheTarget = drops.drop_rates ?? drops
  let dropsCache = baseValuesCache.get(cacheTarget)
  if (!dropsCache) {
    dropsCache = new Map()
    baseValuesCache.set(cacheTarget, dropsCache)
  }

  const cached = dropsCache.get(cacheKey)
  if (cached) return cached

  const questMap = new Map(drops.quests.map((q) => [q.id, q]))
  const allowedQuestSet = new Set(questIds)
  const dropDataSet =
    options?.itemsWithDropData ??
    new Set(drops.drop_rates.map((dr) => dr.item_id))

  const isolatedCost = new Map<string, number>()
  const costOf = (shortId: string): number => {
    if (!dropDataSet.has(shortId)) return 0
    const cachedCost = isolatedCost.get(shortId)
    if (cachedCost != null) return cachedCost
    const cost = findBestUnitCostForItem(shortId, drops, allowedQuestSet, questMap, mode)
    isolatedCost.set(shortId, cost)
    return cost
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
  const questMap = new Map(drops.quests.map((q) => [q.id, q]))
  const allowedQuestSet = new Set(questIds)
  const costs = new Map<string, number>()
  for (const itemId of itemIds) {
    if (!itemsWithDropData.has(itemId)) {
      costs.set(itemId, 0)
      continue
    }
    costs.set(itemId, findBestUnitCostForItem(itemId, drops, allowedQuestSet, questMap, mode))
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

/**
 * fullNeed に無関係なクエストは目的関数を最小化する側では最適解で常に0になるため、
 * モデルに含めても数学的には無意味。だが変数として存在するだけでソルバーのタブロー
 * サイズが膨らみ、本番規模(300クエスト級)では退化ピボットで極端に遅くなることが
 * あるため、farmableNeed のいずれかを実際にドロップするクエストだけに絞り込む。
 */
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
    Reflect.set(constraints, 'totalCost', { max: costCap + boundaryTolerance(costCap) })
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
  if (ctx.remainingTimeoutMs) {
    Reflect.set(model, 'timeout', Math.max(1, ctx.remainingTimeoutMs()))
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
  if (ctx.remainingTimeoutMs && ctx.remainingTimeoutMs() <= 0) return zero

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
  if (ctx.remainingTimeoutMs && ctx.remainingTimeoutMs() <= 0) return zero

  const model1b = buildStage1bModel(ctx, optCost1a)
  const res1b = solver.Solve(model1b)
  const targetRes = res1b.feasible ? res1b : res1a
  return readCraftCounts(ctx.recipes, targetRes)
}

/** 満遍なく（周回/AP）: 単位負担 remaining_i * unitCost_i の最大値を最小化する。 */
/** レシピが実際に生産し得る素材だけを対象にする(ユーザーの無関係な不足に埋もれさせない)。 */
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

const populateEvenBurdenVars = (
  model: solver.Model,
  ints: Record<string, number>,
  ctx: SolverContext,
  burdenNeed: Map<string, number>,
  unitCosts: Map<string, number>,
  isTieBreak: boolean,
) => {
  for (const itemId of burdenNeed.keys()) {
    Reflect.set(model.variables, `remaining_${itemId}`, {
      [`remain_${itemId}`]: 1,
      [`cap_${itemId}`]: -(unitCosts.get(itemId) ?? 0),
    })
  }

  const burdenVar: Record<string, number> = { burdenObj: 1 }
  for (const itemId of burdenNeed.keys()) {
    burdenVar[`cap_${itemId}`] = 1
  }
  Reflect.set(model.variables, 'burden', burdenVar)

  for (const recipe of ctx.recipes) {
    const yields = getRecipeYields(recipe, ctx.recipes)
    const relevant = Object.entries(yields).some(
      ([shortId, y]) => y > 0 && burdenNeed.has(shortId),
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
      if (y > 0 && burdenNeed.has(shortId)) {
        Reflect.set(craftVars, `remain_${shortId}`, y)
      }
    }
    Reflect.set(model.variables, varName, craftVars)
    Reflect.set(ints, varName, 1)
  }
}

const buildEvenBurdenModel = (
  ctx: SolverContext,
  burdenNeed: Map<string, number>,
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
  for (const [itemId, count] of burdenNeed.entries()) {
    Reflect.set(constraints, `remain_${itemId}`, { min: count })
    Reflect.set(constraints, `cap_${itemId}`, { min: 0 })
  }
  if (burdenCap != null) {
    Reflect.set(constraints, 'burdenObj', { max: burdenCap + boundaryTolerance(burdenCap) })
  }
  const model: solver.Model = {
    optimize: isTieBreak ? 'totalIngredients' : 'burdenObj',
    opType: 'min',
    constraints,
    variables: {},
    ints,
  }
  if (ctx.remainingTimeoutMs) {
    Reflect.set(model, 'timeout', Math.max(1, ctx.remainingTimeoutMs()))
  }
  populateEvenBurdenVars(model, ints, ctx, burdenNeed, unitCosts, isTieBreak)
  return model
}

const solveEvenBurden = (
  ctx: SolverContext,
  burdenNeed: Map<string, number>,
  unitCosts: Map<string, number>,
): Map<string, number> => {
  const zero = new Map(ctx.recipes.map((r) => [r.id, 0]))
  if (burdenNeed.size === 0) return zero
  if (ctx.remainingTimeoutMs && ctx.remainingTimeoutMs() <= 0) return zero
  const hasIngredients = Object.values(ctx.ownedIngredients).some(
    (c) => (c ?? 0) > 0,
  )
  if (!hasIngredients) return zero

  const modelA = buildEvenBurdenModel(ctx, burdenNeed, unitCosts, false)
  const resA = solver.Solve(modelA)
  if (!resA.feasible) return zero
  const burdenOpt = typeof resA.result === 'number' ? resA.result : 0
  if (ctx.remainingTimeoutMs && ctx.remainingTimeoutMs() <= 0) return zero

  const modelB = buildEvenBurdenModel(ctx, burdenNeed, unitCosts, true, burdenOpt)
  const resB = solver.Solve(modelB)
  const targetRes = resB.feasible ? resB : resA
  return readCraftCounts(ctx.recipes, targetRes)
}

const buildExhaustPhaseAModel = (
  recipes: readonly EventCraftRecipe[],
  ingredients: IngredientCounts,
  timeoutMs?: number,
): solver.Model => {
  const ints: Record<string, number> = {}
  const model: solver.Model = {
    optimize: 'spent',
    opType: 'max',
    constraints: {
      seafood: { max: Math.max(0, ingredients.seafood ?? 0) },
      meat: { max: Math.max(0, ingredients.meat ?? 0) },
      vegetable: { max: Math.max(0, ingredients.vegetable ?? 0) },
    },
    variables: {},
    ints,
  }
  if (timeoutMs != null) {
    Reflect.set(model, 'timeout', Math.max(1, timeoutMs))
  }
  for (const recipe of recipes) {
    const varName = `craft_${recipe.id}`
    const spent = recipe.costs.seafood + recipe.costs.meat + recipe.costs.vegetable
    Reflect.set(model.variables, varName, {
      spent,
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
    min: Math.max(0, maxSpend - boundaryTolerance(maxSpend)),
  })
  return model
}

/**
 * 食材を使い切る: 2段階辞書式最適化
 * Phase A: 食材消費量合計の最大化 (極小MILP)
 * Phase B: 最大消費量制約 (totalIngredientsSpent >= optSpend) の下で、フリクエ周回コスト最小化
 */
const solveExhaust = (
  ctxTurn: SolverContext,
  recipes: readonly EventCraftRecipe[],
  ownedIngredients: IngredientCounts,
): Map<string, number> => {
  const zero = new Map(recipes.map((r) => [r.id, 0]))
  if (ctxTurn.remainingTimeoutMs && ctxTurn.remainingTimeoutMs() <= 0) return zero
  const s = Math.max(0, ownedIngredients.seafood ?? 0)
  const m = Math.max(0, ownedIngredients.meat ?? 0)
  const v = Math.max(0, ownedIngredients.vegetable ?? 0)
  if (s <= 0 && m <= 0 && v <= 0) return zero

  const timeoutMs = ctxTurn.remainingTimeoutMs?.()
  const modelA = buildExhaustPhaseAModel(recipes, ownedIngredients, timeoutMs)
  const resA = solver.Solve(modelA)
  if (!resA.feasible) return zero
  const optSpend = typeof resA.result === 'number' ? resA.result : 0
  if (optSpend <= EPSILON) return zero
  if (ctxTurn.remainingTimeoutMs && ctxTurn.remainingTimeoutMs() <= 0) return zero

  const modelB = buildExhaustPhaseBModel(ctxTurn, optSpend)
  const resB = solver.Solve(modelB)
  const targetRes = resB.feasible ? resB : resA
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
  bctx: Pick<PatternBuildContext, 'drops' | 'fullNeed' | 'recipes' | 'allowedQuestsList' | 'remainingTimeoutMs'>,
  counts: Map<string, number>,
  mode: DenominatorMode,
): number => {
  const remaining = subtractCraftYieldsFromNeed(bctx.fullNeed, bctx.recipes, counts)
  return continuousOptimalCost(bctx.drops, remaining, bctx.allowedQuestsList, mode, {
    timeoutMs: bctx.remainingTimeoutMs?.(),
  })
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
    totalDeficitCrafted,
    totalSurplusCrafted,
    totalSurplusValue,
    spentIngredients,
  }
}

const calculateLeftovers = (
  ownedIngredients: IngredientCounts,
  spentIngredients: IngredientCounts,
): IngredientCounts => ({
  seafood: Math.max(
    0,
    (ownedIngredients.seafood ?? 0) - spentIngredients.seafood,
  ),
  meat: Math.max(0, (ownedIngredients.meat ?? 0) - spentIngredients.meat),
  vegetable: Math.max(
    0,
    (ownedIngredients.vegetable ?? 0) - spentIngredients.vegetable,
  ),
})

const createSolverContext = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  options: {
    mode: DenominatorMode
    questIds: string[]
    recipes: readonly EventCraftRecipe[]
    remainingTimeoutMs?: () => number
  },
): SolverContext => {
  const { mode, questIds, recipes, remainingTimeoutMs } = options
  const itemsWithDropData = new Set(drops.drop_rates.map((dr) => dr.item_id))
  const allowedQuests = new Set(questIds)
  const baselineCost = continuousOptimalCost(drops, fullNeed, questIds, mode, {
    timeoutMs: remainingTimeoutMs?.(),
  })
  // 皿決めMILPにアカウント全体の不足を載せると javascript-lp-solver が simplex 内部でハングする
  // (29〜40制約が崖。timeout は効かない)。料理が出せない素材は整数変数に効かないので除外し、
  // 残余コストだけ fullNeed で評価する。
  const recipeYieldTargets = getRecipeYieldTargets(recipes)
  const farmableNeed = new Map(
    [...extractFarmableNeed(fullNeed, itemsWithDropData)].filter(([itemId]) =>
      recipeYieldTargets.has(itemId),
    ),
  )

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
    remainingTimeoutMs,
  }
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

/** ゼロ化/段階判定に必要な材料をまとめたコンテキスト(引数個数を抑えるため)。 */
type ZeroingContext = {
  drops: Drops
  fullNeed: Record<string, number>
  recipes: readonly EventCraftRecipe[]
  workingCounts: Map<string, number>
  allowedQuestsList: string[]
  mode: DenominatorMode
  itemsWithDropData: Set<string>
  isTimedOut?: () => boolean
  remainingTimeoutMs?: () => number
}

/** ctx.workingCounts 上でこのレシピだけを k 個に差し替えたときの残余コスト。 */
const evaluateResidualAtCount = (
  ctx: ZeroingContext,
  recipeId: string,
  k: number,
): number => {
  const capped = new Map(ctx.workingCounts)
  capped.set(recipeId, k)
  const need = subtractCraftYieldsFromNeed(ctx.fullNeed, ctx.recipes, capped)
  return continuousOptimalCost(ctx.drops, need, ctx.allowedQuestsList, ctx.mode, {
    timeoutMs: ctx.remainingTimeoutMs?.(),
  })
}

/**
 * レシピの期待獲得が残余不足を減らすために必要な皿数の上限を直接算出する。
 */
const calculateDeficitCountDirect = (
  recipe: EventCraftRecipe,
  count: number,
  recipes: readonly EventCraftRecipe[],
  fullNeed: Record<string, number>,
  workingCounts: Map<string, number>,
  itemsWithDropData: Set<string>,
): number => {
  const capped = new Map(workingCounts)
  capped.delete(recipe.id)
  const remaining = subtractCraftYieldsFromNeed(fullNeed, recipes, capped)
  const yields = getRecipeYields(recipe, recipes)

  let neededDishes = 0
  for (const [shortId, y] of Object.entries(yields)) {
    if (y <= 0 || !itemsWithDropData.has(shortId)) continue
    const rem = (Reflect.get(remaining, shortId) as number | undefined) ?? 0
    if (rem > 0) {
      const dishes = Math.ceil(rem / y)
      if (dishes > neededDishes) {
        neededDishes = dishes
      }
    }
  }
  return Math.max(0, Math.min(count, neededDishes))
}

/**
 * ついでドロップを考慮し、残余周回コストが最小値に達する真の最小皿数を二分探索で求める。
 * calculateDeficitCountDirect で探索上限を絞るため、高々数回のLP解決(約1ms)で厳密に完了する。
 */
const findMinimalUsefulCount = (
  ctx: ZeroingContext,
  recipe: EventCraftRecipe,
  count: number,
  targetCost: number,
): number => {
  const directMax = calculateDeficitCountDirect(
    recipe, count, ctx.recipes, ctx.fullNeed, ctx.workingCounts, ctx.itemsWithDropData,
  )
  if (directMax <= 0) return 0
  if (ctx.isTimedOut?.()) return directMax

  let low = 0
  let high = directMax
  let best = directMax

  while (low <= high) {
    if (ctx.isTimedOut?.()) break
    const mid = Math.floor((low + high) / 2)
    const cost = evaluateResidualAtCount(ctx, recipe.id, mid)
    if (cost <= targetCost + EPSILON) {
      best = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return best
}

/** even-turn/even-ap は自分の目的関数(最大単独負担)で判定・表示する。continuousOptimalCost
 * (合計コスト最小化LP)のままだと、周回セット全体では他素材のついでで賄える皿を誤って余剰にし、
 * 表示削減量も0になって推奨理由を説明できない。他の3パターンは合計コストLPベースのまま。 */
const evaluateRecipeUsefulness = (
  recipeId: string,
  zeroingCtx: ZeroingContext,
  referenceCost: number,
  burdenUnitCosts: Map<string, number> | undefined,
  actualBurden: number,
): { isUseful: boolean; displaySaved: number } => {
  if (zeroingCtx.isTimedOut?.()) {
    return { isUseful: false, displaySaved: 0 }
  }
  if (burdenUnitCosts) {
    const burdenWithout = evaluateBurdenAtCount(
      zeroingCtx.fullNeed, zeroingCtx.recipes, zeroingCtx.workingCounts, recipeId, 0, burdenUnitCosts,
    )
    return {
      isUseful: burdenWithout > actualBurden + EPSILON,
      displaySaved: Math.max(0, burdenWithout - actualBurden),
    }
  }
  const costWithout = evaluateResidualAtCount(zeroingCtx, recipeId, 0)
  const totalSaved = Number.isFinite(referenceCost) ? Math.max(0, costWithout - referenceCost) : 0
  return { isUseful: totalSaved > EPSILON, displaySaved: totalSaved }
}

type ClassificationInputs = {
  recipes: readonly EventCraftRecipe[]
  counts: Map<string, number>
  zeroingCtx: ZeroingContext
  referenceCost: number
  useMarginalSplit: boolean
  burdenUnitCosts?: Map<string, number>
  actualBurden: number
}

const classifySingleRecipe = (
  recipe: EventCraftRecipe,
  count: number,
  inputs: ClassificationInputs,
): { deficitCount: number; displaySaved: number } => {
  const { zeroingCtx, referenceCost, useMarginalSplit, burdenUnitCosts, actualBurden } = inputs
  if (zeroingCtx.isTimedOut?.()) {
    return { deficitCount: 0, displaySaved: 0 }
  }

  const { isUseful, displaySaved } = evaluateRecipeUsefulness(
    recipe.id, zeroingCtx, referenceCost, burdenUnitCosts, actualBurden,
  )

  let deficitCount = 0
  if (isUseful) {
    deficitCount = useMarginalSplit
      ? findMinimalUsefulCount(zeroingCtx, recipe, count, referenceCost)
      : count
  }

  return { deficitCount, displaySaved }
}

/**
 * レシピを固定順で1つずつ判定し、判定済みレシピを確定個数(0 か deficitCount)に固定してから
 * 次のレシピを評価する。独立に(他レシピを元の個数のまま)ゼロ化すると、同レアの代替レシピ同士で
 * 「片方だけでも足りる」が両方に成立し、両方とも余剰扱いになってしまう(実際は両方消すと不足が復活する)。
 */
const classifyRecipeCounts = (inputs: ClassificationInputs) => {
  const { recipes, counts, zeroingCtx } = inputs
  const deficitCounts = new Map<string, number>()
  const surplusCounts = new Map<string, number>()
  const savings = new Map<string, { totalSaved: number; unitSaved: number }>()

  for (const recipe of recipes) {
    if (zeroingCtx.isTimedOut?.()) {
      return {
        deficitCounts: new Map<string, number>(),
        surplusCounts: new Map<string, number>(),
        savings: new Map<string, { totalSaved: number; unitSaved: number }>(),
      }
    }
    const count = counts.get(recipe.id) ?? 0
    savings.set(recipe.id, { totalSaved: 0, unitSaved: 0 })
    if (count <= 0) continue

    const { deficitCount, displaySaved } = classifySingleRecipe(recipe, count, inputs)
    zeroingCtx.workingCounts.set(recipe.id, deficitCount)

    if (deficitCount > 0) {
      deficitCounts.set(recipe.id, deficitCount)
      savings.set(recipe.id, { totalSaved: displaySaved, unitSaved: displaySaved / deficitCount })
    }
    if (deficitCount < count) {
      surplusCounts.set(recipe.id, count - deficitCount)
    }
  }

  if (zeroingCtx.isTimedOut?.()) {
    return {
      deficitCounts: new Map<string, number>(),
      surplusCounts: new Map<string, number>(),
      savings: new Map<string, { totalSaved: number; unitSaved: number }>(),
    }
  }

  return { deficitCounts, surplusCounts, savings }
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
  residualCache?: Map<string, { turn: number; ap: number }>
  itemsWithDropData: Set<string>
  isTimedOut?: () => boolean
  remainingTimeoutMs?: () => number
}

const getResidualCosts = (
  bctx: PatternBuildContext,
  counts: Map<string, number>,
): { residualTurnCost: number; residualApCost: number } => {
  const { baselineTurn, baselineAp, isTimedOut } = bctx
  const hasAnyCraft = [...counts.values()].some((c) => c > 0)
  if (!hasAnyCraft || isTimedOut?.()) {
    return { residualTurnCost: baselineTurn, residualApCost: baselineAp }
  }

  const key = bctx.recipes
    .map((r) => `${r.id}:${counts.get(r.id) ?? 0}`)
    .filter((s) => !s.endsWith(':0'))
    .join('|')

  const cached = bctx.residualCache?.get(key)
  if (cached) return { residualTurnCost: cached.turn, residualApCost: cached.ap }

  const residualTurnCost = evaluateResidualCost(bctx, counts, 'turn')
  const residualApCost = evaluateResidualCost(bctx, counts, 'ap')

  const res = { turn: residualTurnCost, ap: residualApCost }
  bctx.residualCache?.set(key, res)
  return { residualTurnCost, residualApCost }
}

const buildEmptyPatternResult = (
  id: EventCraftPatternId,
  metric: EventCraftPatternMetric,
  bctx: PatternBuildContext,
): EventCraftPatternResult => {
  const { recipes, singleValues, ownedIngredients, baselineTurn, baselineAp } = bctx
  const zeroCounts = new Map(recipes.map((r) => [r.id, 0]))
  const built = buildAllocations(recipes, zeroCounts, zeroCounts, new Map(), singleValues)
  return {
    id,
    metric,
    allocations: built.allocations,
    totalCrafted: 0,
    totalDeficitCrafted: 0,
    totalSurplusCrafted: 0,
    totalSaved: 0,
    totalSurplusValue: 0,
    spentIngredients: built.spentIngredients,
    leftoverIngredients: calculateLeftovers(ownedIngredients, built.spentIngredients),
    residualTurnCost: baselineTurn,
    residualApCost: baselineAp,
    baselineTurnCost: baselineTurn,
    baselineApCost: baselineAp,
  }
}

const buildPatternResult = (
  id: EventCraftPatternId,
  metric: EventCraftPatternMetric,
  classifyMode: DenominatorMode,
  counts: Map<string, number>,
  bctx: PatternBuildContext,
): EventCraftPatternResult => {
  if (bctx.isTimedOut?.()) {
    return buildEmptyPatternResult(id, metric, bctx)
  }

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
    itemsWithDropData,
  } = bctx

  const { residualTurnCost, residualApCost } = getResidualCosts(bctx, counts)
  const referenceCost = classifyMode === 'turn' ? residualTurnCost : residualApCost
  const useMarginalSplit = id === 'exhaust'
  const actualBurden = burdenUnitCosts ? evaluateBurden(fullNeed, recipes, counts, burdenUnitCosts) : 0

  const workingCounts = new Map(counts)
  const zeroingCtx: ZeroingContext = {
    drops, fullNeed, recipes, workingCounts, allowedQuestsList, mode: classifyMode,
    itemsWithDropData, isTimedOut: bctx.isTimedOut, remainingTimeoutMs: bctx.remainingTimeoutMs,
  }

  const { deficitCounts, surplusCounts, savings } = classifyRecipeCounts({
    recipes, counts, zeroingCtx, referenceCost, useMarginalSplit, burdenUnitCosts, actualBurden,
  })

  if (bctx.isTimedOut?.()) {
    return buildEmptyPatternResult(id, metric, bctx)
  }

  const built = buildAllocations(recipes, deficitCounts, surplusCounts, savings, singleValues)
  const baseline = classifyMode === 'turn' ? baselineTurn : baselineAp
  const totalSaved = burdenUnitCosts
    ? Math.max(0, evaluateBurden(fullNeed, recipes, new Map(), burdenUnitCosts) - actualBurden)
    : Math.max(0, baseline - referenceCost)

  return {
    id,
    metric,
    allocations: built.allocations,
    totalCrafted: built.totalDeficitCrafted + built.totalSurplusCrafted,
    totalDeficitCrafted: built.totalDeficitCrafted,
    totalSurplusCrafted: built.totalSurplusCrafted,
    totalSaved,
    totalSurplusValue: built.totalSurplusValue,
    spentIngredients: built.spentIngredients,
    leftoverIngredients: calculateLeftovers(ownedIngredients, built.spentIngredients),
    residualTurnCost,
    residualApCost,
    baselineTurnCost: baselineTurn,
    baselineApCost: baselineAp,
  }
}

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
      .sort((a, b) => a.localeCompare(b))
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
  return Reflect.get(plan.absorbedInto, id) ?? 'runs'
}

const DEFAULT_TIMEOUT_MS = 10000

type SolverContextPair = {
  ctxTurn: SolverContext
  ctxAp: SolverContext
  burdenNeed: Map<string, number>
  itemsWithDropData: Set<string>
}

const initSolverContextPair = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  questIds: string[],
  recipes: readonly EventCraftRecipe[],
  remainingTimeoutMs?: () => number,
): SolverContextPair => {
  const itemsWithDropData = new Set(drops.drop_rates.map((dr) => dr.item_id))
  const farmableNeed = extractFarmableNeed(fullNeed, itemsWithDropData)
  const recipeYieldTargets = getRecipeYieldTargets(recipes)
  const burdenNeed = new Map(
    [...farmableNeed].filter(([itemId]) => recipeYieldTargets.has(itemId)),
  )

  const ctxTurn = createSolverContext(drops, fullNeed, ownedIngredients, {
    mode: 'turn', questIds, recipes, remainingTimeoutMs,
  })
  const ctxAp = createSolverContext(drops, fullNeed, ownedIngredients, {
    mode: 'ap', questIds, recipes, remainingTimeoutMs,
  })

  return { ctxTurn, ctxAp, burdenNeed, itemsWithDropData }
}

type PatternCountsResult = {
  runsCounts: Map<string, number>
  apCounts: Map<string, number>
  evenTurnCounts: Map<string, number>
  evenApCounts: Map<string, number>
  unitCostsTurn?: Map<string, number>
  unitCostsAp?: Map<string, number>
}

const solveAllPatternCounts = (
  pair: SolverContextPair,
  drops: Drops,
  questIds: string[],
  isTimedOut: () => boolean,
): PatternCountsResult => {
  const { ctxTurn, ctxAp, burdenNeed, itemsWithDropData } = pair
  const zeroCounts = new Map(ctxTurn.recipes.map((r) => [r.id, 0]))
  if (isTimedOut()) {
    return {
      runsCounts: zeroCounts,
      apCounts: zeroCounts,
      evenTurnCounts: zeroCounts,
      evenApCounts: zeroCounts,
    }
  }

  const runsCounts = solveStage1(ctxTurn)
  const apCounts = !isTimedOut() ? solveStage1(ctxAp) : zeroCounts

  let unitCostsTurn: Map<string, number> | undefined
  let unitCostsAp: Map<string, number> | undefined
  let evenTurnCounts = zeroCounts
  let evenApCounts = zeroCounts

  if (!isTimedOut()) {
    unitCostsTurn = computeSingleItemUnitCosts(drops, questIds, 'turn', burdenNeed.keys(), itemsWithDropData)
    evenTurnCounts = solveEvenBurden(ctxTurn, burdenNeed, unitCostsTurn)
  }
  if (!isTimedOut()) {
    unitCostsAp = computeSingleItemUnitCosts(drops, questIds, 'ap', burdenNeed.keys(), itemsWithDropData)
    evenApCounts = solveEvenBurden(ctxAp, burdenNeed, unitCostsAp)
  }

  return { runsCounts, apCounts, evenTurnCounts, evenApCounts, unitCostsTurn, unitCostsAp }
}

export const computeEventCraftPlan = (
  drops: Drops,
  fullNeed: Record<string, number>,
  ownedIngredients: IngredientCounts,
  questIds: string[],
  options?: EventCraftPlanOptions,
): EventCraftPlanResult => {
  const rawTimeout = options?.timeoutMs
  const timeoutMs =
    typeof rawTimeout === 'number' && Number.isFinite(rawTimeout)
      ? rawTimeout
      : DEFAULT_TIMEOUT_MS

  const startTime = Date.now()
  const isTimedOut = () => timeoutMs <= 0 || Date.now() - startTime > timeoutMs
  const remainingTimeoutMs = () => Math.max(0, timeoutMs - (Date.now() - startTime))

  const recipes = options?.recipes ?? EVENT_CRAFT_RECIPES_2026
  const zeroCounts = new Map(recipes.map((r) => [r.id, 0]))

  if (isTimedOut()) {
    const bctxFallback: PatternBuildContext = {
      drops, fullNeed, recipes, allowedQuestsList: questIds, ownedIngredients,
      baselineTurn: 0, baselineAp: 0, singleValues: new Map(),
      itemsWithDropData: new Set(), isTimedOut: () => true,
    }
    return foldEventCraftPatterns([
      buildPatternResult('runs', 'turn', 'turn', zeroCounts, bctxFallback),
      buildPatternResult('ap', 'ap', 'ap', zeroCounts, bctxFallback),
      buildPatternResult('even-turn', 'turn', 'turn', zeroCounts, bctxFallback),
      buildPatternResult('even-ap', 'ap', 'ap', zeroCounts, bctxFallback),
      buildPatternResult('exhaust', 'both', 'turn', zeroCounts, bctxFallback),
    ])
  }

  const pair = initSolverContextPair(drops, fullNeed, ownedIngredients, questIds, recipes, remainingTimeoutMs)
  const singleValuesTurn = computeSingleItemBaseValues(drops, questIds, 'turn', { recipes, itemsWithDropData: pair.itemsWithDropData })
  const singleValuesAp = computeSingleItemBaseValues(drops, questIds, 'ap', { recipes, itemsWithDropData: pair.itemsWithDropData })

  const solved = solveAllPatternCounts(pair, drops, questIds, isTimedOut)
  const exhaustCounts = !isTimedOut()
    ? solveExhaust(pair.ctxTurn, recipes, ownedIngredients)
    : zeroCounts

  const bctxBase = {
    drops, fullNeed, recipes, allowedQuestsList: questIds, ownedIngredients,
    baselineTurn: pair.ctxTurn.baselineCost, baselineAp: pair.ctxAp.baselineCost,
    residualCache: new Map<string, { turn: number; ap: number }>(),
    itemsWithDropData: pair.itemsWithDropData,
    isTimedOut,
    remainingTimeoutMs,
  }

  const all: EventCraftPatternResult[] = [
    buildPatternResult('runs', 'turn', 'turn', solved.runsCounts, { ...bctxBase, singleValues: singleValuesTurn }),
    buildPatternResult('ap', 'ap', 'ap', solved.apCounts, { ...bctxBase, singleValues: singleValuesAp }),
    buildPatternResult('even-turn', 'turn', 'turn', solved.evenTurnCounts, { ...bctxBase, singleValues: singleValuesTurn, burdenUnitCosts: solved.unitCostsTurn }),
    buildPatternResult('even-ap', 'ap', 'ap', solved.evenApCounts, { ...bctxBase, singleValues: singleValuesAp, burdenUnitCosts: solved.unitCostsAp }),
    buildPatternResult('exhaust', 'both', 'turn', exhaustCounts, { ...bctxBase, singleValues: singleValuesTurn }),
  ]

  return foldEventCraftPatterns(all)
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
  const isBalancing = result.id === 'even-turn' || result.id === 'even-ap'
  let modeTail: string
  if (isBalancing) {
    modeTail = t('event-craft-advice-balance-tail', '特定の素材だけ大きく不足する事態を避けられる配分です。')
  } else if (mode === 'ap') {
    modeTail = t('event-craft-advice-ap-tail', 'りんごや石の温存に最適な配分です。')
  } else {
    modeTail = t('event-craft-advice-turn-tail', 'リアルの周回時間を最小化する配分です。')
  }

  let effectText = ''
  if (result.totalSaved > 0) {
    effectText = isBalancing
      ? t(
          'event-craft-advice-balance-saved',
          'この配分により、素材ごとの単独負担の山を約 {{amount}} {{unit}} 下げられます。{{tail}}',
          { amount: fmt(result.totalSaved), unit: u, tail: modeTail },
        )
      : t(
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

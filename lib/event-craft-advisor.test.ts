import { describe, it, expect } from 'vitest'
import {
  computeEventCraftPlan,
  foldEventCraftPatterns,
  resolveVisiblePatternId,
  canPersistResolvedPattern,
  solveEventCraftAllocation,
  generateCraftAdvice,
  computeSingleItemBaseValues,
  EventCraftPatternResult,
} from './event-craft-advisor'
import { EventCraftRecipe, IngredientCounts, EVENT_CRAFT_FEATURED_YIELD, sumExpectedCraftYields } from '../data/event-craft-recipes'
import { Drops } from './get-drops'
import { Localized } from './get-local-items'
import { Item, Quest } from '../interfaces/fgodrop'

const makeItem = (id: string, atlasId?: number): Localized<Item> => ({
  id,
  category: '銅素材',
  name: `item-${id}`,
  largeCategory: '強化素材',
  shortName: id,
  atlasId,
})

const makeQuest = (id: string, ap: number): Quest => ({
  id,
  section: 'Daily',
  area: 'area',
  name: `quest-${id}`,
  ap,
})

const buildTestDrops = (
  items: Localized<Item>[],
  quests: Quest[],
  drop_rates: Drops['drop_rates'],
): Drops => ({
  items,
  quests,
  drop_rates,
  campaigns: [],
})

const buildTwoItemSharedDrops = (): Drops =>
  buildTestDrops(
    [makeItem('item-a', 101), makeItem('item-b', 102)],
    [makeQuest('Q1', 20)],
    [
      { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
      { quest_id: 'Q1', item_id: 'item-b', drop_rate: 1.0 },
    ],
  )

const buildTwoQuestDrops = (): Drops =>
  buildTestDrops(
    [makeItem('item-a', 101), makeItem('item-b', 102)],
    [makeQuest('Q1', 20), makeQuest('Q2', 40)],
    [
      { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
      { quest_id: 'Q2', item_id: 'item-b', drop_rate: 1.0 },
    ],
  )

// テスト用レシピ定義
const sampleRecipes: EventCraftRecipe[] = [
  {
    id: 'recipe-a',
    name: '料理A（素材A）',
    costs: { seafood: 0, meat: 20, vegetable: 40 },
    targetItem: {
      atlasId: 101,
      shortId: 'item-a',
      name: '素材A',
      rarity: 'bronze',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'recipe-b',
    name: '料理B（素材B）',
    costs: { seafood: 40, meat: 0, vegetable: 20 },
    targetItem: {
      atlasId: 102,
      shortId: 'item-b',
      name: '素材B',
      rarity: 'bronze',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'recipe-c',
    name: '料理C（素材C）',
    costs: { seafood: 20, meat: 20, vegetable: 20 },
    targetItem: {
      atlasId: 103,
      shortId: 'item-c',
      name: '素材C',
      rarity: 'bronze',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'recipe-nodrop',
    name: '料理QP（ドロップ無）',
    costs: { seafood: 10, meat: 10, vegetable: 10 },
    targetItem: {
      atlasId: 999,
      shortId: 'nodrop-item',
      name: '限定素材',
      rarity: 'gold',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
]

describe('solveEventCraftAllocation', () => {
  it('不足素材に対して周回削減効果のある料理を最適に作成する (Stage 1)', () => {
    // Q1: item-a を 1.0/周 (AP 20)
    // Q2: item-b を 0.5/周 (AP 40)
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Q1', 20), makeQuest('Q2', 40)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
        { quest_id: 'Q2', item_id: 'item-b', drop_rate: 0.5 },
      ],
    )

    const fullNeed = { 'item-a': 1, 'item-b': 1 }
    const owned: IngredientCounts = { seafood: 80, meat: 40, vegetable: 120 }

    const res = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1', 'Q2'],
      {
        exhaustIngredients: false,
        recipes: sampleRecipes.slice(0, 2),
      },
    )

    expect(res.totalCrafted).toBe(4)
    expect(res.totalDeficitCrafted).toBe(4)
    expect(res.totalSurplusCrafted).toBe(0)

    const allocA = res.allocations.find((a) => a.recipe.id === 'recipe-a')
    const allocB = res.allocations.find((a) => a.recipe.id === 'recipe-b')
    expect(allocA?.deficitCount).toBe(2)
    expect(allocB?.deficitCount).toBe(2)

    // baseline: Q1×1 + Q2×2 (1/0.5) = 3周
    // 2A+2B で期待 a,b とも 1.1 → 残余 0
    expect(res.baselineCost).toBeCloseTo(3)
    expect(res.optimalCost).toBeCloseTo(0)
    expect(res.totalSaved).toBeCloseTo(3)
  })

  it('各料理の対象素材について farmableNeed の不足数を deficitNeed として返す', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Q1', 20), makeQuest('Q2', 40)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
        { quest_id: 'Q2', item_id: 'item-b', drop_rate: 0.5 },
      ],
    )

    const fullNeed = { 'item-a': 5, 'item-b': 226 }
    const owned: IngredientCounts = { seafood: 80, meat: 40, vegetable: 120 }

    const res = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1', 'Q2'],
      {
        exhaustIngredients: false,
        recipes: sampleRecipes.slice(0, 2),
      },
    )

    const allocA = res.allocations.find((a) => a.recipe.id === 'recipe-a')
    const allocB = res.allocations.find((a) => a.recipe.id === 'recipe-b')
    expect(allocA?.deficitNeed).toBe(5)
    expect(allocB?.deficitNeed).toBe(226)
  })

  it('ドロップデータのない対象素材は deficitNeed が 0 になる', () => {
    const d = buildTestDrops([], [], [])
    const fullNeed = { 'nodrop-item': 3 }
    const owned: IngredientCounts = { seafood: 10, meat: 10, vegetable: 10 }

    const res = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      [],
      {
        exhaustIngredients: false,
        recipes: [sampleRecipes[3]],
      },
    )

    const allocNoDrop = res.allocations.find((a) => a.recipe.id === 'recipe-nodrop')
    expect(allocNoDrop?.deficitNeed).toBe(0)
  })

  it('対象素材に不足が無くても、同レア素材のついで獲得のために作成されることがある', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )

    const recipeCheap: EventCraftRecipe = {
      id: 'recipe-cheap',
      name: '安価な料理（素材B）',
      costs: { seafood: 0, meat: 0, vegetable: 1 },
      targetItem: { atlasId: 102, shortId: 'item-b', name: '素材B', rarity: 'bronze' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
    }
    const recipeNormal: EventCraftRecipe = {
      id: 'recipe-normal',
      name: '通常の料理（素材A）',
      costs: { seafood: 0, meat: 0, vegetable: 40 },
      targetItem: { atlasId: 101, shortId: 'item-a', name: '素材A', rarity: 'bronze' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
    }

    // item-b は不足0(所持済み)。item-a だけ不足しているが、同レアのついで獲得(0.15/皿)を
    // 通常料理(40食材/皿)より遥かに安く得られる安価な料理(1食材/皿)が優先的に使われる。
    const fullNeed = { 'item-a': 100 }
    const owned: IngredientCounts = { seafood: 0, meat: 0, vegetable: 50 }

    const res = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1'],
      { exhaustIngredients: false, recipes: [recipeCheap, recipeNormal] },
    )

    const allocCheap = res.allocations.find((a) => a.recipe.id === 'recipe-cheap')
    expect(allocCheap?.deficitCount).toBeGreaterThan(0)
    expect(allocCheap?.deficitNeed).toBe(0)
  })

  it('周回コストが変わらないついでドロップ素材は不足枠でも作成しない (Stage 1b タイブレーク)', () => {
    // Q1 は item-a と item-b を同時に 1.0/周 で落とす
    // need: item-a: 10, item-b: 2
    // item-b は item-a を集める間に余剰8個手に入るため、recipe-b を作っても周回数は減らない
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Q1', 20)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
        { quest_id: 'Q1', item_id: 'item-b', drop_rate: 1.0 },
      ],
    )

    const fullNeed = { 'item-a': 10, 'item-b': 2 }
    const owned: IngredientCounts = { seafood: 100, meat: 100, vegetable: 100 }

    const res = solveEventCraftAllocation(d, fullNeed, owned, 'turn', ['Q1'], {
      exhaustIngredients: false,
      recipes: [
        sampleRecipes[0],
        {
          ...sampleRecipes[1],
          targetItem: { ...sampleRecipes[1].targetItem, rarity: 'silver' },
        },
      ],
    })

    const allocB = res.allocations.find((a) => a.recipe.id === 'recipe-b')
    // recipe-b は周回削減に寄与しないため、消費食材最小化により 0 個となる
    expect(allocB?.deficitCount).toBe(0)
  })

  it('Stage 1b は期待充足に必要な皿だけ作り、ゼロ効果の余分な皿は作らない', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )

    const fullNeed = { 'item-a': 1 }
    const owned: IngredientCounts = { seafood: 0, meat: 200, vegetable: 400 }

    const resOff = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1'],
      {
        exhaustIngredients: false,
        recipes: sampleRecipes.slice(0, 1),
      },
    )
    const allocAOff = resOff.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(allocAOff?.deficitCount).toBe(3)
    expect(allocAOff?.surplusCount).toBe(0)
    expect(resOff.totalCrafted).toBe(3)

    const resOn = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1'],
      {
        exhaustIngredients: true,
        recipes: sampleRecipes.slice(0, 1),
      },
    )
    const allocAOn = resOn.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(allocAOn?.deficitCount).toBe(3)
    expect(allocAOn?.surplusCount).toBe(7)
    expect(resOn.totalCrafted).toBe(10)
  })

  it('不足が 0 でも「食材を使い切る」が ON なら単体価値最大で作成する (Stage 2)', () => {
    // Q1: item-a (AP 20), Q2: item-b (AP 40)
    const d = buildTwoQuestDrops()

    const fullNeed = {}
    const owned: IngredientCounts = { seafood: 80, meat: 0, vegetable: 40 }

    // 使い切り OFF -> 作成 0
    const resOff = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'ap',
      ['Q1', 'Q2'],
      {
        exhaustIngredients: false,
        recipes: sampleRecipes,
      },
    )
    expect(resOff.totalCrafted).toBe(0)

    // 使い切り ON -> recipe-b (seafood 40, veg 20) を 2 回作成
    const resOn = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'ap',
      ['Q1', 'Q2'],
      {
        exhaustIngredients: true,
        recipes: sampleRecipes,
      },
    )
    expect(resOn.totalCrafted).toBe(2)
    expect(resOn.totalSurplusCrafted).toBe(2)
    expect(resOn.totalSaved).toBe(0) // 周回削減は 0
    expect(resOn.totalSurplusValue).toBeCloseTo(38) // (0.4*40 + 0.15*20) × 2
  })

  it('ドロップデータのない素材は infeasible 回避のため除外される', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )

    const fullNeed = { 'nodrop-item': 5 }
    const owned: IngredientCounts = { seafood: 50, meat: 50, vegetable: 50 }

    const res = solveEventCraftAllocation(d, fullNeed, owned, 'turn', ['Q1'], {
      exhaustIngredients: false,
      recipes: sampleRecipes,
    })
    expect(Number.isFinite(res.optimalCost)).toBe(true)
    expect(res.totalCrafted).toBe(0)
  })

  it('同一クエストから複数素材がドロップする場合も最終配分に基づく貢献削減量を正しく算出する', () => {
    // Q1 drops both item-a and item-b at rate 1.0, AP 20
    const d = buildTwoItemSharedDrops()
    // Needs 1 of item-a and 1 of item-b. Both crafted together saves 20 AP.
    const owned: IngredientCounts = { seafood: 80, meat: 40, vegetable: 120 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1, 'item-b': 1 },
      owned,
      'ap',
      ['Q1'],
      { exhaustIngredients: false, recipes: sampleRecipes.slice(0, 2) },
    )
    expect(res.totalSaved).toBe(20)
    const allocA = res.allocations.find((a) => a.recipe.id === 'recipe-a')
    const allocB = res.allocations.find((a) => a.recipe.id === 'recipe-b')
    expect(allocA?.deficitCount).toBe(2)
    expect(allocB?.deficitCount).toBe(2)
    expect(allocA?.deficitSaved).toBeCloseTo(14)
    expect(allocB?.deficitSaved).toBeCloseTo(14)
  })

  it('事前計算された singleItemBaseValues を渡して余剰最適化を実行できる', () => {
    const d = buildTwoItemSharedDrops()
    const baseValues = computeSingleItemBaseValues(d, ['Q1'], 'ap', { recipes: sampleRecipes })
    expect(baseValues.get('recipe-a')).toBeCloseTo(11)
    expect(baseValues.get('recipe-b')).toBeCloseTo(11)

    const owned: IngredientCounts = { seafood: 40, meat: 0, vegetable: 20 }
    const res = solveEventCraftAllocation(d, {}, owned, 'ap', ['Q1'], {
      exhaustIngredients: true,
      recipes: sampleRecipes,
      singleItemBaseValues: baseValues,
    })
    expect(res.totalSurplusCrafted).toBe(1)
    expect(res.totalSurplusValue).toBeCloseTo(11)
  })
})

describe('generateCraftAdvice', () => {
  it('食材が未入力の場合は入力を促すセリフを返す', () => {
    const d = buildTestDrops([], [], [])
    const owned: IngredientCounts = { seafood: 0, meat: 0, vegetable: 0 }
    const res = solveEventCraftAllocation(d, {}, owned, 'ap', [])
    const advice = generateCraftAdvice(res, owned, 'ap', false)
    expect(advice).toContain('お持ちのイベント食材数')
  })

  it('削減効果がある場合は最優先料理と削減量を案内する', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const owned: IngredientCounts = { seafood: 0, meat: 60, vegetable: 120 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1 },
      owned,
      'ap',
      ['Q1'],
      {
        exhaustIngredients: false,
        recipes: sampleRecipes,
      },
    )
    const advice = generateCraftAdvice(res, owned, 'ap', false)
    expect(advice).toContain('最優先は「料理A（素材A）」です')
    expect(advice).toContain('AP を削減できます')
  })

  it('食材はあるが作成による削減効果がない場合は削減効果なしのアドバイスを返す', () => {
    // Q1 drops item-a (1.0) and item-b (1.0), AP 20
    // User needs 10 of item-a, but only 0 of item-b.
    // However, if user has ingredients for recipe-b (which produces item-b), crafting item-b saves 0 runs because Q1 is already run 10 times for item-a and drops 10 item-b as byproduct.
    const d = buildTwoItemSharedDrops()
    const owned: IngredientCounts = { seafood: 40, meat: 0, vegetable: 20 } // enough for recipe-b
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 10 },
      owned,
      'ap',
      ['Q1'],
      { exhaustIngredients: false, recipes: [sampleRecipes[1]] },
    )
    const advice = generateCraftAdvice(res, owned, 'ap', false)
    expect(advice).toContain('周回削減効果がありません')
  })

  it('同一レシピで不足分と余剰分の両方が作成される場合も余剰アドバイスに反映される', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const owned: IngredientCounts = { seafood: 0, meat: 80, vegetable: 160 } // 4 recipe-a
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1 },
      owned,
      'ap',
      ['Q1'],
      { exhaustIngredients: true, recipes: sampleRecipes.slice(0, 1) },
    )
    const advice = generateCraftAdvice(res, owned, 'ap', true)
    expect(advice).toContain('最優先は「料理A（素材A）」です')
    expect(advice).toContain('余った食材で「料理A（素材A）」を作成し')
  })

  it('1回あたりの周回削減効率（unitSaved）が高い料理を最優先として案内する', () => {
    // Q1 drops item-a (AP 20, rate 1.0 -> 20 AP/item)
    // Q2 drops item-b (AP 40, rate 1.0 -> 40 AP/item)
    const d = buildTwoQuestDrops()
    // Recipe A saves 20 AP each. Recipe B saves 40 AP each.
    // User needs 3 of item-a and 1 of item-b.
    // Recipe A total deficit saved = 60 AP. Recipe B total deficit saved = 40 AP.
    // However, Recipe B is more efficient per craft (40 AP vs 20 AP), so advice should name Recipe B.
    const owned: IngredientCounts = { seafood: 80, meat: 180, vegetable: 400 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 3, 'item-b': 1 },
      owned,
      'ap',
      ['Q1', 'Q2'],
      { exhaustIngredients: false, recipes: sampleRecipes.slice(0, 2) },
    )
    const advice = generateCraftAdvice(res, owned, 'ap', false)
    expect(advice).toContain('最優先は「料理A（素材A）」です')
  })

  it('dropsオブジェクトが更新された場合はキャッシュを共有せず最新のドロップデータで再計算する', () => {
    const d1 = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const d2 = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 10)], // AP changed from 20 to 10
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const val1 = computeSingleItemBaseValues(d1, ['Q1'], 'ap', { recipes: sampleRecipes })
    const val2 = computeSingleItemBaseValues(d2, ['Q1'], 'ap', { recipes: sampleRecipes })
    expect(val1.get('recipe-a')).toBeCloseTo(8)
    expect(val2.get('recipe-a')).toBeCloseTo(4)
  })

  it('カスタム翻訳関数を渡した場合は翻訳されたアドバイスを返す', () => {
    const d = buildTestDrops([], [], [])
    const owned: IngredientCounts = { seafood: 0, meat: 0, vegetable: 0 }
    const res = solveEventCraftAllocation(d, {}, owned, 'ap', [])
    const mockT = (key: string) => (key === 'event-craft-advice-prompt' ? 'English prompt message' : key)
    const advice = generateCraftAdvice(res, owned, 'ap', false, mockT)
    expect(advice).toBe('English prompt message')
  })
})

describe('expected-yield solver behavior', () => {
  it('主産物不足 0 でも同レアの他不足があれば料理を選び残余コストを下げる', () => {
    const d = buildTwoQuestDrops()
    const owned: IngredientCounts = { seafood: 0, meat: 200, vegetable: 400 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 0, 'item-b': 10 },
      owned,
      'ap',
      ['Q1', 'Q2'],
      { exhaustIngredients: false, recipes: sampleRecipes.slice(0, 2) },
    )
    const allocA = res.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(allocA?.deficitCount).toBeGreaterThan(0)
    expect(res.totalSaved).toBeGreaterThan(0)
    expect(res.optimalCost).toBeLessThan(res.baselineCost)
  })

  it('ついで係数だけ違う recipes を続けて渡しても V_base キャッシュを再利用しない', () => {
    const d = buildTwoQuestDrops()
    const recipeA = sampleRecipes[0]
    const first = computeSingleItemBaseValues(d, ['Q1', 'Q2'], 'ap', {
      recipes: [{ ...recipeA, yields: { 'item-a': 0.4 } }],
    })
    const second = computeSingleItemBaseValues(d, ['Q1', 'Q2'], 'ap', {
      recipes: [{ ...recipeA, yields: { 'item-a': 0.4, 'item-b': 0.15 } }],
    })
    expect(first.get('recipe-a')).toBeCloseTo(8)
    expect(second.get('recipe-a')).toBeCloseTo(14)
  })

  it('不足1に対し 0.40×3 皿の過産でも unitSaved は元の不足コストを超えない', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const owned: IngredientCounts = { seafood: 0, meat: 60, vegetable: 120 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1 },
      owned,
      'ap',
      ['Q1'],
      { exhaustIngredients: false, recipes: sampleRecipes.slice(0, 1) },
    )
    const allocA = res.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(allocA?.deficitCount).toBe(3)
    expect(allocA?.deficitSaved).toBeCloseTo(20)
    expect(allocA?.unitSaved).toBeCloseTo(20 / 3)
    const unitSaved = allocA?.unitSaved ?? 0
    const deficitCount = allocA?.deficitCount ?? 0
    expect(unitSaved * deficitCount).toBeLessThanOrEqual(20 + 1e-6)
  })

  it('不足枠と余剰枠の皿数を足した期待獲得になる', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const recipeA = sampleRecipes[0]
    const recipeB = sampleRecipes[1]
    const totals = sumExpectedCraftYields(
      [
        { recipe: recipeA, totalCount: 3 },
        { recipe: recipeB, totalCount: 2 },
      ],
      [recipeA, recipeB],
    )
    const byId = Object.fromEntries(totals.map((e) => [e.shortId, e.amount]))
    expect(byId['item-a']).toBeCloseTo(3 * 0.4 + 2 * 0.15)
    expect(byId['item-b']).toBeCloseTo(3 * 0.15 + 2 * 0.4)

    const owned: IngredientCounts = { seafood: 0, meat: 80, vegetable: 160 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1 },
      owned,
      'ap',
      ['Q1'],
      { exhaustIngredients: true, recipes: [recipeA] },
    )
    const fromAlloc = sumExpectedCraftYields(res.allocations, [recipeA])
    const aAmt = fromAlloc.find((e) => e.shortId === 'item-a')?.amount ?? 0
    expect(aAmt).toBeCloseTo(res.totalCrafted * 0.4)
    expect(res.totalDeficitCrafted).toBeGreaterThan(0)
    expect(res.totalSurplusCrafted).toBeGreaterThan(0)
  })
})

describe('皿決めMILPを絞ったあとの残余評価', () => {
  it('料理が出さない不足があっても、削減量はアカウント全体の残余コスト差である', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-z', 199)],
      [makeQuest('Qa', 20), makeQuest('Qz', 20)],
      [
        { quest_id: 'Qa', item_id: 'item-a', drop_rate: 1 },
        { quest_id: 'Qz', item_id: 'item-z', drop_rate: 1 },
      ],
    )
    const recipeA: EventCraftRecipe = {
      ...sampleRecipes[0],
      yields: { 'item-a': 1 },
    }
    const owned: IngredientCounts = { seafood: 0, meat: 20, vegetable: 40 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1, 'item-z': 1 },
      owned,
      'turn',
      ['Qa', 'Qz'],
      { exhaustIngredients: false, recipes: [recipeA] },
    )
    expect(res.baselineCost).toBeCloseTo(2)
    expect(res.optimalCost).toBeCloseTo(1)
    expect(res.totalSaved).toBeCloseTo(1)
    expect(res.allocations.find((a) => a.recipe.id === 'recipe-a')?.deficitCount).toBe(1)
  })

  it('同一クエストの非料理素材が残る皿は、全体の残余が下がらないので不足枠にしない', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-z', 199)],
      [makeQuest('Q1', 20)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1 },
        { quest_id: 'Q1', item_id: 'item-z', drop_rate: 1 },
      ],
    )
    const recipeA: EventCraftRecipe = {
      ...sampleRecipes[0],
      yields: { 'item-a': 1 },
    }
    const owned: IngredientCounts = { seafood: 0, meat: 20, vegetable: 40 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1, 'item-z': 1 },
      owned,
      'turn',
      ['Q1'],
      { exhaustIngredients: false, recipes: [recipeA] },
    )
    expect(res.baselineCost).toBeCloseTo(1)
    expect(res.optimalCost).toBeCloseTo(1)
    expect(res.totalSaved).toBeCloseTo(0)
    expect(res.allocations.find((a) => a.recipe.id === 'recipe-a')?.deficitCount).toBe(0)
    expect(res.totalDeficitCrafted).toBe(0)
  })

  it('削減0で捨てた皿の食材を、残余を下げる別料理へ割り当て直す', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-z', 199), makeItem('item-b', 102)],
      [makeQuest('Qaz', 20), makeQuest('Qb', 20)],
      [
        { quest_id: 'Qaz', item_id: 'item-a', drop_rate: 1 },
        { quest_id: 'Qaz', item_id: 'item-z', drop_rate: 1 },
        { quest_id: 'Qb', item_id: 'item-b', drop_rate: 1 },
      ],
    )
    const recipeA: EventCraftRecipe = {
      ...sampleRecipes[0],
      costs: { seafood: 0, meat: 10, vegetable: 0 },
      yields: { 'item-a': 1 },
    }
    const recipeB: EventCraftRecipe = {
      ...sampleRecipes[1],
      costs: { seafood: 0, meat: 20, vegetable: 0 },
      yields: { 'item-b': 1 },
    }
    const owned: IngredientCounts = { seafood: 0, meat: 20, vegetable: 0 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1, 'item-z': 1, 'item-b': 1 },
      owned,
      'turn',
      ['Qaz', 'Qb'],
      { exhaustIngredients: false, recipes: [recipeA, recipeB] },
    )
    expect(res.baselineCost).toBeCloseTo(2)
    expect(res.optimalCost).toBeCloseTo(1)
    expect(res.totalSaved).toBeCloseTo(1)
    expect(res.allocations.find((a) => a.recipe.id === 'recipe-a')?.deficitCount).toBe(0)
    expect(res.allocations.find((a) => a.recipe.id === 'recipe-b')?.deficitCount).toBe(1)
  })

  it('leave-one-out削減が同時に0の皿は、片方だけ禁じて残りを再評価する', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-z', 199), makeItem('item-b', 102)],
      [makeQuest('Qa', 20), makeQuest('Qb', 20)],
      [
        { quest_id: 'Qa', item_id: 'item-a', drop_rate: 1 },
        { quest_id: 'Qa', item_id: 'item-z', drop_rate: 1 },
        { quest_id: 'Qb', item_id: 'item-b', drop_rate: 1 },
        { quest_id: 'Qb', item_id: 'item-z', drop_rate: 1 },
      ],
    )
    const recipeA: EventCraftRecipe = {
      ...sampleRecipes[0],
      costs: { seafood: 0, meat: 10, vegetable: 0 },
      yields: { 'item-a': 1 },
    }
    const recipeB: EventCraftRecipe = {
      ...sampleRecipes[1],
      costs: { seafood: 0, meat: 10, vegetable: 0 },
      yields: { 'item-b': 1 },
    }
    const owned: IngredientCounts = { seafood: 0, meat: 20, vegetable: 0 }
    const res = solveEventCraftAllocation(
      d,
      { 'item-a': 1, 'item-z': 1, 'item-b': 1 },
      owned,
      'turn',
      ['Qa', 'Qb'],
      { exhaustIngredients: false, recipes: [recipeA, recipeB] },
    )
    expect(res.baselineCost).toBeCloseTo(2)
    expect(res.optimalCost).toBeCloseTo(1)
    expect(res.totalSaved).toBeCloseTo(1)
    expect(res.totalDeficitCrafted).toBe(1)
  })
})

const patternMetric = {
  runs: 'turn',
  ap: 'ap',
  'even-turn': 'turn',
  'even-ap': 'ap',
  exhaust: 'both',
} as const

const makePattern = (
  id: EventCraftPatternResult['id'],
  recipe: EventCraftRecipe,
  count: number,
): EventCraftPatternResult => ({
  id,
  metric: patternMetric[id],
  allocations: [
    {
      recipe,
      deficitCount: count,
      surplusCount: 0,
      totalCount: count,
      unitSaved: 0,
      deficitSaved: 0,
      surplusValue: 0,
      spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
      deficitNeed: 0,
    },
  ],
  totalCrafted: count,
  totalDeficitCrafted: count,
  totalSurplusCrafted: 0,
  totalSaved: 0,
  totalSurplusValue: 0,
  spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
  leftoverIngredients: { seafood: 0, meat: 0, vegetable: 0 },
  residualTurnCost: 0,
  residualApCost: 0,
  baselineTurnCost: 0,
  baselineApCost: 0,
})

describe('event craft plan patterns', () => {
  it('folds an even pattern into the first matching visible card and resolves selection', () => {
    const runs = makePattern('runs', sampleRecipes[0], 2)
    const ap = makePattern('ap', sampleRecipes[1], 3)
    const evenTurn = makePattern('even-turn', sampleRecipes[1], 3)
    const exhaust = makePattern('exhaust', sampleRecipes[0], 2)
    const plan = foldEventCraftPatterns([runs, ap, evenTurn, exhaust])
    expect(plan.patterns.map((pattern) => pattern.id)).toEqual([
      'runs',
      'ap',
      'exhaust',
    ])
    expect(plan.patterns[1].aliasOf).toEqual(['even-turn'])
    expect(resolveVisiblePatternId(plan, 'even-turn')).toBe('ap')
    expect(resolveVisiblePatternId(plan, 'even-ap')).toBe('runs')
  })

  it('does not persist a resolved pattern until the plan has settled', () => {
    expect(
      canPersistResolvedPattern({
        isDataReady: true,
        isPlanLoading: true,
        didPlanTimeout: false,
        visiblePatternCount: 0,
      }),
    ).toBe(false)
    expect(
      canPersistResolvedPattern({
        isDataReady: true,
        isPlanLoading: false,
        didPlanTimeout: false,
        visiblePatternCount: 2,
      }),
    ).toBe(true)
  })

  it('uses the expected yield basket for even plans instead of one featured item per dish', () => {
    const drops = buildTwoItemSharedDrops()
    const recipe = {
      ...sampleRecipes[0],
      costs: { seafood: 20, meat: 0, vegetable: 0 },
    }
    const plan = computeEventCraftPlan(
      drops,
      { 'item-a': 5 },
      { seafood: 1000, meat: 0, vegetable: 0 },
      ['Q1'],
      { recipes: [recipe] },
    )
    const evenId = plan.absorbedInto['even-turn'] ?? 'even-turn'
    const even = plan.patterns.find((pattern) => pattern.id === evenId)
    expect(even?.allocations[0].totalCount).toBeGreaterThan(5)
  })

  it('even-turn lowers the highest single-item burden instead of the largest raw count', () => {
    const drops = buildTestDrops(
      [makeItem('item-bronze', 101), makeItem('item-gold', 102)],
      [makeQuest('Qbronze', 20), makeQuest('Qgold', 20)],
      [
        {
          quest_id: 'Qbronze',
          item_id: 'item-bronze',
          drop_rate: 1,
        },
        {
          quest_id: 'Qgold',
          item_id: 'item-gold',
          drop_rate: 0.05,
        },
      ],
    )
    const recipes: EventCraftRecipe[] = [
      {
        ...sampleRecipes[0],
        id: 'recipe-bronze',
        costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: {
          ...sampleRecipes[0].targetItem,
          shortId: 'item-bronze',
        },
      },
      {
        ...sampleRecipes[1],
        id: 'recipe-gold',
        costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: {
          ...sampleRecipes[1].targetItem,
          shortId: 'item-gold',
          rarity: 'gold',
        },
      },
    ]
    const plan = computeEventCraftPlan(
      drops,
      { 'item-bronze': 20, 'item-gold': 2 },
      { seafood: 160, meat: 0, vegetable: 0 },
      ['Qbronze', 'Qgold'],
      { recipes },
    )
    const even = plan.patterns.find(
      (pattern) => pattern.id === 'even-turn',
    )
    expect(even).toBeDefined()
    expect(
      even?.allocations.find(
        (allocation) => allocation.recipe.id === 'recipe-bronze',
      )?.totalCount,
    ).toBe(5)
    expect(
      even?.allocations.find(
        (allocation) => allocation.recipe.id === 'recipe-gold',
      )?.totalCount,
    ).toBe(3)
  })

  it('separates even-turn and even-ap when their unit burdens diverge', () => {
    const drops = buildTestDrops(
      [makeItem('item-x', 101), makeItem('item-y', 102)],
      [makeQuest('Qx', 100), makeQuest('Qy', 2)],
      [
        { quest_id: 'Qx', item_id: 'item-x', drop_rate: 1 },
        { quest_id: 'Qy', item_id: 'item-y', drop_rate: 0.1 },
      ],
    )
    const recipes: EventCraftRecipe[] = [
      {
        ...sampleRecipes[0],
        id: 'recipe-x',
        costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: {
          ...sampleRecipes[0].targetItem,
          shortId: 'item-x',
        },
      },
      {
        ...sampleRecipes[1],
        id: 'recipe-y',
        costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: {
          ...sampleRecipes[1].targetItem,
          shortId: 'item-y',
          rarity: 'gold',
        },
      },
    ]
    const plan = computeEventCraftPlan(
      drops,
      { 'item-x': 2, 'item-y': 2 },
      { seafood: 20, meat: 0, vegetable: 0 },
      ['Qx', 'Qy'],
      { recipes },
    )
    expect(plan.absorbedInto['even-turn']).toBe('runs')
    expect(plan.absorbedInto['even-ap']).toBe('ap')
    const runs = plan.patterns.find((pattern) => pattern.id === 'runs')
    const ap = plan.patterns.find((pattern) => pattern.id === 'ap')
    expect(
      runs?.allocations.find(
        (allocation) => allocation.recipe.id === 'recipe-y',
      )?.totalCount,
    ).toBe(1)
    expect(
      ap?.allocations.find(
        (allocation) => allocation.recipe.id === 'recipe-x',
      )?.totalCount,
    ).toBe(1)
  })

  it('can cook a byproduct-covered material when it remains a single-item burden peak', () => {
    const drops = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Qa', 20), makeQuest('Qb', 20)],
      [
        { quest_id: 'Qa', item_id: 'item-a', drop_rate: 1 },
        { quest_id: 'Qb', item_id: 'item-b', drop_rate: 0.05 },
      ],
    )
    const recipes: EventCraftRecipe[] = [
      {
        ...sampleRecipes[0],
        costs: { seafood: 20, meat: 0, vegetable: 0 },
      },
      {
        ...sampleRecipes[1],
        costs: { seafood: 20, meat: 0, vegetable: 0 },
      },
    ]
    const plan = computeEventCraftPlan(
      drops,
      { 'item-a': 20, 'item-b': 3 },
      { seafood: 160, meat: 0, vegetable: 0 },
      ['Qa', 'Qb'],
      { recipes },
    )
    const runs = plan.patterns.find((pattern) => pattern.id === 'runs')
    const even = plan.patterns.find(
      (pattern) => pattern.id === 'even-turn',
    )
    expect(runs?.allocations[0].totalCount).toBe(0)
    expect(even?.allocations[0].totalCount).toBeGreaterThanOrEqual(1)
  })

  it('splits useful and surplus dishes within one exhaust recipe without farming-LP binary search', () => {
    const drops = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1 }],
    )
    const plan = computeEventCraftPlan(
      drops,
      { 'item-a': 1 },
      { seafood: 0, meat: 80, vegetable: 160 },
      ['Q1'],
      { recipes: sampleRecipes.slice(0, 1) },
    )
    const exhaust = plan.patterns.find(
      (pattern) => pattern.id === 'exhaust',
    )
    expect(exhaust?.allocations[0].totalCount).toBe(4)
    expect(exhaust?.allocations[0].deficitCount).toBe(3)
    expect(exhaust?.allocations[0].surplusCount).toBe(1)
  })

  it('sequentially attributes interchangeable exhaust recipes to one deficit slot', () => {
    const drops = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1 }],
    )
    const recipes: EventCraftRecipe[] = [
      {
        ...sampleRecipes[0],
        id: 'recipe-x',
        costs: { seafood: 20, meat: 0, vegetable: 0 },
        yields: { 'item-a': 0.5 },
      },
      {
        ...sampleRecipes[0],
        id: 'recipe-y',
        costs: { seafood: 0, meat: 20, vegetable: 0 },
        yields: { 'item-a': 0.5 },
      },
    ]
    const plan = computeEventCraftPlan(
      drops,
      { 'item-a': 1 },
      { seafood: 40, meat: 40, vegetable: 0 },
      ['Q1'],
      { recipes },
    )
    const exhaust = plan.patterns.find(
      (pattern) => pattern.id === 'exhaust',
    )
    expect(exhaust?.totalCrafted).toBe(4)
    expect(exhaust?.totalDeficitCrafted).toBe(2)
    expect(exhaust?.totalSurplusCrafted).toBe(2)
  })

  it('scores exhaust deficit from residual farming LP, not isolated item values', () => {
    const drops = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Q1', 20)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1 },
        { quest_id: 'Q1', item_id: 'item-b', drop_rate: 1 },
      ],
    )
    const plan = computeEventCraftPlan(
      drops,
      { 'item-a': 10, 'item-b': 2 },
      { seafood: 100, meat: 0, vegetable: 50 },
      ['Q1'],
      {
        recipes: [
          sampleRecipes[0],
          {
            ...sampleRecipes[1],
            targetItem: { ...sampleRecipes[1].targetItem, rarity: 'silver' },
          },
        ],
      },
    )
    const exhaust = plan.patterns.find((pattern) => pattern.id === 'exhaust')
    const allocB = exhaust?.allocations.find(
      (allocation) => allocation.recipe.id === 'recipe-b',
    )
    expect(allocB?.deficitSaved ?? 1).toBe(0)
  })
})

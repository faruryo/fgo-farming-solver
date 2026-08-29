import { describe, it, expect } from 'vitest'
import {
  solveEventCraftAllocation,
  generateCraftAdvice,
} from './event-craft-advisor'
import { EventCraftRecipe, IngredientCounts } from '../data/event-craft-recipes'
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
    yieldCount: 1,
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
    yieldCount: 1,
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
    yieldCount: 1,
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
    yieldCount: 1,
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

    const fullNeed = { 'item-a': 2, 'item-b': 1 }
    // 食材: recipe-a を1回(meat 20, veg 40) + recipe-b を1回(seafood 40, veg 20) 作成可能
    const owned: IngredientCounts = { seafood: 40, meat: 20, vegetable: 60 }

    const res = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1', 'Q2'],
      {
        exhaustIngredients: false,
        recipes: sampleRecipes,
      },
    )

    expect(res.totalCrafted).toBe(2)
    expect(res.totalDeficitCrafted).toBe(2)
    expect(res.totalSurplusCrafted).toBe(0)

    const allocA = res.allocations.find((a) => a.recipe.id === 'recipe-a')
    const allocB = res.allocations.find((a) => a.recipe.id === 'recipe-b')
    expect(allocA?.deficitCount).toBe(1)
    expect(allocB?.deficitCount).toBe(1)

    // baseline: Q1×2 (2周) + Q2×2 (2/0.5 = 2周) = 4周
    // post-craft remaining need: item-a: 1, item-b: 0 -> Q1×1 (1周) + Q2×0 = 1周
    // totalSaved: 3周
    expect(res.baselineCost).toBeCloseTo(4)
    expect(res.optimalCost).toBeCloseTo(1)
    expect(res.totalSaved).toBeCloseTo(3)
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
      recipes: sampleRecipes,
    })

    const allocB = res.allocations.find((a) => a.recipe.id === 'recipe-b')
    // recipe-b は周回削減に寄与しないため、消費食材最小化により 0 個となる
    expect(allocB?.deficitCount).toBe(0)
  })

  it('不足上限（deficiency cap）を超えて不足枠を作成しない', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )

    const fullNeed = { 'item-a': 2 }
    // 大量の食材があっても不足数 2 を超えて不足枠を作成しない
    const owned: IngredientCounts = { seafood: 0, meat: 200, vegetable: 400 }

    const resOff = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1'],
      {
        exhaustIngredients: false,
        recipes: sampleRecipes,
      },
    )
    const allocAOff = resOff.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(allocAOff?.deficitCount).toBe(2)
    expect(allocAOff?.surplusCount).toBe(0)
    expect(resOff.totalCrafted).toBe(2)

    // 使い切り ON の場合、余った食材で余剰枠が作成される
    const resOn = solveEventCraftAllocation(
      d,
      fullNeed,
      owned,
      'turn',
      ['Q1'],
      {
        exhaustIngredients: true,
        recipes: sampleRecipes,
      },
    )
    const allocAOn = resOn.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(allocAOn?.deficitCount).toBe(2)
    expect(allocAOn?.surplusCount).toBe(8) // (meat 200-40=160, veg 400-80=320) -> 8個追加作成可能
    expect(resOn.totalCrafted).toBe(10)
  })

  it('不足が 0 でも「食材を使い切る」が ON なら単体価値最大で作成する (Stage 2)', () => {
    // Q1: item-a (AP 20), Q2: item-b (AP 40)
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Q1', 20), makeQuest('Q2', 40)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
        { quest_id: 'Q2', item_id: 'item-b', drop_rate: 1.0 },
      ],
    )

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
    expect(resOn.totalSurplusValue).toBeCloseTo(80) // AP 40 × 2
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
    const owned: IngredientCounts = { seafood: 0, meat: 20, vegetable: 40 }
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

  it('カスタム翻訳関数を渡した場合は翻訳されたアドバイスを返す', () => {
    const d = buildTestDrops([], [], [])
    const owned: IngredientCounts = { seafood: 0, meat: 0, vegetable: 0 }
    const res = solveEventCraftAllocation(d, {}, owned, 'ap', [])
    const mockT = (key: string) => (key === 'event-craft-advice-prompt' ? 'English prompt message' : key)
    const advice = generateCraftAdvice(res, owned, 'ap', false, mockT)
    expect(advice).toBe('English prompt message')
  })
})

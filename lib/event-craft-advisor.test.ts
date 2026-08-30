import { describe, it, expect } from 'vitest'
import {
  computeEventCraftPlan,
  foldEventCraftPatterns,
  resolveVisiblePatternId,
  generateCraftAdvice,
  computeSingleItemBaseValues,
  EventCraftPatternResult,
} from './event-craft-advisor'
import { EventCraftRecipe, IngredientCounts, EVENT_CRAFT_FEATURED_YIELD } from '../data/event-craft-recipes'
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

const findPattern = (
  plan: ReturnType<typeof computeEventCraftPlan>,
  id: string,
) => plan.patterns.find((p) => p.id === id)

/** テスト専用: 見つからなければ例外にする(non-null assertion を使わないため)。 */
const getPattern = (plan: ReturnType<typeof computeEventCraftPlan>, id: string) => {
  const found = findPattern(plan, id)
  if (!found) throw new Error(`pattern not found: ${id}`)
  return found
}

/** テスト専用: 見つからなければ例外にする(non-null assertion を使わないため)。 */
const getAlloc = (pattern: EventCraftPatternResult, recipeId: string) => {
  const found = pattern.allocations.find((a) => a.recipe.id === recipeId)
  if (!found) throw new Error(`allocation not found: ${recipeId}`)
  return found
}

/** テスト専用: 見つからなければ例外にする(non-null assertion を使わないため)。 */
const mustFind = <T,>(items: readonly T[], predicate: (item: T) => boolean, label: string): T => {
  const found = items.find(predicate)
  if (!found) throw new Error(`not found: ${label}`)
  return found
}

/**
 * item-x: turnでは安い(rate1.0)がAPは高い(Qx ap=100)。item-y: turnは高い(rate0.1)がAPは安い(換算20/個)。
 * 手持ちは1皿分のみ。turn最小化とAP最小化で選ぶ皿が分かれる、runs/ap と even-turn/even-ap 双方のテストで使う。
 */
const buildTurnApDivergingFixture = () => {
  const d = buildTestDrops(
    [makeItem('item-x', 101), makeItem('item-y', 102)],
    [makeQuest('Qx', 100), makeQuest('Qy', 2)],
    [
      { quest_id: 'Qx', item_id: 'item-x', drop_rate: 1.0 },
      { quest_id: 'Qy', item_id: 'item-y', drop_rate: 0.1 },
    ],
  )
  const recipes: EventCraftRecipe[] = [
    {
      id: 'recipe-x', name: '料理X', costs: { seafood: 20, meat: 0, vegetable: 0 },
      targetItem: { atlasId: 1, shortId: 'item-x', name: '素材X', rarity: 'bronze' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
    },
    {
      id: 'recipe-y', name: '料理Y', costs: { seafood: 20, meat: 0, vegetable: 0 },
      targetItem: { atlasId: 2, shortId: 'item-y', name: '素材Y', rarity: 'gold' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
    },
  ]
  const owned: IngredientCounts = { seafood: 20, meat: 0, vegetable: 0 }
  const fullNeed = { 'item-x': 2, 'item-y': 2 }
  return { d, recipes, owned, fullNeed }
}

describe('computeEventCraftPlan: runs / ap パターン', () => {
  it('不足素材に対して周回削減効果のある料理を最適に作成する (runs)', () => {
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

    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Q1', 'Q2'], {
      recipes: sampleRecipes.slice(0, 2),
    })
    const runs = getPattern(plan, 'runs')

    expect(runs.totalCrafted).toBe(4)
    expect(runs.totalDeficitCrafted).toBe(4)
    expect(runs.totalSurplusCrafted).toBe(0)

    const allocA = runs.allocations.find((a) => a.recipe.id === 'recipe-a')
    const allocB = runs.allocations.find((a) => a.recipe.id === 'recipe-b')
    expect(allocA?.deficitCount).toBe(2)
    expect(allocB?.deficitCount).toBe(2)

    // baseline: Q1×1 + Q2×2 (1/0.5) = 3周
    expect(runs.baselineTurnCost).toBeCloseTo(3)
    expect(runs.residualTurnCost).toBeCloseTo(0)
    expect(runs.totalSaved).toBeCloseTo(3)
  })

  it('周回コストが変わらないついでドロップ素材は不足枠でも作成しない (タイブレーク)', () => {
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

    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Q1'], {
      recipes: [
        sampleRecipes[0],
        {
          ...sampleRecipes[1],
          targetItem: { ...sampleRecipes[1].targetItem, rarity: 'silver' },
        },
      ],
    })
    const runs = getPattern(plan, 'runs')
    const allocB = runs.allocations.find((a) => a.recipe.id === 'recipe-b')
    expect(allocB?.deficitCount).toBe(0)
  })

  it('AP モードは AP を目的関数として最小化し、周回モードとは異なる皿を選び得る', () => {
    const { d, recipes, owned, fullNeed } = buildTurnApDivergingFixture()
    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Qx', 'Qy'], { recipes })
    const runs = getPattern(plan, 'runs')
    const ap = getPattern(plan, 'ap')
    expect(ap.metric).toBe('ap')
    // turn(周回)最小化は item-y (turn単価が高い) を優先、AP最小化は item-x (AP単価が高い) を優先し皿が分かれる。
    expect(runs.allocations.find((a) => a.recipe.id === 'recipe-y')?.totalCount).toBe(1)
    expect(runs.allocations.find((a) => a.recipe.id === 'recipe-x')?.totalCount).toBe(0)
    expect(ap.allocations.find((a) => a.recipe.id === 'recipe-x')?.totalCount).toBe(1)
    expect(ap.allocations.find((a) => a.recipe.id === 'recipe-y')?.totalCount).toBe(0)
  })
})

describe('computeEventCraftPlan: 満遍なく（周回/AP）', () => {
  it('fullNeed に含まれるレシピ無関係の不足に単独負担のmaxを支配させない', () => {
    // item-unrelated はどのレシピも生産できない、イベント無関係の不足(ユーザーの全体不足に含まれるだけ)。
    // 単独周回コストが極端に重い(rate 0.001 -> 1000周/個 × 残り1000個 = 単独負担100万)。
    // これを満遍なくの対象に含めると、絶対に下げられない巨大な負担がmaxを支配し、
    // クラフト側のtie-break(食材最小化)が「どうせmaxは変わらないから作らない」を選んでしまう。
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-unrelated', 999)],
      [makeQuest('Q1', 20), makeQuest('Q2', 20)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
        { quest_id: 'Q2', item_id: 'item-unrelated', drop_rate: 0.001 },
      ],
    )
    const recipes: EventCraftRecipe[] = [
      {
        id: 'recipe-a', name: '料理A', costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: { atlasId: 1, shortId: 'item-a', name: '素材A', rarity: 'bronze' },
        yieldCount: EVENT_CRAFT_FEATURED_YIELD,
      },
    ]
    const fullNeed = { 'item-a': 5, 'item-unrelated': 1000 }
    const owned: IngredientCounts = { seafood: 100, meat: 0, vegetable: 0 }

    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Q1', 'Q2'], { recipes })
    const evenTurn = findPattern(plan, 'even-turn')
    const target = evenTurn ?? getPattern(plan, 'runs')
    const allocA = target.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(allocA?.totalCount).toBeGreaterThan(0)
  })

  it('金の単独負担が高いと銅の個数より金料理が選ばれ、周回案とは異なる配分になる', () => {
    // 銅(item-bronze)は残り20個・単独1周/個。金(item-gold)は残り2個・単独20周/個(rate0.05)。
    // 消費食材を共有する8皿分の予算しかない。総削減(sum)最小化の runs は金を先に使い切ってから銅に回すが、
    // 最大負担(max)最小化の even-turn はより多くを銅に回して両者の負担を均す。
    const d = buildTestDrops(
      [makeItem('item-bronze', 101), makeItem('item-gold', 102)],
      [makeQuest('Qbronze', 20), makeQuest('Qgold', 20)],
      [
        { quest_id: 'Qbronze', item_id: 'item-bronze', drop_rate: 1.0 },
        { quest_id: 'Qgold', item_id: 'item-gold', drop_rate: 0.05 },
      ],
    )
    const recipes: EventCraftRecipe[] = [
      {
        id: 'recipe-bronze', name: '銅料理', costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: { atlasId: 1, shortId: 'item-bronze', name: '銅素材', rarity: 'bronze' },
        yieldCount: EVENT_CRAFT_FEATURED_YIELD,
      },
      {
        id: 'recipe-gold', name: '金料理', costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: { atlasId: 2, shortId: 'item-gold', name: '金素材', rarity: 'gold' },
        yieldCount: EVENT_CRAFT_FEATURED_YIELD,
      },
    ]
    const fullNeed = { 'item-bronze': 20, 'item-gold': 2 }
    const owned: IngredientCounts = { seafood: 160, meat: 0, vegetable: 0 }

    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Qbronze', 'Qgold'], { recipes })
    const runs = getPattern(plan, 'runs')
    const evenTurn = getPattern(plan, 'even-turn')
    expect(evenTurn).toBeDefined()

    expect(runs.allocations.find((a) => a.recipe.id === 'recipe-bronze')?.totalCount).toBe(3)
    expect(runs.allocations.find((a) => a.recipe.id === 'recipe-gold')?.totalCount).toBe(5)

    expect(evenTurn.allocations.find((a) => a.recipe.id === 'recipe-bronze')?.totalCount).toBe(5)
    expect(evenTurn.allocations.find((a) => a.recipe.id === 'recipe-gold')?.totalCount).toBe(3)

    // 表示される削減量も合計コストLPではなく満遍なく自身の目的(単独負担)基準になっている。
    // 単独負担は max(残り銅18×1, 残り金0.8×20)=18。銅をゼロにすると20(=+2)、金をゼロにすると40(=+22)。
    const bronzeAlloc = getAlloc(evenTurn, 'recipe-bronze')
    const goldAlloc = getAlloc(evenTurn, 'recipe-gold')
    expect(bronzeAlloc.deficitSaved).toBeCloseTo(2)
    expect(goldAlloc.deficitSaved).toBeCloseTo(22)

    // カード合計(totalSaved)も単独負担基準になっている: 未クラフト時のmax(20,40)=40 から
    // 実際の18まで下がった差=22。マシュのアドバイスも「単独負担の山」の文言・非ゼロの数値を使う。
    expect(evenTurn.totalSaved).toBeCloseTo(22)
    const advice = generateCraftAdvice(evenTurn, owned)
    expect(advice).toContain('単独負担の山を約 22 周回 下げられます')
    expect(advice).not.toContain('フリクエ周回から合計')
  })

  it('周回案では0のついで枠でも単独負担の山としては残っていれば even-turn は作成し得る', () => {
    // sum(=周回総数)最小化の runs は割高な item-b の需要をすべて recipe-b に寄せ、recipe-a は0のまま。
    // max負担最小化の even-turn は item-a の残り負担が支配的になるため recipe-a を作成する。
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Qa', 20), makeQuest('Qb', 20)],
      [
        { quest_id: 'Qa', item_id: 'item-a', drop_rate: 1.0 },
        { quest_id: 'Qb', item_id: 'item-b', drop_rate: 0.05 },
      ],
    )
    const recipes: EventCraftRecipe[] = [
      {
        id: 'recipe-a', name: '料理A', costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: { atlasId: 1, shortId: 'item-a', name: '素材A', rarity: 'bronze' },
        yieldCount: EVENT_CRAFT_FEATURED_YIELD,
      },
      {
        id: 'recipe-b', name: '料理B', costs: { seafood: 20, meat: 0, vegetable: 0 },
        targetItem: { atlasId: 2, shortId: 'item-b', name: '素材B', rarity: 'bronze' },
        yieldCount: EVENT_CRAFT_FEATURED_YIELD,
      },
    ]
    const fullNeed = { 'item-a': 20, 'item-b': 3 }
    const owned: IngredientCounts = { seafood: 160, meat: 0, vegetable: 0 }

    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Qa', 'Qb'], { recipes })
    const runsAlloc = getPattern(plan, 'runs').allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(runsAlloc?.totalCount).toBe(0)

    const evenTurn = getPattern(plan, 'even-turn')
    const evenAAlloc = evenTurn.allocations.find((a) => a.recipe.id === 'recipe-a')
    expect(evenAAlloc?.totalCount).toBeGreaterThanOrEqual(1)
  })

  it('even-turn と even-ap は単位が異なるため皿が分かれ得る', () => {
    // even-turn は item-y(turn単価が高い)、even-ap は item-x(AP単価が高い)を選ぶはず。
    const { d, recipes, owned, fullNeed } = buildTurnApDivergingFixture()
    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Qx', 'Qy'], { recipes })
    // このケースでは even-turn は runs と、even-ap は ap と同一配分になり畳まれる。
    expect(plan.absorbedInto['even-turn']).toBe('runs')
    expect(plan.absorbedInto['even-ap']).toBe('ap')
    const runs = getPattern(plan, 'runs')
    const ap = getPattern(plan, 'ap')
    expect(runs.allocations.find((a) => a.recipe.id === 'recipe-y')?.totalCount).toBe(1)
    expect(ap.allocations.find((a) => a.recipe.id === 'recipe-x')?.totalCount).toBe(1)
  })
})

describe('computeEventCraftPlan: 食材を使い切る', () => {
  it('不足が 0 でも食材があれば単体価値最大で作成する', () => {
    const d = buildTwoQuestDrops()
    const owned: IngredientCounts = { seafood: 80, meat: 0, vegetable: 40 }
    const plan = computeEventCraftPlan(d, {}, owned, ['Q1', 'Q2'], { recipes: sampleRecipes })
    const exhaust = getPattern(plan, 'exhaust')
    expect(exhaust.totalCrafted).toBe(2)
    expect(exhaust.totalSurplusCrafted).toBe(2)
    expect(exhaust.totalSaved).toBe(0)
    // exhaust の獲得価値は周回換算(単位: 周)。item-b 単独周回1 × 0.4 + item-a 単独周回1 × 0.15 = 0.55、×2皿
    expect(exhaust.totalSurplusValue).toBeCloseTo(1.1)
  })

  it('代替可能な2レシピが同じ不足を独立に満たせる場合、両方を余剰にせず片方へ帰属させる', () => {
    // recipe-x と recipe-y はどちらも item-a を 0.5/個 生産する代替レシピ。
    // 食材予算はそれぞれ独立に2個ずつしか作れない上限で、使い切りは両方を2個ずつ作る。
    // 「他方を元の個数のまま」独立にゼロ化すると、片方だけで需要(1)を満たせるため両方とも
    // 余剰と誤判定されてしまう(実際は両方ゼロにすると不足が復活する)。
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const recipeX: EventCraftRecipe = {
      id: 'recipe-x',
      name: '料理X',
      costs: { seafood: 20, meat: 0, vegetable: 0 },
      targetItem: { atlasId: 1, shortId: 'item-a', name: '素材A', rarity: 'bronze' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
      yields: { 'item-a': 0.5 },
    }
    const recipeY: EventCraftRecipe = {
      id: 'recipe-y',
      name: '料理Y',
      costs: { seafood: 0, meat: 20, vegetable: 0 },
      targetItem: { atlasId: 2, shortId: 'item-a', name: '素材A', rarity: 'bronze' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
      yields: { 'item-a': 0.5 },
    }
    const owned: IngredientCounts = { seafood: 40, meat: 40, vegetable: 0 }
    const plan = computeEventCraftPlan(d, { 'item-a': 1 }, owned, ['Q1'], {
      recipes: [recipeX, recipeY],
    })
    const exhaust = getPattern(plan, 'exhaust')
    const allocX = getAlloc(exhaust, 'recipe-x')
    const allocY = getAlloc(exhaust, 'recipe-y')
    expect(allocX.totalCount).toBe(2)
    expect(allocY.totalCount).toBe(2)
    // 合計の不足枠は両方0にはならず、どちらか一方に needed 分(2個)がまとまって帰属する。
    const totalDeficit = allocX.deficitCount + allocY.deficitCount
    expect(totalDeficit).toBe(2)
    expect(allocX.deficitCount === 2 || allocY.deficitCount === 2).toBe(true)
  })

  it('同一レシピ内で不足充足に効く分と純粋な余剰分が混在する場合、皿単位で分割する', () => {
    // 1皿あたり期待0.4、必要1個 → 3皿で充足(0.4*3=1.2>=1)。食材は4皿分あるので4皿目は純粋な余剰。
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const owned: IngredientCounts = { seafood: 0, meat: 80, vegetable: 160 }
    const plan = computeEventCraftPlan(d, { 'item-a': 1 }, owned, ['Q1'], {
      recipes: sampleRecipes.slice(0, 1),
    })
    const exhaust = getPattern(plan, 'exhaust')
    const alloc = getAlloc(exhaust, 'recipe-a')
    expect(alloc.totalCount).toBe(4)
    expect(alloc.deficitCount).toBe(3)
    expect(alloc.surplusCount).toBe(1)
  })

  it('周回案と正の皿が同じでも exhaust は畳まない', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const fullNeed = { 'item-a': 1 }
    // ちょうど1皿分しか作れない食材量: runs と exhaust の正の皿は同一(recipe-a×3)になる
    const owned: IngredientCounts = { seafood: 0, meat: 60, vegetable: 120 }
    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Q1'], {
      recipes: sampleRecipes.slice(0, 1),
    })
    const runs = getPattern(plan, 'runs')
    const exhaust = getPattern(plan, 'exhaust')
    expect(exhaust).toBeDefined()
    expect(runs.allocations[0].totalCount).toBe(exhaust.allocations[0].totalCount)
    // 両方表示されている(exhaust は畳まれていない)
    expect(plan.patterns.map((p) => p.id)).toContain('exhaust')
    expect(plan.patterns.map((p) => p.id)).toContain('runs')
  })

  it('余りが周回案より少なくなるケースで残余周回コストが評価に載る', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const fullNeed = { 'item-a': 1 }
    const owned: IngredientCounts = { seafood: 0, meat: 200, vegetable: 400 }
    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Q1'], {
      recipes: sampleRecipes.slice(0, 1),
    })
    const exhaust = getPattern(plan, 'exhaust')
    expect(exhaust.leftoverIngredients.meat).toBe(0)
    expect(exhaust.leftoverIngredients.vegetable).toBe(0)
    expect(exhaust.residualTurnCost).toBeGreaterThanOrEqual(0)
    expect(exhaust.residualApCost).toBeGreaterThanOrEqual(0)
  })

  it('料理Aのみで不足充足・料理Bのみで残余周回コストを下げる使い切りは、Bを不足枠として扱う', () => {
    // item-a, item-b は同じクエストから同率でドロップ。fullNeed は item-a のみ大きい不足。
    // owned ingredients により、exhaust は recipe-a と recipe-b の両方を作る。
    // recipe-b をゼロにしても item-b は item-a 収集のついでで賄われず、残余コストが増えるなら不足枠。
    const d = buildTestDrops(
      [makeItem('item-a', 101), makeItem('item-b', 102)],
      [makeQuest('Q1', 20), makeQuest('Q2', 20)],
      [
        { quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 },
        { quest_id: 'Q2', item_id: 'item-b', drop_rate: 1.0 },
      ],
    )
    const recipeA: EventCraftRecipe = {
      id: 'recipe-a',
      name: '料理A',
      costs: { seafood: 20, meat: 0, vegetable: 0 },
      targetItem: { atlasId: 1, shortId: 'item-a', name: '素材A', rarity: 'bronze' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
    }
    const recipeB: EventCraftRecipe = {
      id: 'recipe-b',
      name: '料理B',
      costs: { seafood: 0, meat: 20, vegetable: 0 },
      targetItem: { atlasId: 2, shortId: 'item-b', name: '素材B', rarity: 'silver' },
      yieldCount: EVENT_CRAFT_FEATURED_YIELD,
    }
    const fullNeed = { 'item-a': 3, 'item-b': 3 }
    const owned: IngredientCounts = { seafood: 60, meat: 60, vegetable: 0 }

    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Q1', 'Q2'], {
      recipes: [recipeA, recipeB],
    })
    const exhaust = getPattern(plan, 'exhaust')
    const allocB = exhaust.allocations.find((a) => a.recipe.id === 'recipe-b')
    expect(allocB?.totalCount).toBeGreaterThan(0)
    // B は Q2 の不足充足に効くため不足枠(deficit)として扱われ、余剰(surplus)にはならない
    expect(allocB?.deficitCount).toBeGreaterThan(0)
    expect(allocB?.surplusCount).toBe(0)
  })
})

const PATTERN_METRIC_FOR_TEST: Record<EventCraftPatternResult['id'], EventCraftPatternResult['metric']> = {
  runs: 'turn',
  ap: 'ap',
  'even-turn': 'turn',
  'even-ap': 'ap',
  exhaust: 'both',
}

describe('foldEventCraftPatterns', () => {
  const mkPattern = (
    id: EventCraftPatternResult['id'],
    dishes: { recipeId: string; count: number }[],
  ): EventCraftPatternResult => ({
    id,
    metric: Reflect.get(PATTERN_METRIC_FOR_TEST, id),
    allocations: dishes.map(({ recipeId, count }) => ({
      recipe: sampleRecipes.find((r) => r.id === recipeId) ?? sampleRecipes[0],
      deficitCount: count,
      surplusCount: 0,
      totalCount: count,
      unitSaved: 0,
      deficitSaved: 0,
      surplusValue: 0,
      spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
    })),
    totalCrafted: dishes.reduce((s, d) => s + d.count, 0),
    totalDeficitCrafted: dishes.reduce((s, d) => s + d.count, 0),
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

  it('even-turn が ap と一致して runs と異なるとき、even-turn は ap へ畳まれる', () => {
    const runs = mkPattern('runs', [{ recipeId: 'recipe-a', count: 2 }])
    const ap = mkPattern('ap', [{ recipeId: 'recipe-b', count: 3 }])
    const evenTurn = mkPattern('even-turn', [{ recipeId: 'recipe-b', count: 3 }])
    const evenAp = mkPattern('even-ap', [{ recipeId: 'recipe-c', count: 1 }])
    const exhaust = mkPattern('exhaust', [{ recipeId: 'recipe-a', count: 2 }])

    const result = foldEventCraftPatterns([runs, ap, evenTurn, evenAp, exhaust])
    const ids = result.patterns.map((p) => p.id)
    expect(ids).toEqual(['runs', 'ap', 'even-ap', 'exhaust'])
    expect(result.absorbedInto['even-turn']).toBe('ap')
    const apPattern = mustFind(result.patterns, (p) => p.id === 'ap', 'ap')
    expect(apPattern.aliasOf).toEqual(['even-turn'])
  })

  it('even-ap が even-turn と一致するとき even-ap へ畳まれる', () => {
    const runs = mkPattern('runs', [{ recipeId: 'recipe-a', count: 2 }])
    const ap = mkPattern('ap', [{ recipeId: 'recipe-b', count: 3 }])
    const evenTurn = mkPattern('even-turn', [{ recipeId: 'recipe-c', count: 1 }])
    const evenAp = mkPattern('even-ap', [{ recipeId: 'recipe-c', count: 1 }])
    const exhaust = mkPattern('exhaust', [{ recipeId: 'recipe-a', count: 2 }])

    const result = foldEventCraftPatterns([runs, ap, evenTurn, evenAp, exhaust])
    const ids = result.patterns.map((p) => p.id)
    expect(ids).toEqual(['runs', 'ap', 'even-turn', 'exhaust'])
    expect(result.absorbedInto['even-ap']).toBe('even-turn')
  })

  it('exhaust は正の皿が runs と同じでも常に表示され、他へ畳まれない', () => {
    const runs = mkPattern('runs', [{ recipeId: 'recipe-a', count: 2 }])
    const ap = mkPattern('ap', [{ recipeId: 'recipe-a', count: 2 }])
    const evenTurn = mkPattern('even-turn', [{ recipeId: 'recipe-a', count: 2 }])
    const evenAp = mkPattern('even-ap', [{ recipeId: 'recipe-a', count: 2 }])
    const exhaust = mkPattern('exhaust', [{ recipeId: 'recipe-a', count: 2 }])

    const result = foldEventCraftPatterns([runs, ap, evenTurn, evenAp, exhaust])
    expect(result.patterns.map((p) => p.id)).toEqual(['runs', 'exhaust'])
    const runsPattern = mustFind(result.patterns, (p) => p.id === 'runs', 'runs')
    expect(runsPattern.aliasOf).toEqual(['ap', 'even-turn', 'even-ap'])
  })

  it('resolveVisiblePatternId は非表示IDを吸収先へ解決する', () => {
    const runs = mkPattern('runs', [{ recipeId: 'recipe-a', count: 2 }])
    const ap = mkPattern('ap', [{ recipeId: 'recipe-a', count: 2 }])
    const exhaust = mkPattern('exhaust', [{ recipeId: 'recipe-a', count: 2 }])
    const result = foldEventCraftPatterns([runs, ap, exhaust])
    expect(resolveVisiblePatternId(result, 'ap')).toBe('runs')
    expect(resolveVisiblePatternId(result, 'runs')).toBe('runs')
    expect(resolveVisiblePatternId(result, 'even-turn')).toBe('runs')
  })
})

describe('computeEventCraftPlan: 期待値yieldは全パターン共通', () => {
  it('even パターンも主産物1個だけに戻さず期待バスケットを使う', () => {
    const d = buildTwoItemSharedDrops()
    const recipeA: EventCraftRecipe = {
      ...sampleRecipes[0],
      costs: { seafood: 20, meat: 0, vegetable: 0 },
    }
    const recipeB: EventCraftRecipe = {
      ...sampleRecipes[1],
      costs: { seafood: 0, meat: 20, vegetable: 0 },
    }
    const fullNeed = { 'item-a': 5 }
    const owned: IngredientCounts = { seafood: 1000, meat: 0, vegetable: 0 }
    const plan = computeEventCraftPlan(d, fullNeed, owned, ['Q1'], {
      recipes: [recipeA, recipeB],
    })
    const evenTurn = findPattern(plan, 'even-turn')
    const runs = getPattern(plan, 'runs')
    const target = evenTurn ?? runs
    const allocA = target.allocations.find((a) => a.recipe.id === 'recipe-a')
    // 期待値バスケット(0.4)を使うなら 5/0.4=12.5→13皿。主産物1個だけなら5皿になってしまう。
    expect(allocA?.totalCount).toBeGreaterThan(5)
  })
})

describe('generateCraftAdvice', () => {
  it('食材が未入力の場合は入力を促すセリフを返す', () => {
    const d = buildTestDrops([], [], [])
    const owned: IngredientCounts = { seafood: 0, meat: 0, vegetable: 0 }
    const plan = computeEventCraftPlan(d, {}, owned, [])
    const runs = getPattern(plan, 'runs')
    const advice = generateCraftAdvice(runs, owned)
    expect(advice).toContain('お持ちのイベント食材数')
  })

  it('削減効果がある場合は最優先料理と削減量を案内する', () => {
    const owned: IngredientCounts = { seafood: 0, meat: 60, vegetable: 120 }
    const recipeA = sampleRecipes[0]
    const ap: EventCraftPatternResult = {
      id: 'ap',
      metric: 'ap',
      allocations: [
        {
          recipe: recipeA,
          deficitCount: 3,
          surplusCount: 0,
          totalCount: 3,
          unitSaved: 20 / 3,
          deficitSaved: 20,
          surplusValue: 0,
          spentIngredients: { seafood: 0, meat: 60, vegetable: 120 },
        },
      ],
      totalCrafted: 3,
      totalDeficitCrafted: 3,
      totalSurplusCrafted: 0,
      totalSaved: 20,
      totalSurplusValue: 0,
      spentIngredients: { seafood: 0, meat: 60, vegetable: 120 },
      leftoverIngredients: { seafood: 0, meat: 0, vegetable: 0 },
      residualTurnCost: 0,
      residualApCost: 0,
      baselineTurnCost: 1,
      baselineApCost: 20,
    }
    const advice = generateCraftAdvice(ap, owned)
    expect(advice).toContain('最優先は「料理A（素材A）」です')
    expect(advice).toContain('AP を削減できます')
  })

  it('食材はあるが作成による削減効果がない場合は削減効果なしのアドバイスを返す', () => {
    const owned: IngredientCounts = { seafood: 40, meat: 0, vegetable: 20 }
    const recipeB = sampleRecipes[1]
    const ap: EventCraftPatternResult = {
      id: 'ap',
      metric: 'ap',
      allocations: [
        {
          recipe: recipeB,
          deficitCount: 0,
          surplusCount: 0,
          totalCount: 0,
          unitSaved: 0,
          deficitSaved: 0,
          surplusValue: 0,
          spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
        },
      ],
      totalCrafted: 0,
      totalDeficitCrafted: 0,
      totalSurplusCrafted: 0,
      totalSaved: 0,
      totalSurplusValue: 0,
      spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
      leftoverIngredients: { seafood: 40, meat: 0, vegetable: 20 },
      residualTurnCost: 20,
      residualApCost: 800,
      baselineTurnCost: 20,
      baselineApCost: 800,
    }
    const advice = generateCraftAdvice(ap, owned)
    expect(advice).toContain('周回削減効果がありません')
  })

  it('カスタム翻訳関数を渡した場合は翻訳されたアドバイスを返す', () => {
    const d = buildTestDrops([], [], [])
    const owned: IngredientCounts = { seafood: 0, meat: 0, vegetable: 0 }
    const plan = computeEventCraftPlan(d, {}, owned, [])
    const runs = getPattern(plan, 'runs')
    const mockT = (key: string) => (key === 'event-craft-advice-prompt' ? 'English prompt message' : key)
    const advice = generateCraftAdvice(runs, owned, mockT)
    expect(advice).toBe('English prompt message')
  })
})

describe('computeSingleItemBaseValues (キャッシュ)', () => {
  it('dropsオブジェクトが更新された場合はキャッシュを共有せず最新のドロップデータで再計算する', () => {
    const d1 = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const d2 = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 10)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const val1 = computeSingleItemBaseValues(d1, ['Q1'], 'ap', { recipes: sampleRecipes })
    const val2 = computeSingleItemBaseValues(d2, ['Q1'], 'ap', { recipes: sampleRecipes })
    expect(val1.get('recipe-a')).toBeCloseTo(8)
    expect(val2.get('recipe-a')).toBeCloseTo(4)
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
})

describe('ドロップデータのない素材', () => {
  it('infeasible 回避のため除外される', () => {
    const d = buildTestDrops(
      [makeItem('item-a', 101)],
      [makeQuest('Q1', 20)],
      [{ quest_id: 'Q1', item_id: 'item-a', drop_rate: 1.0 }],
    )
    const owned: IngredientCounts = { seafood: 50, meat: 50, vegetable: 50 }
    const plan = computeEventCraftPlan(d, { 'nodrop-item': 5 }, owned, ['Q1'], {
      recipes: sampleRecipes,
    })
    const runs = getPattern(plan, 'runs')
    expect(Number.isFinite(runs.residualTurnCost)).toBe(true)
    expect(runs.totalCrafted).toBe(0)
  })
})

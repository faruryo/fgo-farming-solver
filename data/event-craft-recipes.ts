/**
 * FGO 水着2026「カルデア南海大決戦！ ～マジムンアイランドに謎の巨人の影を見た～」
 * 料理作成システム（ゲーム内公開イベント仕様）のマスタデータ定義。
 *
 * 1皿の期待獲得はゲーム内の報酬枠から導出する（第三者の生カウント表は転載しない）。
 * 期待値高 1 枠 + 同レア残り + QP/種火。均等分割の丸めは copper/silver 他 0.15、金他 0.12。
 * 検証の参照（リンクのみ）:
 * https://appmedia.jp/fategrandorder/76010486 （お茶）
 * https://appmedia.jp/fategrandorder/80305168 （水着2026）
 */

export const EVENT_CRAFT_FEATURED_YIELD = 0.4

/** 銅: 素材4+QP、銀: 素材4+種火、金: 素材4+種火+QP */
const REWARD_SLOT_COUNT: Record<RecipeMaterialRarity, number> = {
  bronze: 5,
  silver: 5,
  gold: 6,
}

export type IngredientType = 'seafood' | 'meat' | 'vegetable'

export type IngredientCounts = Record<IngredientType, number>

export type RecipeMaterialRarity = 'bronze' | 'silver' | 'gold'

export type EventCraftRecipe = {
  /** レシピの一意識別子 */
  id: string
  /** 料理名 */
  name: string
  /** 必要食材（海鮮・お肉・野菜） */
  costs: IngredientCounts
  /** 作成で獲得できる素材情報（ゲーム内公開仕様・期待値高） */
  targetItem: {
    atlasId: number
    shortId: string
    name: string
    rarity: RecipeMaterialRarity
  }
  /** 1回作成あたりの期待高素材の期待個数（他同レアは getRecipeYields） */
  yieldCount: number
  /** テスト用。指定時は帯からの導出を上書きする */
  yields?: Record<string, number>
}

export const otherMaterialYield = (rarity: RecipeMaterialRarity): number =>
  (1 - EVENT_CRAFT_FEATURED_YIELD) / (REWARD_SLOT_COUNT[rarity] - 1)

/** 1皿の育成素材 shortId → 期待個数。QP/種火枠は 0 のため含めない。 */
export const getRecipeYields = (
  recipe: EventCraftRecipe,
  recipes: readonly EventCraftRecipe[] = EVENT_CRAFT_RECIPES_2026,
): Record<string, number> => {
  if (recipe.yields) return { ...recipe.yields }
  const other = otherMaterialYield(recipe.targetItem.rarity)
  const yields: Record<string, number> = {}
  for (const peer of recipes) {
    if (peer.targetItem.rarity !== recipe.targetItem.rarity) continue
    yields[peer.targetItem.shortId] =
      peer.id === recipe.id ? recipe.yieldCount : other
  }
  return yields
}

export type ExpectedCraftYieldEntry = {
  shortId: string
  atlasId: number
  name: string
  amount: number
}

export const sumExpectedCraftYields = (
  allocations: readonly { recipe: EventCraftRecipe; totalCount: number }[],
  recipes: readonly EventCraftRecipe[] = EVENT_CRAFT_RECIPES_2026,
): ExpectedCraftYieldEntry[] => {
  const amounts = new Map<string, number>()
  const meta = new Map<string, { atlasId: number; name: string }>()
  for (const recipe of recipes) {
    meta.set(recipe.targetItem.shortId, {
      atlasId: recipe.targetItem.atlasId,
      name: recipe.targetItem.name,
    })
  }
  for (const { recipe, totalCount } of allocations) {
    if (totalCount <= 0) continue
    for (const [shortId, y] of Object.entries(getRecipeYields(recipe, recipes))) {
      if (y <= 0) continue
      amounts.set(shortId, (amounts.get(shortId) ?? 0) + totalCount * y)
    }
  }
  return [...amounts.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([shortId, amount]) => {
      const item = meta.get(shortId)
      return {
        shortId,
        atlasId: item?.atlasId ?? 0,
        name: item?.name ?? shortId,
        amount,
      }
    })
}

export type IngredientMeta = {
  id: IngredientType
  name: string
  shortName: string
}

export const EVENT_INGREDIENTS: readonly IngredientMeta[] = [
  { id: 'seafood', name: 'うちなー海鮮盛り', shortName: '海鮮' },
  { id: 'meat', name: 'うちなーお肉盛り', shortName: 'お肉' },
  { id: 'vegetable', name: 'うちなー野菜盛り', shortName: '野菜' },
] as const

/**
 * 水着2026「料理作成」の12品目のレシピマスタ。
 */
export const EVENT_CRAFT_RECIPES_2026: readonly EventCraftRecipe[] = [
  // 銅素材系（合計消費食材: 60）
  {
    id: 'goya-champuru',
    name: 'ゴーヤーチャンプルー',
    costs: { seafood: 0, meat: 20, vegetable: 40 },
    targetItem: {
      atlasId: 6533,
      shortId: '07',
      name: '宵哭きの鉄杭',
      rarity: 'bronze',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'maasu-ni',
    name: 'マース煮',
    costs: { seafood: 40, meat: 0, vegetable: 20 },
    targetItem: {
      atlasId: 6522,
      shortId: '04',
      name: '愚者の鎖',
      rarity: 'bronze',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'steak',
    name: '厚切りステーキ',
    costs: { seafood: 20, meat: 40, vegetable: 0 },
    targetItem: {
      atlasId: 6555,
      shortId: '0d',
      name: '狂気の残滓',
      rarity: 'bronze',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'skull-andagi',
    name: 'ドクロアンダギー',
    costs: { seafood: 20, meat: 20, vegetable: 20 },
    targetItem: {
      atlasId: 6516,
      shortId: '01',
      name: '凶骨',
      rarity: 'bronze',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },

  // 銀素材系（合計消費食材: 75）
  {
    id: 'soki-soba',
    name: 'オニオニソーキそば',
    costs: { seafood: 30, meat: 45, vegetable: 0 },
    targetItem: {
      atlasId: 6510,
      shortId: '15',
      name: '無間の歯車',
      rarity: 'silver',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'potatoes',
    name: 'ちまみれポテト',
    costs: { seafood: 0, meat: 30, vegetable: 45 },
    targetItem: {
      atlasId: 6524,
      shortId: '19',
      name: '大騎士勲章',
      rarity: 'silver',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'tempura',
    name: '九尾てんぷらー',
    costs: { seafood: 45, meat: 0, vegetable: 30 },
    targetItem: {
      atlasId: 6511,
      shortId: '16',
      name: '禁断の頁',
      rarity: 'silver',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'taco-rice',
    name: '深淵タコライス',
    costs: { seafood: 25, meat: 25, vegetable: 25 },
    targetItem: {
      atlasId: 6515,
      shortId: '12',
      name: '八連双晶',
      rarity: 'silver',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },

  // 金素材系（合計消費食材: 90）
  {
    id: 'hijah-soup',
    name: '鐘楼ヒージャー汁',
    costs: { seafood: 25, meat: 25, vegetable: 40 },
    targetItem: {
      atlasId: 6520,
      shortId: '25',
      name: '血の涙石',
      rarity: 'gold',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'rafute',
    name: '城壁ラフテー',
    costs: { seafood: 25, meat: 40, vegetable: 25 },
    targetItem: {
      atlasId: 6528,
      shortId: '29',
      name: '原初の産毛',
      rarity: 'gold',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'curry',
    name: '底なし沼カレー',
    costs: { seafood: 40, meat: 25, vegetable: 25 },
    targetItem: {
      atlasId: 6548,
      shortId: '2h',
      name: '鬼炎鬼灯',
      rarity: 'gold',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
  {
    id: 'zenzai',
    name: '目玉ぜんざい',
    costs: { seafood: 30, meat: 30, vegetable: 30 },
    targetItem: {
      atlasId: 6517,
      shortId: '21',
      name: '蛮神の心臓',
      rarity: 'gold',
    },
    yieldCount: EVENT_CRAFT_FEATURED_YIELD,
  },
] as const

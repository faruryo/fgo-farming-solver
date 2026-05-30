// レアリティ判定の単一ソース。localized item には `background` が無いため、
// `category` 表示名(lib/get-items.ts の taxonomy を反映、ja + en 両対応)から
// gold / silver / bronze を判定する。QP('zero')は意図的に除外している
// ── QP・絆はドロップデータに存在せず効率ポイントに寄与しないため。

export type Rarity = 'bronze' | 'silver' | 'gold'

const RARITY_BY_CATEGORY: Record<string, Rarity> = {
  // bronze
  銅素材: 'bronze',
  輝石: 'bronze',
  Bronze: 'bronze',
  Shining: 'bronze',
  // silver
  銀素材: 'silver',
  魔石: 'silver',
  ピース: 'silver',
  Silver: 'silver',
  Magic: 'silver',
  Piece: 'silver',
  // gold
  金素材: 'gold',
  秘石: 'gold',
  モニュメント: 'gold',
  Gold: 'gold',
  Secret: 'gold',
  Monument: 'gold',
}

export const getRarityByCategory = (category: string): Rarity | null =>
  RARITY_BY_CATEGORY[category] ?? null

// スキル石(輝石/魔石/秘石)の largeCategory。「石除く」トグルで使用。
const SKILL_STONE_LARGE_CATEGORIES = new Set(['スキル石', 'Gems'])

export const isSkillStone = (largeCategory: string | undefined): boolean =>
  largeCategory != null && SKILL_STONE_LARGE_CATEGORIES.has(largeCategory)

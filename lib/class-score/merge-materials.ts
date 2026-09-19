/**
 * サーヴァント育成必要素材とクラススコア必要素材を合算する純関数。
 *
 * @param servantMaterials sumMaterials(chaldeaState) の結果
 * @param classScoreMaterials sumClassScoreMaterials(classScoreState) の結果
 * @returns アイテムIDごとに合算された必要数 Record
 */
export const mergeMaterials = (
  servantMaterials: Record<string, number> = {},
  classScoreMaterials: Record<string, number> = {},
): Record<string, number> => {
  const mergedMap = new Map<string, number>(Object.entries(servantMaterials))

  Object.entries(classScoreMaterials).forEach(([id, amount]) => {
    mergedMap.set(id, (mergedMap.get(id) ?? 0) + amount)
  })

  return Object.fromEntries(mergedMap)
}

export type MaterialBreakdown = {
  servant: number
  classScore: number
  total: number
}

/**
 * 特定アイテムまたは全アイテムについて、サーヴァント分とクラススコア分の内訳を取得する。
 */
export const getMaterialBreakdown = (
  itemId: string,
  servantMaterials: Record<string, number> = {},
  classScoreMaterials: Record<string, number> = {},
): MaterialBreakdown => {
  const svt = (Reflect.get(servantMaterials, itemId) as number | undefined) || 0
  const cs =
    (Reflect.get(classScoreMaterials, itemId) as number | undefined) || 0
  return {
    servant: svt,
    classScore: cs,
    total: svt + cs,
  }
}

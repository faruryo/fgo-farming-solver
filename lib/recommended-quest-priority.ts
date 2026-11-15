import type { Quest } from '../interfaces/api'

/**
 * RecommendedQuest 周回数モードの tier 計算。
 *
 *   tier 0: ポッド無料対象クエスト (期間中のみ)
 *   tier 1: 冠位研鑽戦 / 冠位戴冠戦
 *   tier 2: オーディール・コール
 *   tier 3: その他
 *
 * 期間外 (`podFreeQuestIds` 空集合) では tier 0 は発生しない。
 */
export const getRecommendedQuestPriorityLaps = (
  q: Pick<Quest, 'id' | 'area'>,
  podFreeQuestIds: Set<string>,
): number => {
  if (podFreeQuestIds.has(q.id)) return 0
  const area = q.area ?? ''
  if (area.includes('冠位研鑽戦') || area.includes('冠位戴冠戦')) return 1
  if (area.includes('オーディール・コール')) return 2
  return 3
}

/**
 * 周回計算の結果が無いときに RecommendedQuest が出す案内。
 * 育成必要数（`material/result`）に正の値が1つも無ければ目標入力へ、あれば周回計算へ誘導する。
 */
export const getRecommendedQuestEmptyGuide = (
  materialResult: Record<string, number> | null | undefined,
): 'set-goal' | 'solve' =>
  Object.values(materialResult ?? {}).some((n) => typeof n === 'number' && n > 0) ? 'solve' : 'set-goal'

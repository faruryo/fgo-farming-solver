import type { Quest } from '../../interfaces/fgodrop'

const ORDEAL_CALL_AREA = 'オーディール・コール'
const KANI_KENSAN_AREA = '冠位研鑽戦'

const isHighDifficultyArea = (area: string | undefined): boolean =>
  area != null && (area.includes(ORDEAL_CALL_AREA) || area.includes(KANI_KENSAN_AREA))

export const collectHighDifficultyQuestIds = (quests: Quest[]): string[] =>
  quests.filter((q) => isHighDifficultyArea(q.area)).map((q) => q.id)

export const hasHighDifficultyAccess = (
  checkedQuestIds: string[],
  highDifficultyQuestIds: string[]
): boolean => {
  if (highDifficultyQuestIds.length === 0) return false
  const checked = new Set(checkedQuestIds)
  return highDifficultyQuestIds.some((id) => checked.has(id))
}

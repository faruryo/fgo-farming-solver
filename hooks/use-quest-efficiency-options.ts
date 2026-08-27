import { useLocalStorage } from './use-local-storage'
import { useStockTarget } from './use-stock-target'
import type { EfficiencyDenominator } from '../lib/quest-efficiency'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'

export const useQuestEfficiencyOptions = () => {
  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>(STORAGE_KEYS.POSSESSION, {})
  const [materialResult, setMaterialResult] = useLocalStorage<Record<string, number>>(STORAGE_KEYS.MATERIAL_RESULT, {})
  const [itemsRaw, setItemsRaw] = useLocalStorage<Record<string, string | number | undefined>>(STORAGE_KEYS.ITEMS, {})
  const { stockEnabled, setStockEnabled, stockBuffer: resolvedStockBuffer } = useStockTarget()

  const [shortageOnly, setShortageOnly] = useLocalStorage<boolean>(STORAGE_KEYS.QUEST_EFFICIENCY_SHORTAGE_ONLY, true)
  const [includeSkillStones, setIncludeSkillStones] = useLocalStorage<boolean>(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_SKILL_STONES, true)
  const [includePieces, setIncludePieces] = useLocalStorage<boolean>(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_PIECES, true)
  const [denominator, setDenominator] = useLocalStorage<EfficiencyDenominator>(STORAGE_KEYS.QUEST_EFFICIENCY_DENOMINATOR, 'ap')
  const [includeQp, setIncludeQp] = useLocalStorage<boolean>(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_QP, false)
  const [includeBond, setIncludeBond] = useLocalStorage<boolean>(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_BOND, false)
  const [includeExp, setIncludeExp] = useLocalStorage<boolean>(STORAGE_KEYS.QUEST_EFFICIENCY_INCLUDE_EXP, false)
  const [showLowKanni, setShowLowKanni] = useLocalStorage<boolean>(STORAGE_KEYS.QUEST_EFFICIENCY_SHOW_LOW_KANNI, false)

  return {
    possession, setPossession,
    materialResult, setMaterialResult,
    itemsRaw, setItemsRaw,
    stockEnabled, setStockEnabled, resolvedStockBuffer,
    shortageOnly, setShortageOnly,
    includeSkillStones, setIncludeSkillStones,
    includePieces, setIncludePieces,
    denominator, setDenominator,
    includeQp, setIncludeQp,
    includeBond, setIncludeBond,
    includeExp, setIncludeExp,
    showLowKanni, setShowLowKanni,
  }
}

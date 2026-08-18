import { useLocalStorage } from './use-local-storage'
import { useStockTarget } from './use-stock-target'
import type { EfficiencyDenominator } from '../lib/quest-efficiency'

export const useQuestEfficiencyOptions = () => {
  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>('posession', {})
  const [materialResult, setMaterialResult] = useLocalStorage<Record<string, number>>('material/result', {})
  const [itemsRaw, setItemsRaw] = useLocalStorage<Record<string, string | number | undefined>>('items', {})
  const { stockEnabled, stockBuffer: resolvedStockBuffer } = useStockTarget()

  const [shortageOnly, setShortageOnly] = useLocalStorage<boolean>('quests/efficiency/shortageOnly', true)
  const [includeSkillStones, setIncludeSkillStones] = useLocalStorage<boolean>('quests/efficiency/includeSkillStones', true)
  const [includePieces, setIncludePieces] = useLocalStorage<boolean>('quests/efficiency/includePieces', true)
  const [denominator, setDenominator] = useLocalStorage<EfficiencyDenominator>('quests/efficiency/denominator', 'ap')
  const [includeQp, setIncludeQp] = useLocalStorage<boolean>('quests/efficiency/includeQp', false)
  const [includeBond, setIncludeBond] = useLocalStorage<boolean>('quests/efficiency/includeBond', false)
  const [includeExp, setIncludeExp] = useLocalStorage<boolean>('quests/efficiency/includeExp', false)
  const [showLowKanni, setShowLowKanni] = useLocalStorage<boolean>('quests/efficiency/showLowKanni', false)

  return {
    possession, setPossession,
    materialResult, setMaterialResult,
    itemsRaw, setItemsRaw,
    stockEnabled, resolvedStockBuffer,
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

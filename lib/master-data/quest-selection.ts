import type { DropRate, Quest } from './types'

export interface FilterCandidateQuestsResult {
  quests: Quest[]
  drop_rates: DropRate[]
}

const selectTopQuestsPerItem = (allDropRates: DropRate[]): Set<string> => {
  const selected = new Set<string>()
  const itemToRates = new Map<string, DropRate[]>()
  for (const dr of allDropRates) {
    const list = itemToRates.get(dr.item_id)
    if (list) {
      list.push(dr)
    } else {
      itemToRates.set(dr.item_id, [dr])
    }
  }

  for (const [, rates] of itemToRates) {
    const sorted = [...rates].sort((a, b) => b.drop_rate - a.drop_rate)
    sorted.slice(0, 5).forEach(dr => selected.add(dr.quest_id))
  }
  return selected
}

const computeBestEfficiencies = (
  allDropRates: DropRate[],
  questById: Map<string, Quest>
): Map<string, number> => {
  const best = new Map<string, number>()
  for (const dr of allDropRates) {
    const quest = questById.get(dr.quest_id)
    if (quest && quest.ap > 0) {
      const efficiency = dr.drop_rate / quest.ap
      const currentBest = best.get(dr.item_id) ?? 0
      if (efficiency > currentBest) {
        best.set(dr.item_id, efficiency)
      }
    }
  }
  return best
}

const selectTopQuestsByRelativeScore = (
  quests: Quest[],
  allDropRates: DropRate[]
): string[] => {
  const questById = new Map(quests.map(q => [q.id, q]))
  const bestEfficiencyPerItem = computeBestEfficiencies(allDropRates, questById)

  const questToRelativeScore = new Map<string, number>()
  for (const dr of allDropRates) {
    const quest = questById.get(dr.quest_id)
    const bestEff = bestEfficiencyPerItem.get(dr.item_id) ?? 0
    if (quest && bestEff > 0 && quest.ap > 0) {
      const relativeEff = (dr.drop_rate / quest.ap) / bestEff
      const currentScore = questToRelativeScore.get(dr.quest_id) ?? 0
      questToRelativeScore.set(dr.quest_id, currentScore + relativeEff)
    }
  }

  return [...questToRelativeScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([qid]) => qid)
}

/**
 * Filter Candidates Strategy:
 * A. Keep Top 5 quests per item (by absolute drop rate) to ensure each item is farmable efficiently
 * B. Keep Top 100 quests by 'Relative Efficiency Score' to include multi-drop heavens
 */
export function filterCandidateQuests(
  quests: Quest[],
  allDropRates: DropRate[]
): FilterCandidateQuestsResult {
  const selectedQuestIds = selectTopQuestsPerItem(allDropRates)
  const topScoreQuestIds = selectTopQuestsByRelativeScore(quests, allDropRates)
  topScoreQuestIds.forEach(qid => selectedQuestIds.add(qid))

  const filtered_drop_rates = allDropRates.filter(dr => selectedQuestIds.has(dr.quest_id))
  const finalQuests = quests.filter(q => selectedQuestIds.has(q.id))

  return {
    quests: finalQuests,
    drop_rates: filtered_drop_rates,
  }
}

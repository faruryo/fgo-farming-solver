import solver from 'javascript-lp-solver'
import { Drops } from './get-drops'
import { Result, Params } from '../interfaces/api'

export const solve = (
  drops: Drops,
  params: Params,
): Result => {
  const { objective, items: targetItems, quests: allowedQuestIds } = params

  const model: solver.Model = {
    optimize: objective === 'lap' ? 'totalRuns' : 'totalAp',
    opType: 'min',
    constraints: {},
    variables: {},
    ints: {},
  }

  // Build set of item IDs that actually have drop rate data
  const itemsWithDropData = new Set(drops.drop_rates.map((dr) => dr.item_id))

  // Set constraints only for items that have drop rate data; collect skipped ones
  const skippedItems: string[] = []
  Object.entries(targetItems).forEach(([itemId, count]) => {
    if (count > 0) {
      if (itemsWithDropData.has(itemId)) {
        model.constraints[itemId] = { min: count }
      } else {
        skippedItems.push(itemId)
      }
    }
  })

  // Filter quests
  const availableQuests = drops.quests.filter((q) =>
    allowedQuestIds.includes(q.id)
  )

  // Add variables for each quest
  availableQuests.forEach((quest) => {
    const variable: Record<string, number> = {
      totalRuns: 1,
      totalAp: quest.ap,
    }

    drops.drop_rates
      .filter((dr) => dr.quest_id === quest.id)
      .forEach((dr) => {
        if (dr.drop_rate > 0 && model.constraints[dr.item_id]) {
          variable[dr.item_id] = dr.drop_rate
        }
      })

    model.variables[quest.id] = variable
  })

  const solveResult = solver.Solve(model)

  if (!solveResult.feasible) {
    return {
      params,
      quests: [],
      items: [],
      drop_rates: [],
      total_lap: 0,
      total_ap: 0,
      skipped_items: skippedItems,
    }
  }

  const resultQuests = availableQuests
    .filter((q) => typeof solveResult[q.id] === 'number' && (solveResult[q.id] as number) > 0)
    .map((q) => ({
      id: q.id,
      section: q.section,
      area: q.area,
      name: q.name,
      lap: Number(solveResult[q.id] || 0),
    }))

  const resultItems = drops.items
    .filter((item) => targetItems[item.id] > 0)
    .map((item) => {
      let actualCount = 0
      resultQuests.forEach((rq) => {
        const dr = drops.drop_rates.find(
          (dr) => dr.quest_id === rq.id && dr.item_id === item.id
        )
        if (dr) {
          actualCount += dr.drop_rate * rq.lap
        }
      })
      return {
        id: item.id,
        category: item.category,
        name: item.name,
        count: actualCount,
      }
    })

  const resultDropRates = drops.drop_rates
    .filter((dr) =>
      resultQuests.some(rq => rq.id === dr.quest_id) &&
      resultItems.some(ri => ri.id === dr.item_id)
    )
    .map(dr => ({
      quest_id: dr.quest_id,
      quest_name: drops.quests.find(q => q.id === dr.quest_id)?.name || '',
      item_id: dr.item_id,
      item_name: drops.items.find(i => i.id === dr.item_id)?.name || '',
      drop_rate: dr.drop_rate,
    }))

  return {
    params,
    quests: resultQuests,
    items: resultItems,
    drop_rates: resultDropRates,
    total_lap: solveResult.result && objective === 'lap' ? solveResult.result : resultQuests.reduce((acc, q) => acc + q.lap, 0),
    total_ap: solveResult.result && objective === 'ap' ? solveResult.result : resultQuests.reduce((acc, q) => acc + (availableQuests.find(aq => aq.id === q.id)?.ap || 0) * q.lap, 0),
    skipped_items: skippedItems,
  }
}

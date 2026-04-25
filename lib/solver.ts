import solver from 'javascript-lp-solver'
import { Drops } from './get-drops'
import { Result, Params } from '../interfaces/api'

export const solve = (
  drops: Drops,
  params: Params,
  dropMergeMethod: string
): Result => {
  const { objective, items: targetItems, quests: allowedQuestIds } = params

  const model: solver.Model = {
    optimize: objective === 'lap' ? 'totalRuns' : 'totalAp',
    opType: 'min',
    constraints: {},
    variables: {},
    ints: {},
  }

  // Set constraints for each target item
  Object.entries(targetItems).forEach(([itemId, count]) => {
    if (count > 0) {
      model.constraints[itemId] = { min: count }
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

    // Add drop rates for this quest
    drops.drop_rates
      .filter((dr) => dr.quest_id === quest.id)
      .forEach((dr) => {
        let rate = 0
        if (dropMergeMethod === 'add') {
          rate = (dr.drop_rate_1 || 0) + (dr.drop_rate_2 || 0)
        } else if (dropMergeMethod === '1') {
          rate = dr.drop_rate_1 || 0
        } else if (dropMergeMethod === '2') {
          rate = dr.drop_rate_2 || 0
        }

        if (rate > 0 && model.constraints[dr.item_id]) {
          variable[dr.item_id] = rate
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
    }
  }

  // Format result
  const resultQuests = availableQuests
    .filter((q) => solveResult[q.id] > 0)
    .map((q) => ({
      id: q.id,
      section: q.section,
      area: q.area,
      name: q.name,
      lap: solveResult[q.id],
    }))

  const resultItems = drops.items
    .filter((item) => targetItems[item.id] > 0)
    .map((item) => {
      // Calculate actual count obtained
      let actualCount = 0
      resultQuests.forEach((rq) => {
        const dr = drops.drop_rates.find(
          (dr) => dr.quest_id === rq.id && dr.item_id === item.id
        )
        if (dr) {
          let rate = 0
          if (dropMergeMethod === 'add') {
            rate = (dr.drop_rate_1 || 0) + (dr.drop_rate_2 || 0)
          } else if (dropMergeMethod === '1') {
            rate = dr.drop_rate_1 || 0
          } else if (dropMergeMethod === '2') {
            rate = dr.drop_rate_2 || 0
          }
          actualCount += rate * rq.lap
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
    .map(dr => {
      let rate = 0
      if (dropMergeMethod === 'add') {
        rate = (dr.drop_rate_1 || 0) + (dr.drop_rate_2 || 0)
      } else if (dropMergeMethod === '1') {
        rate = dr.drop_rate_1 || 0
      } else if (dropMergeMethod === '2') {
        rate = dr.drop_rate_2 || 0
      }
      return {
        quest_id: dr.quest_id,
        quest_name: drops.quests.find(q => q.id === dr.quest_id)?.name || '',
        item_id: dr.item_id,
        item_name: drops.items.find(i => i.id === dr.item_id)?.name || '',
        drop_rate: rate
      }
    })

  return {
    params,
    quests: resultQuests,
    items: resultItems,
    drop_rates: resultDropRates,
    total_lap: solveResult.result && objective === 'lap' ? solveResult.result : resultQuests.reduce((acc, q) => acc + q.lap, 0),
    total_ap: solveResult.result && objective === 'ap' ? solveResult.result : resultQuests.reduce((acc, q) => acc + (availableQuests.find(aq => aq.id === q.id)?.ap || 0) * q.lap, 0),
  }
}

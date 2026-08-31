import { computeEventCraftPlan, EventCraftPlanOptions, EventCraftPlanResult } from './event-craft-advisor'
import { Drops } from './get-drops'
import { IngredientCounts } from '../data/event-craft-recipes'

export type EventCraftPlanWorkerRequest = {
  drops: Drops
  fullNeed: Record<string, number>
  ownedIngredients: IngredientCounts
  questIds: string[]
  options?: EventCraftPlanOptions
}

self.onmessage = (e: MessageEvent<EventCraftPlanWorkerRequest>) => {
  const { drops, fullNeed, ownedIngredients, questIds, options } = e.data
  const result: EventCraftPlanResult = computeEventCraftPlan(
    drops,
    fullNeed,
    ownedIngredients,
    questIds,
    options,
  )
  postMessage(result)
}

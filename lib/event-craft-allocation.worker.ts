import {
  EventCraftPlanOptions,
  EventCraftPatternResult,
  computeEventCraftPlanProgressive,
} from './event-craft-advisor'
import { EventCraftWorkerMessage } from './event-craft-plan-progress'
import { Drops } from './get-drops'
import { IngredientCounts } from '../data/event-craft-recipes'

export type EventCraftAllocationWorkerRequest = {
  drops: Drops
  fullNeed: Record<string, number>
  ownedIngredients: IngredientCounts
  questIds: string[]
  options?: EventCraftPlanOptions
}

const postWorkerMessage = (message: EventCraftWorkerMessage) => {
  postMessage(message)
}

self.onmessage = (e: MessageEvent<EventCraftAllocationWorkerRequest>) => {
  const { drops, fullNeed, ownedIngredients, questIds, options } = e.data
  computeEventCraftPlanProgressive(
    drops,
    fullNeed,
    ownedIngredients,
    questIds,
    options,
    (pattern: EventCraftPatternResult) => {
      postWorkerMessage({ type: 'pattern', pattern })
    },
  )
  postWorkerMessage({ type: 'done' })
}

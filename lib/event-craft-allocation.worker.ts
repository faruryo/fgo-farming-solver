import {
  EventCraftSolverOptions,
  EventCraftSolverResult,
  solveEventCraftAllocation,
} from './event-craft-advisor'
import { Drops } from './get-drops'
import { IngredientCounts } from '../data/event-craft-recipes'
import { DenominatorMode } from './material-selection-advisor'

export type EventCraftAllocationWorkerRequest = {
  drops: Drops
  fullNeed: Record<string, number>
  ownedIngredients: IngredientCounts
  mode: DenominatorMode
  questIds: string[]
  options?: EventCraftSolverOptions
}

self.onmessage = (e: MessageEvent<EventCraftAllocationWorkerRequest>) => {
  const { drops, fullNeed, ownedIngredients, mode, questIds, options } = e.data
  const result: EventCraftSolverResult = solveEventCraftAllocation(
    drops,
    fullNeed,
    ownedIngredients,
    mode,
    questIds,
    options,
  )
  postMessage(result)
}

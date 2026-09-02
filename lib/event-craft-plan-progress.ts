import {
  EventCraftPatternId,
  EventCraftPatternResult,
  EventCraftPlanResult,
  foldEventCraftPatterns,
} from './event-craft-advisor'

export const EVENT_CRAFT_PATTERN_ORDER: readonly EventCraftPatternId[] = [
  'runs',
  'ap',
  'even-turn',
  'even-ap',
]

export type EventCraftWorkerMessage =
  | { type: 'pattern'; pattern: EventCraftPatternResult }
  | { type: 'done' }

export type EventCraftPlanProgress = {
  received: EventCraftPatternResult[]
  plan: EventCraftPlanResult
  done: boolean
  timedOut: boolean
  timedOutPatternIds: EventCraftPatternId[]
}

export const emptyEventCraftPlanProgress = (): EventCraftPlanProgress => ({
  received: [],
  plan: { patterns: [], absorbedInto: {} },
  done: false,
  timedOut: false,
  timedOutPatternIds: [],
})

export const applyEventCraftWorkerMessage = (
  state: EventCraftPlanProgress,
  message: EventCraftWorkerMessage,
): EventCraftPlanProgress => {
  if (state.done || state.timedOut) return state
  if (message.type === 'done') {
    return { ...state, done: true, timedOutPatternIds: [] }
  }
  const received = [...state.received, message.pattern]
  return {
    ...state,
    received,
    plan: foldEventCraftPatterns(received),
  }
}

export const applyEventCraftWorkerTimeout = (
  state: EventCraftPlanProgress,
): EventCraftPlanProgress => {
  if (state.done || state.timedOut) return state
  const receivedIds = new Set(state.received.map((pattern) => pattern.id))
  return {
    ...state,
    timedOut: true,
    timedOutPatternIds: EVENT_CRAFT_PATTERN_ORDER.filter(
      (id) => !receivedIds.has(id),
    ),
  }
}

export const isEventCraftPlanAwaitingFirstPattern = (
  progress: EventCraftPlanProgress,
) => !progress.done && !progress.timedOut && progress.received.length === 0

export const didEventCraftPlanOverallTimeout = (
  progress: EventCraftPlanProgress,
) => progress.timedOut && progress.received.length === 0

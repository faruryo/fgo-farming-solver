import { describe, expect, it } from 'vitest'
import { EventCraftPatternResult } from './event-craft-advisor'
import { EVENT_CRAFT_RECIPES_2026 } from '../data/event-craft-recipes'
import {
  applyEventCraftWorkerMessage,
  applyEventCraftWorkerTimeout,
  didEventCraftPlanOverallTimeout,
  emptyEventCraftPlanProgress,
  isEventCraftPlanAwaitingFirstPattern,
} from './event-craft-plan-progress'

const recipe = EVENT_CRAFT_RECIPES_2026[0]

const patternMetricFor = (
  id: EventCraftPatternResult['id'],
): EventCraftPatternResult['metric'] => {
  if (id === 'ap' || id === 'even-ap') return 'ap'
  return 'turn'
}

const makePattern = (
  id: EventCraftPatternResult['id'],
): EventCraftPatternResult => ({
  id,
  metric: patternMetricFor(id),
  allocations: [
    {
      recipe,
      deficitCount: 1,
      surplusCount: 0,
      totalCount: 1,
      unitSaved: 0,
      deficitSaved: 0,
      surplusValue: 0,
      spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
      deficitNeed: 0,
    },
  ],
  totalCrafted: 1,
  totalDeficitCrafted: 1,
  totalSurplusCrafted: 0,
  totalSaved: 0,
  totalSurplusValue: 0,
  spentIngredients: { seafood: 0, meat: 0, vegetable: 0 },
  leftoverIngredients: { seafood: 0, meat: 0, vegetable: 0 },
  residualTurnCost: 0,
  residualApCost: 0,
  baselineTurnCost: 0,
  baselineApCost: 0,
})

describe('event craft plan progress', () => {
  it.each([
    {
      name: '0件 timeout',
      run: () => {
        const next = applyEventCraftWorkerTimeout(emptyEventCraftPlanProgress())
        return {
          overall: didEventCraftPlanOverallTimeout(next),
          awaiting: isEventCraftPlanAwaitingFirstPattern(next),
          ids: next.timedOutPatternIds,
          count: next.plan.patterns.length,
        }
      },
      expected: {
        overall: true,
        awaiting: false,
        ids: ['runs', 'ap', 'even-turn', 'even-ap'],
        count: 0,
      },
    },
    {
      name: '途中まで届いて timeout',
      run: () => {
        let state = applyEventCraftWorkerMessage(
          emptyEventCraftPlanProgress(),
          { type: 'pattern', pattern: makePattern('runs') },
        )
        state = applyEventCraftWorkerTimeout(state)
        return {
          overall: didEventCraftPlanOverallTimeout(state),
          awaiting: isEventCraftPlanAwaitingFirstPattern(state),
          ids: state.timedOutPatternIds,
          count: state.plan.patterns.length,
          visible: state.plan.patterns.map((pattern) => pattern.id),
        }
      },
      expected: {
        overall: false,
        awaiting: false,
        ids: ['ap', 'even-turn', 'even-ap'],
        count: 1,
        visible: ['runs'],
      },
    },
    {
      name: 'done まで全部',
      run: () => {
        let state = emptyEventCraftPlanProgress()
        for (const id of ['runs', 'ap', 'even-turn', 'even-ap'] as const) {
          state = applyEventCraftWorkerMessage(state, {
            type: 'pattern',
            pattern: makePattern(id),
          })
        }
        state = applyEventCraftWorkerMessage(state, { type: 'done' })
        return {
          overall: didEventCraftPlanOverallTimeout(state),
          awaiting: isEventCraftPlanAwaitingFirstPattern(state),
          done: state.done,
          timedOut: state.timedOut,
          count: state.plan.patterns.length,
        }
      },
      expected: {
        overall: false,
        awaiting: false,
        done: true,
        timedOut: false,
        count: 1,
      },
    },
  ])('$name', ({ run, expected }) => {
    expect(run()).toEqual(expected)
  })

  it('ignores messages after timeout', () => {
    const timedOut = applyEventCraftWorkerTimeout(emptyEventCraftPlanProgress())
    const next = applyEventCraftWorkerMessage(timedOut, {
      type: 'pattern',
      pattern: makePattern('runs'),
    })
    expect(next.plan.patterns).toHaveLength(0)
    expect(didEventCraftPlanOverallTimeout(next)).toBe(true)
  })
})

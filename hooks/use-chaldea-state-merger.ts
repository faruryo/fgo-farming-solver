import { useCallback } from 'react'
import { ChaldeaState, ServantState } from './create-chaldea-state'

// appendSkill is un-trained by default (min level 0), unlike active skills (min 1).
// Padding new range slots with start: 1 is the recurring bug that makes a
// freshly-owned servant show all append skills at level 1 instead of 0.
const APPEND_SKILL_COUNT = 5
const APPEND_SKILL_DEFAULT_RANGE = { start: 0, end: 10 }

export const mergeChaldeaState = (
  initialState: ChaldeaState,
  state: ChaldeaState
): ChaldeaState => {
  const merged = state.all
    ? {
        ...Object.fromEntries(
          Object.entries(initialState).map(([id, { disabled }]) => [
            id,
            {
              disabled,
              targets: JSON.parse(JSON.stringify(state.all.targets)) as ServantState['targets'],
            },
          ])
        ),
        ...state,
      }
    : { ...initialState, ...state }

  // Force 5 appendSkill ranges for all servants
  return Object.fromEntries(
    Object.entries(merged as ChaldeaState).map(([id, servant]) => {
      const app = servant.targets?.appendSkill
      if (app && app.ranges.length < APPEND_SKILL_COUNT) {
        const nextRanges = [...app.ranges]
        while (nextRanges.length < APPEND_SKILL_COUNT) {
          nextRanges.push({ ...APPEND_SKILL_DEFAULT_RANGE })
        }
        return [
          id,
          {
            ...servant,
            targets: {
              ...servant.targets,
              appendSkill: { ...app, ranges: nextRanges },
            },
          },
        ]
      }
      return [id, servant]
    })
  )
}

export const useChaldeaStateMarger = (initialState: ChaldeaState) =>
  useCallback(
    (state: ChaldeaState): ChaldeaState => mergeChaldeaState(initialState, state),
    [initialState]
  )

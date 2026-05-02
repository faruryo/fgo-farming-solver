import { useCallback } from 'react'
import { ChaldeaState, ServantState } from './create-chaldea-state'

export const useChaldeaStateMarger = (initialState: ChaldeaState) =>
  useCallback(
    (state: ChaldeaState): ChaldeaState => {
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
          if (app && app.ranges.length < 5) {
            const nextRanges = [...app.ranges]
            while (nextRanges.length < 5) {
              nextRanges.push({ start: 1, end: 10 })
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
    },
    [initialState]
  )

import { useCallback } from 'react'
import { ChaldeaState, ServantState } from './create-chaldea-state'
import { TargetKey } from '../interfaces/atlas-academy'

// appendSkill is un-trained by default (min level 0), unlike active skills (min 1).
// Padding new range slots with start: 1 is the recurring bug that makes a
// freshly-owned servant show all append skills at level 1 instead of 0.
const APPEND_SKILL_COUNT = 5
const APPEND_SKILL_DEFAULT_RANGE = { start: 0, end: 10 }

const TARGET_KEYS: TargetKey[] = ['ascension', 'skill', 'appendSkill']

const isUsableTargets = (targets: unknown): targets is ServantState['targets'] =>
  !!targets && typeof targets === 'object'

// Build the targets for a servant that has no individual stored data, when a
// common-goal "all" template exists. `end` (and the per-target `disabled`
// flag) are inherited from the template, but `start` is NEVER taken from
// `all` -- `all.targets.*.start` cannot be edited by any UI and freezes at
// whatever value existed when the "all" entry was first created. `start`
// always comes from the servant's own correct defaults instead.
const buildTargetsFromAllTemplate = (
  allTargets: ServantState['targets'],
  defaultTargets: ServantState['targets']
): ServantState['targets'] =>
  Object.fromEntries(
    TARGET_KEYS.map((target) => {
      const allTarget = allTargets[target]
      const defaultTarget = defaultTargets[target]
      return [
        target,
        {
          disabled: allTarget?.disabled ?? defaultTarget.disabled,
          ranges: defaultTarget.ranges.map((defaultRange, i) => ({
            start: defaultRange.start,
            end: allTarget?.ranges[i]?.end ?? defaultRange.end,
          })),
        },
      ]
    })
  ) as ServantState['targets']

// Force 5 appendSkill ranges for all servants (legacy/partial saves may only
// have fewer than 5 stored).
const padAppendSkillRanges = (merged: ChaldeaState): ChaldeaState =>
  Object.fromEntries(
    Object.entries(merged).map(([id, servant]) => {
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

export const mergeChaldeaState = (
  initialState: ChaldeaState,
  state: ChaldeaState
): ChaldeaState => {
  const allTargets = state.all?.targets
  const merged = isUsableTargets(allTargets)
    ? {
        ...Object.fromEntries(
          Object.entries(initialState).map(([id, { disabled, targets }]) => [
            id,
            {
              disabled,
              targets: buildTargetsFromAllTemplate(allTargets, targets),
            },
          ])
        ),
        ...state,
      }
    : { ...initialState, ...state }

  return padAppendSkillRanges(merged)
}

export const useChaldeaStateMarger = (initialState: ChaldeaState) =>
  useCallback(
    (state: ChaldeaState): ChaldeaState => mergeChaldeaState(initialState, state),
    [initialState]
  )

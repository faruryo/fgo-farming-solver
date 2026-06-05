import { describe, it, expect } from 'vitest'
import { mergeChaldeaState } from './use-chaldea-state-merger'
import { createChaldeaState, ChaldeaState } from './create-chaldea-state'

describe('mergeChaldeaState appendSkill padding', () => {
  // Regression: a freshly-owned servant must default its append skills to level 0
  // (un-trained), NOT level 1. The 5-slot padding has repeatedly reintroduced
  // start: 1 here, which silently bumps every append skill to 1.
  it('pads missing appendSkill ranges with start: 0, not 1', () => {
    const initialState = createChaldeaState(['1'])
    // Simulate stored state with fewer than 5 append ranges (e.g. legacy data
    // saved before the 5-slot expansion, or a partial save).
    const stored: ChaldeaState = {
      '1': {
        disabled: false,
        targets: {
          ...initialState['1'].targets,
          appendSkill: { disabled: false, ranges: [{ start: 5, end: 10 }] },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    const ranges = merged['1'].targets.appendSkill.ranges

    expect(ranges).toHaveLength(5)
    // The pre-existing range is preserved as-is.
    expect(ranges[0]).toEqual({ start: 5, end: 10 })
    // The 4 padded slots default to un-trained (start: 0), the actual bug.
    for (const range of ranges.slice(1)) {
      expect(range.start).toBe(0)
      expect(range.end).toBe(10)
    }
  })

  it('defaults every append skill to start: 0 when a servant becomes owned', () => {
    // initialState carries the canonical defaults (createServantState).
    const initialState = createChaldeaState(['1'])
    // User toggles owned but stored append data is empty -> all 5 slots padded.
    const stored: ChaldeaState = {
      '1': {
        disabled: false,
        targets: {
          ...initialState['1'].targets,
          appendSkill: { disabled: false, ranges: [] },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    const ranges = merged['1'].targets.appendSkill.ranges

    expect(ranges).toHaveLength(5)
    expect(ranges.every((r) => r.start === 0)).toBe(true)
  })

  it('leaves already-complete (5-slot) appendSkill ranges untouched', () => {
    const initialState = createChaldeaState(['1'])
    const fullRanges = [
      { start: 3, end: 9 },
      { start: 0, end: 10 },
      { start: 1, end: 5 },
      { start: 0, end: 10 },
      { start: 2, end: 8 },
    ]
    const stored: ChaldeaState = {
      '1': {
        disabled: false,
        targets: {
          ...initialState['1'].targets,
          appendSkill: { disabled: false, ranges: fullRanges },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    expect(merged['1'].targets.appendSkill.ranges).toEqual(fullRanges)
  })

  it('expands appendSkill to 5 slots for servants merged from the "all" template', () => {
    const initialState = createChaldeaState(['1', '2'])
    // The "all" bulk-apply path: one template applied to every servant.
    const stored: ChaldeaState = {
      all: {
        disabled: false,
        targets: {
          ...initialState['1'].targets,
          appendSkill: { disabled: false, ranges: [{ start: 7, end: 10 }] },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    for (const id of ['1', '2']) {
      const ranges = merged[id].targets.appendSkill.ranges
      expect(ranges).toHaveLength(5)
      expect(ranges.slice(1).every((r) => r.start === 0)).toBe(true)
    }
  })
})

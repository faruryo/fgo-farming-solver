import { describe, it, expect } from 'vitest'
import { mergeChaldeaState } from './use-chaldea-state-merger'
import { createChaldeaState, ChaldeaState, ServantState } from './create-chaldea-state'

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
      // `start` is never inherited from "all" -- it always comes from the
      // correct default (0), only `end` is inherited from the template.
      expect(ranges.every((r) => r.start === 0)).toBe(true)
      expect(ranges[0].end).toBe(10)
    }
  })
})

describe('mergeChaldeaState "all" template start/end split', () => {
  it('does not leak "all" template start into unowned servants without individual data', () => {
    const initialState = createChaldeaState(['1', '2'])
    const stored: ChaldeaState = {
      all: {
        disabled: false,
        targets: {
          ascension: { disabled: false, ranges: [{ start: 3, end: 4 }] },
          skill: {
            disabled: false,
            ranges: [
              { start: 8, end: 10 },
              { start: 8, end: 10 },
              { start: 8, end: 10 },
            ],
          },
          appendSkill: { disabled: false, ranges: [{ start: 7, end: 10 }] },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    for (const id of ['1', '2']) {
      // start uses createServantState()'s defaults, never the "all" template.
      expect(merged[id].targets.ascension.ranges[0].start).toBe(0)
      expect(merged[id].targets.skill.ranges.every((r) => r.start === 1)).toBe(true)
      expect(merged[id].targets.appendSkill.ranges.every((r) => r.start === 0)).toBe(true)
      // end is inherited from the "all" template's common goal.
      expect(merged[id].targets.ascension.ranges[0].end).toBe(4)
      expect(merged[id].targets.skill.ranges.every((r) => r.end === 10)).toBe(true)
      expect(merged[id].targets.appendSkill.ranges[0].end).toBe(10)
    }
  })

  it('resets a disabled servant\'s polluted start (already flushed to localStorage) back to the default', () => {
    const initialState = createChaldeaState(['1'])
    const stored: ChaldeaState = {
      '1': {
        disabled: true,
        targets: {
          ascension: { disabled: false, ranges: [{ start: 3, end: 4 }] },
          skill: {
            disabled: false,
            ranges: [
              { start: 7, end: 10 },
              { start: 7, end: 10 },
              { start: 7, end: 10 },
            ],
          },
          appendSkill: {
            disabled: false,
            ranges: [
              { start: 1, end: 10 },
              { start: 1, end: 10 },
              { start: 1, end: 10 },
              { start: 1, end: 10 },
              { start: 1, end: 10 },
            ],
          },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    const targets = merged['1'].targets

    // start is force-corrected to the real default, regardless of the stored
    // (polluted) value.
    expect(targets.ascension.ranges[0].start).toBe(0)
    expect(targets.skill.ranges.every((r) => r.start === 1)).toBe(true)
    expect(targets.appendSkill.ranges.every((r) => r.start === 0)).toBe(true)
    // end is untouched by the correction pass.
    expect(targets.ascension.ranges[0].end).toBe(4)
    expect(targets.skill.ranges.every((r) => r.end === 10)).toBe(true)
    expect(targets.appendSkill.ranges.every((r) => r.end === 10)).toBe(true)
  })

  it('does not reset an owned servant\'s manually-edited start', () => {
    const initialState = createChaldeaState(['1'])
    const stored: ChaldeaState = {
      '1': {
        disabled: false,
        targets: {
          ascension: { disabled: false, ranges: [{ start: 2, end: 4 }] },
          skill: {
            disabled: false,
            ranges: [
              { start: 5, end: 10 },
              { start: 5, end: 10 },
              { start: 5, end: 10 },
            ],
          },
          appendSkill: {
            disabled: false,
            ranges: [
              { start: 3, end: 10 },
              { start: 3, end: 10 },
              { start: 3, end: 10 },
              { start: 3, end: 10 },
              { start: 3, end: 10 },
            ],
          },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    const targets = merged['1'].targets

    // Owned servants are outside the correction pass -- edited start values
    // are preserved as-is.
    expect(targets.ascension.ranges[0].start).toBe(2)
    expect(targets.skill.ranges.every((r) => r.start === 5)).toBe(true)
    expect(targets.appendSkill.ranges.every((r) => r.start === 3)).toBe(true)
  })

  it('does not throw when "all" is present but has no usable targets, and falls back to plain defaults', () => {
    const initialState = createChaldeaState(['1', '2'])
    const stored: ChaldeaState = {
      // Malformed / partial "all" entry -- no `targets` key at all.
      all: { disabled: false } as ServantState,
    }

    expect(() => mergeChaldeaState(initialState, stored)).not.toThrow()

    const merged = mergeChaldeaState(initialState, stored)
    for (const id of ['1', '2']) {
      expect(merged[id]).toEqual(initialState[id])
    }
  })

  it('resets start when a previously-owned, edited servant becomes disabled (individual toggle or ms-servants-io bulk-clear)', () => {
    // Both the individual "mark as unowned" toggle and ms-servants-io.tsx's
    // bulk-clear-import path produce the same shape on the next merge: the
    // servant's prior `targets` (including an edited `start`) are preserved
    // verbatim, but `disabled` flips to true. This single test covers both
    // call sites since mergeChaldeaState can't distinguish them.
    const initialState = createChaldeaState(['1'])
    const stored: ChaldeaState = {
      '1': {
        disabled: true,
        targets: {
          ascension: { disabled: false, ranges: [{ start: 4, end: 4 }] },
          skill: {
            disabled: false,
            ranges: [
              { start: 10, end: 10 },
              { start: 10, end: 10 },
              { start: 10, end: 10 },
            ],
          },
          appendSkill: {
            disabled: false,
            ranges: [
              { start: 10, end: 10 },
              { start: 10, end: 10 },
              { start: 10, end: 10 },
              { start: 10, end: 10 },
              { start: 10, end: 10 },
            ],
          },
        },
      },
    }

    const merged = mergeChaldeaState(initialState, stored)
    const targets = merged['1'].targets

    // start resets to the correct default despite having been an edited,
    // owned value moments before.
    expect(targets.ascension.ranges[0].start).toBe(0)
    expect(targets.skill.ranges.every((r) => r.start === 1)).toBe(true)
    expect(targets.appendSkill.ranges.every((r) => r.start === 0)).toBe(true)
    // end (and other data) from the prior owned state is preserved.
    expect(targets.ascension.ranges[0].end).toBe(4)
    expect(targets.skill.ranges.every((r) => r.end === 10)).toBe(true)
    expect(targets.appendSkill.ranges.every((r) => r.end === 10)).toBe(true)
  })

  it('does not throw and leaves stale IDs (removed from master data) untouched', () => {
    const initialState = createChaldeaState(['1'])
    const staleTargets: ServantState['targets'] = {
      ascension: { disabled: false, ranges: [{ start: 1, end: 4 }] },
      skill: {
        disabled: false,
        ranges: [
          { start: 1, end: 10 },
          { start: 1, end: 10 },
          { start: 1, end: 10 },
        ],
      },
      appendSkill: {
        disabled: false,
        ranges: [
          { start: 1, end: 10 },
          { start: 1, end: 10 },
          { start: 1, end: 10 },
          { start: 1, end: 10 },
          { start: 1, end: 10 },
        ],
      },
    }
    const stored: ChaldeaState = {
      'stale-id': { disabled: true, targets: staleTargets },
    }

    expect(() => mergeChaldeaState(initialState, stored)).not.toThrow()

    const merged = mergeChaldeaState(initialState, stored)
    expect(merged['stale-id'].targets).toEqual(staleTargets)
  })
})

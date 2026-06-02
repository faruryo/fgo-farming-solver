import { describe, it, expect } from 'vitest'
import { detectNewServants } from './tier'
import type { ChaldeaState, ServantState } from '../../hooks/create-chaldea-state'
import type { Rarity } from './rarity-ap-sample'

const servant = (disabled: boolean): ServantState => ({
  disabled,
  targets: {
    ascension: { disabled: false, ranges: [{ start: 0, end: 4 }] },
    skill: { disabled: false, ranges: [{ start: 1, end: 10 }] },
    appendSkill: { disabled: false, ranges: [{ start: 0, end: 10 }] },
  },
})

const rarityById = new Map<string, Rarity>([
  ['100100', 5],
  ['200200', 4],
])

describe('detectNewServants', () => {
  it('returns [] when the past snapshot has no chaldea state (material absent)', () => {
    const current: ChaldeaState = {
      '100100': servant(false),
      '200200': servant(false),
    }
    expect(detectNewServants(current, null, rarityById)).toEqual([])
  })

  it('returns [] when current is null', () => {
    const past: ChaldeaState = { '100100': servant(true) }
    expect(detectNewServants(null, past, rarityById)).toEqual([])
  })

  it('detects only servants that flipped disabled true -> false', () => {
    const past: ChaldeaState = {
      '100100': servant(true), // was disabled -> now enabled => new
      '200200': servant(false), // already enabled => not new
    }
    const current: ChaldeaState = {
      '100100': servant(false),
      '200200': servant(false),
    }
    const res = detectNewServants(current, past, rarityById)
    expect(res).toEqual([{ servantId: '100100', rarity: 5 }])
  })

  it('treats a servant missing from past (but enabled now) as new', () => {
    const past: ChaldeaState = { '200200': servant(false) }
    const current: ChaldeaState = {
      '100100': servant(false), // absent in past => new
      '200200': servant(false),
    }
    const res = detectNewServants(current, past, rarityById)
    expect(res).toEqual([{ servantId: '100100', rarity: 5 }])
  })

  it('ignores the "all" key and disabled current entries', () => {
    const past: ChaldeaState = {}
    const current: ChaldeaState = {
      all: servant(false),
      '100100': servant(true), // not owned now => not new
    }
    expect(detectNewServants(current, past, rarityById)).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { detectNewServants, classifyTier, classifyEffortTier } from './tier'
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

describe('classifyTier (5段階しきい値、design.md D2)', () => {
  const DAY = 1440
  it('0以下は none', () => {
    expect(classifyTier(0, DAY * 30)).toBe('none')
    expect(classifyTier(-5, DAY * 30)).toBe('none')
  })
  it('>0 は small', () => {
    expect(classifyTier(1, DAY * 30)).toBe('small')
    expect(classifyTier(4.9 * 30, DAY * 30)).toBe('small')
  })
  it('>=5周/日は medium', () => {
    expect(classifyTier(5 * 30, DAY * 30)).toBe('medium')
    expect(classifyTier(14.9 * 30, DAY * 30)).toBe('medium')
  })
  it('>=15周/日は large', () => {
    expect(classifyTier(15 * 30, DAY * 30)).toBe('large')
    expect(classifyTier(59.9 * 30, DAY * 30)).toBe('large')
  })
  it('>=60周/日は legendary', () => {
    expect(classifyTier(60 * 30, DAY * 30)).toBe('legendary')
    expect(classifyTier(1000 * 30, DAY * 30)).toBe('legendary')
  })
  it('経過時間0は正の値を large 扱いにする(legendary にはしない)', () => {
    expect(classifyTier(1, 0)).toBe('large')
    expect(classifyTier(0, 0)).toBe('none')
  })
})

describe('classifyEffortTier (前進ゼロ時の補完、design.md D4)', () => {
  const DAY = 1440
  it('しきい値は classifyTier と同じ', () => {
    expect(classifyEffortTier(0, DAY * 30)).toBe('none')
    expect(classifyEffortTier(2 * 30, DAY * 30)).toBe('small')
    expect(classifyEffortTier(10 * 30, DAY * 30)).toBe('medium')
  })
  it('legendary 相当(>=60周/日)でも補完では large を上限にキャップする', () => {
    expect(classifyEffortTier(90 * 30, DAY * 30)).toBe('large')
    expect(classifyEffortTier(1000 * 30, DAY * 30)).toBe('large')
  })
  it('large 未満はキャップの影響を受けない', () => {
    expect(classifyEffortTier(20 * 30, DAY * 30)).toBe('large')
  })
})

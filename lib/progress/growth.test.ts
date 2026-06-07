import { describe, it, expect } from 'vitest'
import { computeSkillLevelDelta } from './growth'
import type { ChaldeaState, ServantState } from '../../hooks/create-chaldea-state'

// スキル現在レベル(start)を指定してサーヴァント状態を作る。
const svt = (disabled: boolean, skills: number[]): ServantState =>
  ({
    disabled,
    targets: {
      ascension: { disabled: false, ranges: [{ start: 0, end: 4 }] },
      skill: { disabled: false, ranges: skills.map((s) => ({ start: s, end: 10 })) },
      appendSkill: { disabled: false, ranges: [{ start: 0, end: 10 }] },
    },
  }) as unknown as ServantState

const state = (entries: Record<string, ServantState>): ChaldeaState =>
  entries as unknown as ChaldeaState

describe('computeSkillLevelDelta', () => {
  it('既存サーヴァントのスキル上昇分を集計する', () => {
    const past = state({ '100100': svt(false, [1, 1, 1]) })
    const cur = state({ '100100': svt(false, [5, 3, 1]) })
    // (5+3+1) - (1+1+1) = 9 - 3 = 6
    expect(computeSkillLevelDelta(cur, past)).toBe(6)
  })

  it('新規入手サーヴァントのスキルも増分として含む(過去は未所持=0)', () => {
    const past = state({ '100100': svt(false, [10, 10, 10]) })
    const cur = state({
      '100100': svt(false, [10, 10, 10]),
      '205500': svt(false, [7, 8, 7]), // 新規・ウルズ相当
    })
    expect(computeSkillLevelDelta(cur, past)).toBe(22)
  })

  it('未所持(disabled=true)サーヴァントは数えない', () => {
    const past = state({ '205500': svt(true, [1, 1, 1]) })
    const cur = state({ '205500': svt(true, [9, 9, 9]) })
    expect(computeSkillLevelDelta(cur, past)).toBe(0)
  })

  it('null を安全に扱う', () => {
    expect(computeSkillLevelDelta(null, null)).toBe(0)
    expect(computeSkillLevelDelta(state({ '1': svt(false, [3]) }), null)).toBe(3)
  })

  it('all キーは無視する', () => {
    const cur = state({
      all: svt(false, [10, 10, 10]),
      '100100': svt(false, [2]),
    })
    expect(computeSkillLevelDelta(cur, null)).toBe(2)
  })
})

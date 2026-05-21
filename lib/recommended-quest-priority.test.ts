import { describe, it, expect } from 'vitest'
import { getRecommendedQuestPriorityLaps } from './recommended-quest-priority'

describe('getRecommendedQuestPriorityLaps', () => {
  it('returns tier 0 when quest is in pod-free Set', () => {
    const podFree = new Set(['Q1'])
    expect(getRecommendedQuestPriorityLaps({ id: 'Q1', area: '冠位戴冠戦：Saber' }, podFree)).toBe(0)
  })

  it('returns tier 1 for 冠位研鑽戦 when not pod-free', () => {
    expect(getRecommendedQuestPriorityLaps({ id: 'Q2', area: '冠位研鑽戦：Caster' }, new Set())).toBe(1)
  })

  it('returns tier 1 for 冠位戴冠戦 alias', () => {
    expect(getRecommendedQuestPriorityLaps({ id: 'Q3', area: '冠位戴冠戦：Berserker' }, new Set())).toBe(1)
  })

  it('returns tier 2 for オーディール・コール', () => {
    expect(getRecommendedQuestPriorityLaps({ id: 'Q4', area: 'オーディール・コール フリクエ' }, new Set())).toBe(2)
  })

  it('returns tier 3 for everything else', () => {
    expect(getRecommendedQuestPriorityLaps({ id: 'Q5', area: 'オルレアン' }, new Set())).toBe(3)
  })

  it('pod-free wins over 冠位研鑽戦 tier when active', () => {
    expect(getRecommendedQuestPriorityLaps({ id: 'Q1', area: '冠位研鑽戦' }, new Set(['Q1']))).toBe(0)
  })

  it('empty pod-free Set degrades to existing tiering (period-out behavior)', () => {
    expect(getRecommendedQuestPriorityLaps({ id: 'Q1', area: '冠位戴冠戦：Saber' }, new Set())).toBe(1)
    expect(getRecommendedQuestPriorityLaps({ id: 'Q2', area: 'オーディール・コール' }, new Set())).toBe(2)
    expect(getRecommendedQuestPriorityLaps({ id: 'Q3', area: 'その他' }, new Set())).toBe(3)
  })
})

import { describe, it, expect } from 'vitest'
import { questConsumesPod } from './quest-consumes-pod'

describe('questConsumesPod', () => {
  it('matches 冠位戴冠戦 areas', () => {
    expect(questConsumesPod('冠位戴冠戦：Saber')).toBe(true)
  })

  it('matches 冠位研鑽戦 areas', () => {
    expect(questConsumesPod('冠位研鑽戦：Caster')).toBe(true)
  })

  it('matches オーディール・コール areas', () => {
    expect(questConsumesPod('オーディール・コール フリークエスト')).toBe(true)
  })

  it('does not match unrelated areas', () => {
    expect(questConsumesPod('オルレアン')).toBe(false)
    expect(questConsumesPod('修練場')).toBe(false)
  })

  it('returns false for empty/null/undefined input', () => {
    expect(questConsumesPod('')).toBe(false)
    expect(questConsumesPod(null)).toBe(false)
    expect(questConsumesPod(undefined)).toBe(false)
  })
})

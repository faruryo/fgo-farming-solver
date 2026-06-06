import { describe, it, expect } from 'vitest'
import { selectMashuMessage } from './mashu-messages'
import type { PeriodSummary } from './types'

const base = (over: Partial<PeriodSummary> = {}): PeriodSummary => ({
  period: 'previous',
  tier: 'none',
  growthTotal: 0,
  newServantCount: 0,
  newServants: [],
  servantGrowth: [],
  elapsedMinutes: 100,
  fallback: null,
  ...over,
})

// 「お休みください」系(apProgress.none)は新規入手・育成のニュアンスを含まない。
// 歓迎/育成メッセージは「新」「育成/強化/成長」を含むことで区別できる。
const isRestMessage = (m: string): boolean =>
  /休んで|ここまで|進めなかった/.test(m)

describe('selectMashuMessage', () => {
  it('新規入手があれば tier=none でも歓迎メッセージ(休めメッセージにしない)', () => {
    for (let i = 0; i < 20; i++) {
      const m = selectMashuMessage(base({ newServantCount: 1, tier: 'none' }))
      expect(m).toContain('新')
      expect(isRestMessage(m)).toBe(false)
    }
  })

  it('育成総量があれば tier=none でも育成を労う(休めメッセージにしない)', () => {
    for (let i = 0; i < 20; i++) {
      const m = selectMashuMessage(base({ growthTotal: 3, tier: 'none' }))
      expect(isRestMessage(m)).toBe(false)
    }
  })

  it('進捗が無ければ tier=none の「お疲れさま」系を返す', () => {
    const m = selectMashuMessage(base({ tier: 'none' }))
    expect(typeof m).toBe('string')
    expect(m.length).toBeGreaterThan(0)
  })

  it('fallback が最優先される', () => {
    const m = selectMashuMessage(
      base({ fallback: 'first_time', newServantCount: 1 })
    )
    expect(m).toContain('先輩')
  })
})

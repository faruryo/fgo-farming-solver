import { describe, it, expect } from 'vitest'
import { selectMashuMessage } from './mashu-messages'
import type { PeriodSummary } from './types'

const base = (over: Partial<PeriodSummary> = {}): PeriodSummary => ({
  period: 'd30',
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

  it('tier=legendary は伝説級の称賛メッセージを返す(large 等とは異なる語彙)', () => {
    for (let i = 0; i < 20; i++) {
      const m = selectMashuMessage(
        base({ tier: 'legendary', forwardLaps: 3000, elapsedMinutes: 1440 * 30 })
      )
      expect(/伝説|歴代|語り継ぐ/.test(m)).toBe(true)
    }
  })

  it('労力修飾: 前進が medium 以下でも労力周回が large 相当以上なら備蓄・活動を労う', () => {
    // forwardLaps=0(方向性=none) だが effortLaps=90周/日相当(large 以上)。
    for (let i = 0; i < 20; i++) {
      const m = selectMashuMessage(
        base({
          tier: 'large', // finalize-baseline の補完により large になり得るが、修飾は方向性側で判定
          forwardLaps: 0,
          effortLaps: 2700,
          elapsedMinutes: 1440 * 30,
        })
      )
      expect(/たくさん動いた|備蓄|活動量/.test(m)).toBe(true)
    }
  })

  it('前進が large 以上(方向性が高い)なら労力が高くても修飾せず tier 別メッセージを使う', () => {
    const m = selectMashuMessage(
      base({
        tier: 'large',
        forwardLaps: 900, // 30周/日 → large
        effortLaps: 2700, // 90周/日 → large 以上だが方向性が高いので修飾しない
        elapsedMinutes: 1440 * 30,
      })
    )
    expect(/たくさん動いた|備蓄|活動量/.test(m)).toBe(false)
  })
})

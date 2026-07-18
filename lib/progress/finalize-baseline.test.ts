import { describe, it, expect } from 'vitest'
import { finalizeBaselineSummary } from './finalize-baseline'
import type { PeriodSummary } from './types'

const base = (over: Partial<PeriodSummary> = {}): PeriodSummary => ({
  period: 'd30',
  tier: 'none',
  growthTotal: 0,
  newServantCount: 0,
  newServants: [],
  servantGrowth: [],
  elapsedMinutes: 1440,
  fallback: null,
  pastPosession: { '6512': 10 },
  snapshotCreatedAt: '2026-06-06T17:04:00.000Z',
  ...over,
})

describe('finalizeBaselineSummary', () => {
  it('effortLaps があれば tier を付け zero_progress にしない(前進ゼロの補完)', () => {
    const f = finalizeBaselineSummary(base({ elapsedMinutes: 1440 }), {
      itemsFarmed: 57,
      itemsConsumed: 279,
      effortLaps: 60, // 60/日 → large 相当(補完でキャップされ large)
    })
    expect(f.tier).not.toBe('none')
    expect(f.fallback).toBeNull()
    expect(f.itemsFarmed).toBe(57)
    expect(f.itemsConsumed).toBe(279)
  })

  it('forwardLaps>0 のとき tier は前進周回/日(classifyTier)で判定する', () => {
    // 900周 / 30日: 30周/日 → large。
    const f = finalizeBaselineSummary(base({ elapsedMinutes: 1440 * 30 }), {
      itemsFarmed: 0,
      itemsConsumed: 0,
      forwardLaps: 900,
      forwardApEquivalent: 18000,
    })
    expect(f.tier).toBe('large')
    expect(f.fallback).toBeNull()
  })

  it('forwardLaps<=0 でも effortLaps があれば tier を補完(none 固定回避、large を上限)', () => {
    const f = finalizeBaselineSummary(base({ elapsedMinutes: 1440 * 30 }), {
      itemsFarmed: 60,
      itemsConsumed: 0,
      forwardLaps: 0,
      effortLaps: 2700, // 90周/日 → legendary 相当だが補完では large 止まり
    })
    expect(f.tier).toBe('large')
    expect(f.fallback).toBeNull()
  })

  it('全指標ゼロなら zero_progress(実比較済の印は保持)', () => {
    const f = finalizeBaselineSummary(base(), {
      itemsFarmed: 0,
      itemsConsumed: 0,
    })
    expect(f.tier).toBe('none')
    expect(f.fallback).toBe('zero_progress')
    // 実比較できた証跡(pastPosession / snapshotCreatedAt)は残す。
    expect(f.pastPosession).toBeDefined()
    expect(f.snapshotCreatedAt).toBe('2026-06-06T17:04:00.000Z')
  })

  it('育成/新規/forwardLaps のいずれかがあれば zero_progress にしない', () => {
    expect(
      finalizeBaselineSummary(base({ growthTotal: 2 }), {
        itemsFarmed: 0,
        itemsConsumed: 0,
      }).fallback
    ).toBeNull()
    expect(
      finalizeBaselineSummary(base({ newServantCount: 1 }), {
        itemsFarmed: 0,
        itemsConsumed: 0,
      }).fallback
    ).toBeNull()
    expect(
      finalizeBaselineSummary(base(), {
        itemsFarmed: 0,
        itemsConsumed: 0,
        forwardLaps: 120,
      }).fallback
    ).toBeNull()
  })

  it('forwardYen は forwardApEquivalent があるときだけ算出する', () => {
    expect(
      finalizeBaselineSummary(base(), {
        itemsFarmed: 1,
        itemsConsumed: 0,
        forwardLaps: 42,
        forwardApEquivalent: 1680,
      }).forwardYen
    ).toBeGreaterThan(0)
    expect(
      finalizeBaselineSummary(base(), { itemsFarmed: 1, itemsConsumed: 0 })
        .forwardYen
    ).toBeUndefined()
  })
})

// 旧「enriched→panel ラウンドトリップ」回帰テストは D2b(hook一本化)で選定が1箇所に
// 統合されたため削除。同等の懸念(変化ゼロでも no_snapshot に落ちない)は
// select-baseline.test.ts の selectBestWindow テストでカバーする。

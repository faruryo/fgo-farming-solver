import { describe, it, expect } from 'vitest'
import { finalizeBaselineSummary } from './finalize-baseline'
import { selectBaseline } from './select-baseline'
import type { PeriodSummary, ProgressResponse } from './types'

const base = (over: Partial<PeriodSummary> = {}): PeriodSummary => ({
  period: 'previous',
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
    // 450周 / 30日: 15周/日 → large。
    const f = finalizeBaselineSummary(base({ elapsedMinutes: 1440 * 30 }), {
      itemsFarmed: 0,
      itemsConsumed: 0,
      forwardLaps: 450,
      forwardApEquivalent: 9000,
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

describe('enriched→panel ラウンドトリップ(回帰: 変化ゼロで no_snapshot 誤表示を防ぐ)', () => {
  it('変化ゼロの日でも、最古の no_snapshot ではなく実比較済 previous を表示する', () => {
    // サーバ応答: previous=実比較可能(06-06), week/month=該当スナップショット無し。
    const serverPeriods: ProgressResponse['periods'] = {
      previous: base({ period: 'previous' }),
      week: {
        period: 'week',
        tier: 'none',
        growthTotal: 0,
        newServantCount: 0,
        newServants: [],
        servantGrowth: [],
        elapsedMinutes: 0,
        fallback: 'no_snapshot_for_period',
        snapshotCreatedAt: null,
      },
      month: {
        period: 'month',
        tier: 'none',
        growthTotal: 0,
        newServantCount: 0,
        newServants: [],
        servantGrowth: [],
        elapsedMinutes: 0,
        fallback: 'no_snapshot_for_period',
        snapshotCreatedAt: null,
      },
    }

    // 1) フックが baseline を選ぶ → previous。
    const hookBaseline = selectBaseline(serverPeriods)
    expect(hookBaseline?.period).toBe('previous')

    // 2) フックが enriched で変化ゼロを確定 → previous に zero_progress を付与。
    const finalized = finalizeBaselineSummary(hookBaseline!, {
      itemsFarmed: 0,
      itemsConsumed: 0,
    })
    expect(finalized.fallback).toBe('zero_progress')
    const enrichedPeriods = { ...serverPeriods, previous: finalized }

    // 3) パネルが enriched で再度 selectBaseline → 最古の month(no_snapshot)へ
    //    落ちず、実比較済の previous(zero_progress)を返すこと。
    const panelBaseline = selectBaseline(enrichedPeriods)
    expect(panelBaseline?.period).toBe('previous')
    expect(panelBaseline?.fallback).toBe('zero_progress')
  })
})

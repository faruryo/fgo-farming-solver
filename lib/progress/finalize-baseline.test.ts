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
  it('スループットがあれば tier を付け zero_progress にしない', () => {
    const f = finalizeBaselineSummary(base(), {
      itemsFarmed: 57,
      itemsConsumed: 279,
    })
    expect(f.tier).not.toBe('none')
    expect(f.fallback).toBeNull()
    expect(f.itemsFarmed).toBe(57)
    expect(f.itemsConsumed).toBe(279)
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

  it('育成/新規/reducedAp のいずれかがあれば zero_progress にしない', () => {
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
        reducedAp: 120,
      }).fallback
    ).toBeNull()
  })

  it('reducedYen は reducedAp があるときだけ算出する', () => {
    expect(
      finalizeBaselineSummary(base(), {
        itemsFarmed: 1,
        itemsConsumed: 0,
        reducedAp: 1680,
      }).reducedYen
    ).toBeGreaterThan(0)
    expect(
      finalizeBaselineSummary(base(), { itemsFarmed: 1, itemsConsumed: 0 })
        .reducedYen
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

import { describe, it, expect } from 'vitest'
import { selectBaseline } from './select-baseline'
import type { PeriodSummary } from './types'

const mk = (
  period: PeriodSummary['period'],
  fallback: PeriodSummary['fallback'] = null
): PeriodSummary => ({
  period,
  tier: 'none',
  growthTotal: 0,
  newServantCount: 0,
  newServants: [],
  servantGrowth: [],
  elapsedMinutes: 0,
  fallback,
  snapshotCreatedAt: fallback ? null : '2026-05-03T00:00:00.000Z',
})

describe('selectBaseline (最古の存在スナップショット優先)', () => {
  it('全期間に実データがあれば最古(1ヶ月前)を選ぶ', () => {
    const b = selectBaseline({ previous: mk('previous'), week: mk('week'), month: mk('month') })
    expect(b?.period).toBe('month')
  })

  it('1ヶ月前が無ければ1週間前→前回の順で存在する最古を選ぶ', () => {
    const b = selectBaseline({
      previous: mk('previous'),
      week: mk('week'),
      month: mk('month', 'no_snapshot_for_period'),
    })
    expect(b?.period).toBe('week')

    const b2 = selectBaseline({
      previous: mk('previous'),
      week: mk('week', 'no_snapshot_for_period'),
      month: mk('month', 'no_snapshot_for_period'),
    })
    expect(b2?.period).toBe('previous')
  })

  it('実データが無ければ最古期間のフォールバックを返す(メッセージ用)', () => {
    const b = selectBaseline({
      previous: mk('previous', 'first_time'),
      week: mk('week', 'first_time'),
      month: mk('month', 'first_time'),
    })
    expect(b?.period).toBe('month')
    expect(b?.fallback).toBe('first_time')
  })

  it('periods が無ければ null', () => {
    expect(selectBaseline(null)).toBeNull()
    expect(selectBaseline(undefined)).toBeNull()
  })

  it('中身の無い(degenerate)最古期間より、比較に使える新しい期間を優先する', () => {
    // 本番再現: week が material/posession を持たない残骸(fallback 無し・中身ゼロ)、
    // previous が pastPosession を持つフルデータ。previous を採用すべき。
    const degenerateWeek = mk('week') // growthTotal 0 / pastPosession なし
    const richPrevious: PeriodSummary = {
      ...mk('previous'),
      pastPosession: { '6512': 10 },
    }
    const b = selectBaseline({
      previous: richPrevious,
      week: degenerateWeek,
      month: mk('month', 'no_snapshot_for_period'),
    })
    expect(b?.period).toBe('previous')
  })

  it('material 由来の進捗(育成総量)を持つ期間も比較対象として採用する', () => {
    const growthOnlyWeek: PeriodSummary = { ...mk('week'), growthTotal: 3 }
    const b = selectBaseline({
      previous: mk('previous'),
      week: growthOnlyWeek,
      month: mk('month', 'no_snapshot_for_period'),
    })
    expect(b?.period).toBe('week')
  })

  it('使える中身が無く全て fallback 無しなら、従来どおり最古を返す(後方互換)', () => {
    const b = selectBaseline({
      previous: mk('previous'),
      week: mk('week'),
      month: mk('month'),
    })
    expect(b?.period).toBe('month')
  })
})

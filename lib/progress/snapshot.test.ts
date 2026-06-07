import { describe, it, expect } from 'vitest'
import { selectBaselineRow } from './snapshot'

// nowMs を固定して「約1ヶ月前(30日前)に最も近い」行が選ばれることを検証する。
const NOW = new Date('2026-06-07T00:00:00.000Z').getTime()
const row = (created_at: string) => ({ created_at })

describe('selectBaselineRow (約1ヶ月前に最も近い baseline 選定)', () => {
  it('空配列は null', () => {
    expect(selectBaselineRow([], NOW)).toBeNull()
  })

  it('全データが直近(<1ヶ月)なら最も古いものを選ぶ(最長比較)', () => {
    // 今日=06-07。手持ち 06-02 / 06-03 / 06-06 はいずれも30日前(05-08)より新しい。
    // 30日前に最も近い=最古の 06-02。
    const rows = [row('2026-06-06 17:04:43'), row('2026-06-03 14:55:46'), row('2026-06-02 16:47:09')]
    expect(selectBaselineRow(rows, NOW)?.created_at).toBe('2026-06-02 16:47:09')
  })

  it('30日前をまたぐ場合は30日前に最も近いものを選ぶ', () => {
    // 30日前 ≈ 05-08。候補: 05-05(3日前寄り) / 05-10(2日後寄り) / 06-02。
    const rows = [row('2026-06-02 00:00:00'), row('2026-05-10 00:00:00'), row('2026-05-05 00:00:00')]
    // |05-10 - 05-08| = 2日 < |05-05 - 05-08| = 3日 → 05-10。
    expect(selectBaselineRow(rows, NOW)?.created_at).toBe('2026-05-10 00:00:00')
  })

  it('1ヶ月より大幅に古いデータしか無ければ、その中で30日前に最も近い(=最新)を選ぶ', () => {
    // 候補が全て1ヶ月超: 03-01 / 04-01。30日前(05-08)に近いのは 04-01。
    const rows = [row('2026-04-01 00:00:00'), row('2026-03-01 00:00:00')]
    expect(selectBaselineRow(rows, NOW)?.created_at).toBe('2026-04-01 00:00:00')
  })

  it('不正な日付は無視する', () => {
    const rows = [row('not-a-date'), row('2026-06-02 16:47:09')]
    expect(selectBaselineRow(rows, NOW)?.created_at).toBe('2026-06-02 16:47:09')
  })
})

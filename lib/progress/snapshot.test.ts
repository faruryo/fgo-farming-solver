import { describe, it, expect } from 'vitest'
import { selectBaselineRow, fetchAllSnapshotsByPeriod } from './snapshot'
import type { D1Database } from '@cloudflare/workers-types'

// nowMs を固定して「targetMs に最も近い」行が選ばれることを検証する。
const NOW = new Date('2026-06-07T00:00:00.000Z').getTime()
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000
const TARGET_30D = NOW - ONE_MONTH_MS
const row = (created_at: string) => ({ created_at })

describe('selectBaselineRow (targetMs に最も近い baseline 選定)', () => {
  it('空配列は null', () => {
    expect(selectBaselineRow([], TARGET_30D)).toBeNull()
  })

  it('全データが直近(<1ヶ月)なら最も古いものを選ぶ(最長比較)', () => {
    // 今日=06-07。手持ち 06-02 / 06-03 / 06-06 はいずれも30日前(05-08)より新しい。
    // 30日前に最も近い=最古の 06-02。
    const rows = [row('2026-06-06 17:04:43'), row('2026-06-03 14:55:46'), row('2026-06-02 16:47:09')]
    expect(selectBaselineRow(rows, TARGET_30D)?.created_at).toBe('2026-06-02 16:47:09')
  })

  it('30日前をまたぐ場合は30日前に最も近いものを選ぶ', () => {
    // 30日前 ≈ 05-08。候補: 05-05(3日前寄り) / 05-10(2日後寄り) / 06-02。
    const rows = [row('2026-06-02 00:00:00'), row('2026-05-10 00:00:00'), row('2026-05-05 00:00:00')]
    // |05-10 - 05-08| = 2日 < |05-05 - 05-08| = 3日 → 05-10。
    expect(selectBaselineRow(rows, TARGET_30D)?.created_at).toBe('2026-05-10 00:00:00')
  })

  it('1ヶ月より大幅に古いデータしか無ければ、その中で30日前に最も近い(=最新)を選ぶ', () => {
    // 候補が全て1ヶ月超: 03-01 / 04-01。30日前(05-08)に近いのは 04-01。
    const rows = [row('2026-04-01 00:00:00'), row('2026-03-01 00:00:00')]
    expect(selectBaselineRow(rows, TARGET_30D)?.created_at).toBe('2026-04-01 00:00:00')
  })

  it('不正な日付は無視する', () => {
    const rows = [row('not-a-date'), row('2026-06-02 16:47:09')]
    expect(selectBaselineRow(rows, TARGET_30D)?.created_at).toBe('2026-06-02 16:47:09')
  })

  it('targetMs を60日前に変えると60日前に最も近い行を選ぶ', () => {
    const target60 = NOW - 60 * 24 * 60 * 60 * 1000
    // 60日前 ≈ 04-08。候補: 06-02 / 04-10 / 03-01。04-10 が最も近い。
    const rows = [row('2026-06-02 00:00:00'), row('2026-04-10 00:00:00'), row('2026-03-01 00:00:00')]
    expect(selectBaselineRow(rows, target60)?.created_at).toBe('2026-04-10 00:00:00')
  })
})

// D1Database の最小モック: prepare().bind().all() チェーンのみ提供する。
const makeMockDb = (
  rows: { id: string; user_id: string; data: string; created_at: string }[]
): D1Database =>
  ({
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: rows }),
      }),
    }),
  }) as unknown as D1Database

describe('fetchAllSnapshotsByPeriod (30/60/90日それぞれの候補選定)', () => {
  it('30/60/90日それぞれ異なるスナップショットに解決する', async () => {
    const db = makeMockDb([
      { id: 'u1:2026-06-06', user_id: 'u1', data: '{"posession":{}}', created_at: '2026-06-06T00:00:00.000Z' },
      { id: 'u1:2026-05-08', user_id: 'u1', data: '{"posession":{}}', created_at: '2026-05-08T00:00:00.000Z' },
      { id: 'u1:2026-04-08', user_id: 'u1', data: '{"posession":{}}', created_at: '2026-04-08T00:00:00.000Z' },
      { id: 'u1:2026-03-09', user_id: 'u1', data: '{"posession":{}}', created_at: '2026-03-09T00:00:00.000Z' },
    ])

    const result = await fetchAllSnapshotsByPeriod(db, 'u1', NOW)

    // 30日前 ≈ 05-08, 60日前 ≈ 04-08, 90日前 ≈ 03-09。
    expect(result.d30?.id).toBe('u1:2026-05-08')
    expect(result.d60?.id).toBe('u1:2026-04-08')
    expect(result.d90?.id).toBe('u1:2026-03-09')
  })

  it('データが少なく全ターゲットが同一の最古スナップショットに解決する', async () => {
    const db = makeMockDb([
      { id: 'u1:2026-06-06', user_id: 'u1', data: '{"posession":{}}', created_at: '2026-06-06T00:00:00.000Z' },
    ])

    const result = await fetchAllSnapshotsByPeriod(db, 'u1', NOW)

    expect(result.d30?.id).toBe('u1:2026-06-06')
    expect(result.d60?.id).toBe('u1:2026-06-06')
    expect(result.d90?.id).toBe('u1:2026-06-06')
    // 同一行への複数解決は JSON.parse を1回だけ実行して使い回す(同一オブジェクト参照)。
    expect(result.d60).toBe(result.d30)
    expect(result.d90).toBe(result.d30)
  })

  it('スナップショットが無ければ全て null', async () => {
    const db = makeMockDb([])
    const result = await fetchAllSnapshotsByPeriod(db, 'u1', NOW)
    expect(result).toEqual({ d30: null, d60: null, d90: null })
  })
})

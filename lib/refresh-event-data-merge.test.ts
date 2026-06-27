/**
 * lib/refresh-event-data-merge.test.ts
 *
 * 蓄積マージ純粋ロジックの単体テスト（vitest）。
 * 温存・upsert上書き・ソート・差分なし判定・空入力境界・BACKFILL_SINCE パース。
 */
import { describe, it, expect } from 'vitest'
import type { EventPlannerEvent } from './master-data/types'
import {
  eventsUnchanged,
  mergeEvents,
  parseBackfillSince,
  parseExistingEvents,
} from './refresh-event-data-merge'

/** テスト用の最小 EventPlannerEvent（差分検出に効く name を可変に）。 */
function ev(id: number, startedAt: number, name = `e${id}`): EventPlannerEvent {
  return {
    id,
    name,
    type: 'eventQuest',
    startedAt,
    endedAt: startedAt + 1000,
    currency: { id: 1, name: 'c', icon: '' },
    unlimitedBoxes: true,
    lotteries: [],
    shop: [],
    farmingNodes: [],
  }
}

describe('mergeEvents', () => {
  it('取り込み窓の外の過去イベントを温存する', () => {
    const existing = [ev(10, 100), ev(20, 200)]
    const fresh = [ev(20, 200)] // 今回フェッチには 10 が含まれない
    const merged = mergeEvents(existing, fresh)
    expect(merged.map(e => e.id)).toEqual([10, 20])
  })

  it('同一 id は新データで upsert（新優先）する', () => {
    const existing = [ev(10, 100, 'old')]
    const fresh = [ev(10, 100, 'new')]
    const merged = mergeEvents(existing, fresh)
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('new')
  })

  it('新規イベントを追加する', () => {
    const existing = [ev(10, 100)]
    const fresh = [ev(30, 300)]
    const merged = mergeEvents(existing, fresh)
    expect(merged.map(e => e.id)).toEqual([10, 30])
  })

  it('startedAt 昇順（同値は id 昇順）で安定ソートする', () => {
    const existing = [ev(30, 300), ev(10, 100)]
    const fresh = [ev(20, 100), ev(5, 100)] // startedAt=100 が複数
    const merged = mergeEvents(existing, fresh)
    expect(merged.map(e => e.id)).toEqual([5, 10, 20, 30])
  })

  it('空入力境界: 既存空・フェッチ空 → 空', () => {
    expect(mergeEvents([], [])).toEqual([])
  })

  it('空入力境界: 既存空 → フェッチ分のみ', () => {
    const merged = mergeEvents([], [ev(1, 10), ev(2, 5)])
    expect(merged.map(e => e.id)).toEqual([2, 1])
  })
})

describe('eventsUnchanged', () => {
  it('マージ結果が既存と同一なら true（既存が未ソートでも正規化して比較）', () => {
    const existing = [ev(30, 300), ev(10, 100)] // 未ソート
    const merged = mergeEvents(existing, [])
    expect(eventsUnchanged(existing, merged)).toBe(true)
  })

  it('内容が変わったら false（upsert で name 更新）', () => {
    const existing = [ev(10, 100, 'old')]
    const merged = mergeEvents(existing, [ev(10, 100, 'new')])
    expect(eventsUnchanged(existing, merged)).toBe(false)
  })

  it('新規追加があれば false', () => {
    const existing = [ev(10, 100)]
    const merged = mergeEvents(existing, [ev(20, 200)])
    expect(eventsUnchanged(existing, merged)).toBe(false)
  })
})

describe('parseExistingEvents', () => {
  it('正常な EventData JSON から events を返す', () => {
    const raw = JSON.stringify({ events: [ev(1, 10)], updatedAt: 0 })
    expect(parseExistingEvents(raw).map(e => e.id)).toEqual([1])
  })

  it('undefined / 空文字 / 空白のみ → 空配列', () => {
    expect(parseExistingEvents(undefined)).toEqual([])
    expect(parseExistingEvents('')).toEqual([])
    expect(parseExistingEvents('   \n')).toEqual([])
  })

  it('不正 JSON → 空配列（既存なし扱い）', () => {
    expect(parseExistingEvents('{not json')).toEqual([])
  })

  it('events 配列が無い → 空配列', () => {
    expect(parseExistingEvents('{"updatedAt":0}')).toEqual([])
    expect(parseExistingEvents('null')).toEqual([])
  })

  describe('strict モード', () => {
    it('空・空白・undefined はベース無しとして throw せず空配列', () => {
      expect(parseExistingEvents(undefined, { strict: true })).toEqual([])
      expect(parseExistingEvents('', { strict: true })).toEqual([])
      expect(parseExistingEvents('   \n', { strict: true })).toEqual([])
    })

    it('非空だが不正 JSON は throw する（履歴上書き防止）', () => {
      expect(() => parseExistingEvents('{not json', { strict: true })).toThrow()
    })

    it('非空だが events 配列が無いと throw する', () => {
      expect(() => parseExistingEvents('{"updatedAt":0}', { strict: true })).toThrow()
      expect(() => parseExistingEvents('null', { strict: true })).toThrow()
    })

    it('正常な EventData は strict でもパースできる', () => {
      const raw = JSON.stringify({ events: [ev(1, 10)], updatedAt: 0 })
      expect(parseExistingEvents(raw, { strict: true }).map(e => e.id)).toEqual([1])
    })
  })
})

describe('parseBackfillSince', () => {
  it('未指定・空 → undefined（従来窓を使う）', () => {
    expect(parseBackfillSince(undefined)).toBeUndefined()
    expect(parseBackfillSince('')).toBeUndefined()
    expect(parseBackfillSince('  ')).toBeUndefined()
  })

  it('Unix 秒（全桁数字）をそのまま秒として返す', () => {
    expect(parseBackfillSince('1600000000')).toBe(1600000000)
  })

  it('ISO 日付を Unix 秒に変換する', () => {
    expect(parseBackfillSince('2020-01-01T00:00:00Z')).toBe(
      Math.floor(Date.parse('2020-01-01T00:00:00Z') / 1000)
    )
  })

  it('無効値 → undefined', () => {
    expect(parseBackfillSince('not-a-date')).toBeUndefined()
  })
})

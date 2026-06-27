/**
 * KV (`event_data_json`) からイベントデータを読み込む。
 * ローカル開発時は `mocks/events.json` にフォールバックする。
 *
 * 本番は KV をそのまま返す。ローカル開発（KV 不在）でモックを使うときだけ、
 * 「常にボックスイベント開催中」に見せるため最新イベントの会期を now 基準へシフトする。
 */

import type { EventData, EventPlannerEvent } from './master-data/types'
import { kvGetJson, readLocalJson } from './data-source'

const EVENT_DATA_KEY = 'event_data_json'
const MOCK_PATH = 'mocks/events.json'

const EMPTY: EventData = { events: [], updatedAt: 0 }

// ローカル開発でモックを使うとき、最も新しいイベント 1 件を常に「開催中」に
// 見せるための会期シフト窓（開始は過去 7 日、終了は未来 21 日）。静的 JSON の
// 固定日付だと時間経過で開催中でなくなるため、読み込み時に now 基準へ動かす。
const DEV_ACTIVE_PAST_SEC = 7 * 24 * 60 * 60
const DEV_ACTIVE_FUTURE_SEC = 21 * 24 * 60 * 60

/**
 * モックデータの「最も新しい（endedAt 最大）」イベント 1 件を、現在時刻をまたぐ
 * 会期へ書き換えて常に開催中にする。残りのイベントは実日付（過去）のまま終了済み。
 * 本番（KV ヒット）のデータには一切適用しない。
 */
const withAlwaysActiveDemoEvent = (data: EventData): EventData => {
  if (data.events.length === 0) return data
  const now = Math.floor(Date.now() / 1000)
  let newestIdx = 0
  for (let i = 1; i < data.events.length; i++) {
    if (data.events[i].endedAt > data.events[newestIdx].endedAt) newestIdx = i
  }
  const events = data.events.map((e, i) =>
    i === newestIdx
      ? { ...e, startedAt: now - DEV_ACTIVE_PAST_SEC, endedAt: now + DEV_ACTIVE_FUTURE_SEC }
      : e
  )
  return { ...data, events }
}

/**
 * KV またはローカルモックから EventData を返す。
 * KV にもモックにもデータがない場合は空の EventData を返す（エラーにしない）。
 */
export const getEvents = async (): Promise<EventData> => {
  // 本番: KV にヒットしたらそのまま返す（日付を一切いじらない）。
  const fromKv = await kvGetJson<EventData>(EVENT_DATA_KEY)
  if (fromKv) {
    return { events: fromKv.events ?? [], updatedAt: fromKv.updatedAt ?? 0 }
  }
  // ローカル開発: モックを読み、最新イベントを常に開催中へシフトして返す。
  const fromMock = await readLocalJson<EventData>(MOCK_PATH)
  if (!fromMock) return EMPTY
  const shifted = withAlwaysActiveDemoEvent(fromMock)
  return { events: shifted.events ?? [], updatedAt: shifted.updatedAt ?? 0 }
}

/**
 * 現在開催中のロト型イベントだけを返す。
 * @param nowSec 現在時刻（Unix 秒）。省略時は Date.now() を使用。
 */
export const getActiveEvents = async (nowSec?: number): Promise<EventPlannerEvent[]> => {
  const { events } = await getEvents()
  const now = nowSec ?? Math.floor(Date.now() / 1000)
  return events.filter(e => e.startedAt <= now && e.endedAt >= now)
}

/**
 * イベント ID で単一イベントを取得する。見つからない場合は null。
 */
export const getEventById = async (id: number): Promise<EventPlannerEvent | null> => {
  const { events } = await getEvents()
  return events.find(e => e.id === id) ?? null
}

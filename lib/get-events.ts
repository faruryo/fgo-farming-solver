/**
 * KV (`event_data_json`) からイベントデータを読み込む。
 * ローカル開発時は `mocks/events.json` にフォールバックする。
 *
 * パターンは `lib/get-drops.ts` と同じ `fetchData(KEY, MOCK_PATH)` を踏襲する。
 */

import type { EventData, EventPlannerEvent } from './master-data/types'
import { fetchData } from './data-source'

const EVENT_DATA_KEY = 'event_data_json'
const MOCK_PATH = 'mocks/events.json'

const EMPTY: EventData = { events: [], updatedAt: 0 }

/**
 * KV またはローカルモックから EventData を返す。
 * KV にもモックにもデータがない場合は空の EventData を返す（エラーにしない）。
 */
export const getEvents = async (): Promise<EventData> => {
  const data = await fetchData<EventData>(EVENT_DATA_KEY, MOCK_PATH)
  if (!data) return EMPTY
  return {
    events: data.events ?? [],
    updatedAt: data.updatedAt ?? 0,
  }
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

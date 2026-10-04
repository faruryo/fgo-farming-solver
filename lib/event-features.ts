/**
 * lib/event-features.ts
 *
 * イベント機能レジストリ（data/event-features.ts）と KV のロト型イベントを合成する純粋関数群。
 */

import { EVENT_FEATURES } from '../data/event-features'
import type { EventFeature, EventFeatureEntry } from '../data/event-features'
import type { EventPlannerEvent } from './master-data/types'

export type EventSummary = Pick<EventPlannerEvent, 'id' | 'name' | 'startedAt' | 'endedAt'>

export type EventSummaryWithFeatures = EventSummary & { features: EventFeature[] }

type Registry = Record<number, EventFeatureEntry>

/** レジストリの features と、KV にロト型データがあるときの 'box' の和集合（box が先、重複なし）。 */
export const featuresFor = (
  id: number,
  hasKvBox: boolean,
  registry: Registry = EVENT_FEATURES,
): EventFeature[] => {
  const features = new Set<EventFeature>(hasKvBox ? ['box'] : [])
  const entry: EventFeatureEntry | undefined = Reflect.get(registry, id)
  for (const f of entry?.features ?? []) features.add(f)
  return [...features]
}

/**
 * KV イベントとレジストリ登録イベントの和集合を ID 重複なしで返す。
 * 同一 ID は KV の名前・会期を優先する。並び順は変えない（KV 順 → レジストリのみ分）。
 */
export const mergeEventList = (
  kvEvents: EventPlannerEvent[],
  registry: Registry = EVENT_FEATURES,
): EventSummaryWithFeatures[] => {
  const merged: EventSummaryWithFeatures[] = []
  const seen = new Set<number>()
  for (const { id, name, startedAt, endedAt } of kvEvents) {
    if (seen.has(id)) continue
    seen.add(id)
    merged.push({ id, name, startedAt, endedAt, features: featuresFor(id, true, registry) })
  }
  for (const [key, { meta }] of Object.entries(registry)) {
    const id = Number(key)
    if (seen.has(id)) continue
    merged.push({ id, ...meta, features: featuresFor(id, false, registry) })
  }
  return merged
}

/** イベントページのヘッダー用。KV があれば KV の名前・会期、無ければレジストリ meta（mergeEventList と同じ優先順位）。 */
export const resolveEventSummary = (
  id: number,
  kvEvent: EventPlannerEvent | null | undefined,
  registry: Registry = EVENT_FEATURES,
): EventSummary | undefined => {
  if (kvEvent) {
    const { name, startedAt, endedAt } = kvEvent
    return { id, name, startedAt, endedAt }
  }
  const entry: EventFeatureEntry | undefined = Reflect.get(registry, id)
  return entry && { id, ...entry.meta }
}

export const latestCraftEventId = (registry: Registry = EVENT_FEATURES): number | undefined => {
  let best: { id: number; endedAt: number } | undefined
  for (const [key, { features, meta }] of Object.entries(registry)) {
    if (features.includes('craft') && (!best || meta.endedAt > best.endedAt)) {
      best = { id: Number(key), endedAt: meta.endedAt }
    }
  }
  return best?.id
}

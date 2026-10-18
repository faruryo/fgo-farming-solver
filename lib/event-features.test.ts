import { describe, it, expect } from 'vitest'
import { EVENT_FEATURES } from '../data/event-features'
import type { EventFeatureEntry } from '../data/event-features'
import type { EventPlannerEvent } from './master-data/types'
import { featuresFor, mergeEventList, latestCraftEventId, resolveEventSummary } from './event-features'

const lotteries = [{ boxIndex: 0, costPerBox: 1, contents: [], rareRewards: [] }]
const shop = [{ itemId: 1, qty: 1, costItemId: 2, costAmount: 1, limitNum: 1 }]

const kv = (
  id: number,
  name: string,
  { box = true, withShop = false }: { box?: boolean; withShop?: boolean } = {},
  startedAt = 100,
  endedAt = 200,
): EventPlannerEvent =>
  ({ id, name, startedAt, endedAt, lotteries: box ? lotteries : [], shop: withShop ? shop : [] }) as Partial<EventPlannerEvent> as EventPlannerEvent

const reg = (features: EventFeatureEntry['features'], name = 'REG', startedAt = 10, endedAt = 20): EventFeatureEntry => ({
  features,
  meta: { name, startedAt, endedAt },
})

describe('EVENT_FEATURES', () => {
  it('meta は必須プロパティ（欠落は型エラー）', () => {
    // @ts-expect-error meta を欠いたエントリは禁止
    const invalid: EventFeatureEntry = { features: ['craft'] }
    expect(invalid).toBeDefined()
  })

  it.each(Object.entries(EVENT_FEATURES))('%s: startedAt < endedAt', (_id, { meta }) => {
    expect(meta.startedAt).toBeLessThan(meta.endedAt)
  })
})

describe('featuresFor', () => {
  const registry = { 1: reg(['craft']), 2: reg(['box', 'craft']) }
  it.each([
    ['KV ロトのみ', 9, kv(9, 'k'), ['box']],
    ['KV 交換所のみ', 9, kv(9, 'k', { box: false, withShop: true }), ['shop']],
    ['KV ロトと交換所（box が先）', 9, kv(9, 'k', { withShop: true }), ['box', 'shop']],
    ['KV なしレジストリのみ', 1, undefined, ['craft']],
    ['KV 交換所とレジストリ', 1, kv(1, 'k', { box: false, withShop: true }), ['shop', 'craft']],
    ['KV とレジストリ（box が先）', 1, kv(1, 'k'), ['box', 'craft']],
    ['重複なし', 2, kv(2, 'k'), ['box', 'craft']],
    ['KV にロトも交換所も無い', 9, kv(9, 'k', { box: false }), []],
    ['どちらも無し', 9, null, []],
  ] as const)('%s', (_label, id, kvEvent, expected) => {
    expect(featuresFor(id, kvEvent, registry)).toEqual(expected)
  })
})

describe('mergeEventList', () => {
  it('KV のみ: box 付きで KV meta', () => {
    expect(mergeEventList([kv(1, 'KV')], {})).toEqual([
      { id: 1, name: 'KV', startedAt: 100, endedAt: 200, features: ['box'] },
    ])
  })

  it('レジストリのみ: registry meta から組み立てる', () => {
    expect(mergeEventList([], { 2: reg(['craft']) })).toEqual([
      { id: 2, name: 'REG', startedAt: 10, endedAt: 20, features: ['craft'] },
    ])
  })

  it('KV の交換所のみのイベント: shop 付き', () => {
    expect(mergeEventList([kv(4, 'SHOP', { box: false, withShop: true })], {})).toEqual([
      { id: 4, name: 'SHOP', startedAt: 100, endedAt: 200, features: ['shop'] },
    ])
  })

  it('両方: KV meta 優先・features 和集合・ID 重複なし', () => {
    const merged = mergeEventList([kv(3, 'KV')], { 3: reg(['craft']) })
    expect(merged).toEqual([
      { id: 3, name: 'KV', startedAt: 100, endedAt: 200, features: ['box', 'craft'] },
    ])
  })

  it('どちらも無し: 空', () => {
    expect(mergeEventList([], {})).toEqual([])
  })

  it('KV 内の同一 ID は 1 件にまとめる', () => {
    expect(mergeEventList([kv(1, 'a'), kv(1, 'b')], {})).toHaveLength(1)
  })
})

describe('resolveEventSummary', () => {
  const registry = { 3: reg(['craft']) }
  it.each([
    ['KV のみ', 1, kv(1, 'KV'), { id: 1, name: 'KV', startedAt: 100, endedAt: 200 }],
    ['レジストリのみ', 3, null, { id: 3, name: 'REG', startedAt: 10, endedAt: 20 }],
    ['両方: KV 優先', 3, kv(3, 'KV'), { id: 3, name: 'KV', startedAt: 100, endedAt: 200 }],
    ['どちらも無し', 9, null, undefined],
  ] as const)('%s', (_label, id, kvEvent, expected) => {
    expect(resolveEventSummary(id, kvEvent, registry)).toEqual(expected)
  })
})

describe('latestCraftEventId', () => {
  it('craft を持つもののうち endedAt 最大', () => {
    expect(
      latestCraftEventId({
        1: reg(['craft'], 'a', 1, 50),
        2: reg(['craft'], 'b', 1, 90),
        3: reg(['box'], 'c', 1, 999),
      }),
    ).toBe(2)
  })

  it('craft が無ければ undefined', () => {
    expect(latestCraftEventId({ 3: reg(['box']) })).toBeUndefined()
  })

  it('既定レジストリでは 80614', () => {
    expect(latestCraftEventId()).toBe(80614)
  })
})

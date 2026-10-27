import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import EventDetailPage from './page'
import { EventHubClient } from '../../../components/events/EventHubClient'
import { EventDataMissing } from '../../../components/events/EventDataMissing'

const boxEvent = {
  id: 80586,
  name: 'BOX',
  startedAt: 1,
  endedAt: 2,
  lotteries: [{ boxIndex: 0, costPerBox: 1, contents: [], rareRewards: [] }],
  shop: [],
}
const shopEvent = {
  id: 80700,
  name: 'SHOP',
  startedAt: 1,
  endedAt: 2,
  lotteries: [],
  shop: [
    { itemId: 6516, qty: 1, costItemId: 94001, costAmount: 10, limitNum: 5 },
    { itemId: 6999, qty: 1, costItemId: 94001, costAmount: 10, limitNum: 5 },
    { itemId: 6516, qty: 2, costItemId: 94002, costAmount: 30, limitNum: 1 },
  ],
}
const getEventRewards = vi.fn(async (id: number) => (id === 80700 ? { eventId: id, pointItemId: 94099 } : undefined))
vi.mock('../../../lib/get-events', () => ({
  getEventById: async (id: number) => [boxEvent, shopEvent].find(e => e.id === id) ?? null,
  getEventRewards: (id: number) => getEventRewards(id),
}))
const drops = {
  items: [
    { id: 'a', atlasId: 6516, category: '', name: '' },
    { id: 'b', atlasId: 6517, category: '', name: '' },
  ],
  quests: [{ id: 'q', section: '', area: '', name: '', ap: 40 }],
  drop_rates: [
    { item_id: 'a', quest_id: 'q', drop_rate: 0.5 },
    { item_id: 'b', quest_id: 'q', drop_rate: 0.2 },
  ],
  campaigns: [],
}
const getDrops = vi.fn(async () => drops)
vi.mock('../../../lib/get-drops', () => ({ getDrops: () => getDrops() }))
const items = [{ id: 6516 }]
const getItems = vi.fn(async () => items)
vi.mock('../../../lib/get-items', () => ({ getItems: () => getItems() }))
vi.mock('../../../components/events/EventHubClient', () => ({ EventHubClient: () => null }))
vi.mock('../../../components/events/EventDataMissing', () => ({ EventDataMissing: () => null }))

const renderPage = async (id: string) =>
  (await EventDetailPage({ params: Promise.resolve({ id }) })) as ReactElement<Record<string, unknown>>

describe('/events/[id]', () => {
  it('レジストリのみ（80614）: craft で items を渡し、meta をヘッダーに使う', async () => {
    const el = await renderPage('80614')
    expect(el.type).toBe(EventHubClient)
    expect(el.props).toMatchObject({ features: ['craft'], items, boxEvent: undefined })
    expect(el.props.summary).toMatchObject({ id: 80614, startedAt: 1786532400 })
  })

  it('KV のボックスイベント: box のみ、items は取らない', async () => {
    getItems.mockClear()
    const el = await renderPage('80586')
    expect(el.type).toBe(EventHubClient)
    expect(el.props).toMatchObject({ features: ['box'], boxEvent, items: undefined })
    expect(el.props.summary).toEqual({ id: 80586, name: 'BOX', startedAt: 1, endedAt: 2 })
    expect(getItems).not.toHaveBeenCalled()
  })

  it('KV のボックスイベント: ドロップ表を読まない', async () => {
    getDrops.mockClear()
    const el = await renderPage('80586')
    expect(el.props.shopApPrices).toBeUndefined()
    expect(getDrops).not.toHaveBeenCalled()
  })

  it('KV のボックスイベント: ポイントの品目を読まない', async () => {
    getEventRewards.mockClear()
    const el = await renderPage('80586')
    expect(el.props.pointItemId).toBeUndefined()
    expect(getEventRewards).not.toHaveBeenCalled()
  })

  it('ロトの無い交換所イベント: ポイントの品目を渡す', async () => {
    const el = await renderPage('80700')
    expect(el.props.pointItemId).toBe(94099)
  })

  it('ロトの無い交換所イベント: 交換所の品目の分だけ AP 換算値を渡す', async () => {
    getDrops.mockClear()
    const el = await renderPage('80700')
    expect(el.props).toMatchObject({ features: ['shop'], boxEvent: shopEvent })
    expect(el.props.shopApPrices).toEqual({ 6516: 80 })
    expect(getDrops).toHaveBeenCalledTimes(1)
  })

  it('ロトの無い交換所イベント: ドロップ表が読めなくても空の AP 換算値でページを出す', async () => {
    getDrops.mockRejectedValueOnce(new Error('KV unavailable'))
    const el = await renderPage('80700')
    expect(el.type).toBe(EventHubClient)
    expect(el.props.shopApPrices).toEqual({})
  })

  it('交換所の無いイベント（80614）: ドロップ表を読まない', async () => {
    getDrops.mockClear()
    await renderPage('80614')
    expect(getDrops).not.toHaveBeenCalled()
  })

  it.each([['999'], ['abc']])('存在しない ID %s は EventDataMissing', async (id) => {
    expect((await renderPage(id)).type).toBe(EventDataMissing)
  })
})

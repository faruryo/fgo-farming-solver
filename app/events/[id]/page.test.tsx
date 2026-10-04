import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import EventDetailPage from './page'
import { EventHubClient } from '../../../components/events/EventHubClient'
import { EventDataMissing } from '../../../components/events/EventDataMissing'

const boxEvent = { id: 80586, name: 'BOX', startedAt: 1, endedAt: 2 }
vi.mock('../../../lib/get-events', () => ({
  getEventById: async (id: number) => (id === boxEvent.id ? boxEvent : null),
}))
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

  it.each([['999'], ['abc']])('存在しない ID %s は EventDataMissing', async (id) => {
    expect((await renderPage(id)).type).toBe(EventDataMissing)
  })
})

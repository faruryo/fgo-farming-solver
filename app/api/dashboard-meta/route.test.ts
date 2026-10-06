import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/get-dashboard-meta', () => ({
  getDashboardMeta: vi.fn().mockResolvedValue({ events: [], gachas: [], updatedAt: 1 }),
}))
const getEvents = vi.fn()
vi.mock('../../../lib/get-events', () => ({ getEvents: () => getEvents() }))

const { GET } = await import('./route')

describe('GET /api/dashboard-meta', () => {
  it('adds lottery event ids from event_data_json', async () => {
    getEvents.mockResolvedValueOnce({ events: [{ id: 80500 }, { id: 80510 }], updatedAt: 0 })
    const res = await GET()
    expect(await res.json()).toEqual({ events: [], gachas: [], updatedAt: 1, availableLotteryEventIds: [80500, 80510] })
  })

  it('still returns dashboard meta with an empty id list when getEvents throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getEvents.mockRejectedValueOnce(new Error('kv down'))
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ events: [], gachas: [], updatedAt: 1, availableLotteryEventIds: [] })
  })
})

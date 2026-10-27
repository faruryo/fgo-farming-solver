import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./data-source', () => ({
  kvGetJson: vi.fn(),
  readLocalJson: vi.fn(),
}))

const { getEventRewards } = await import('./get-events')
const { kvGetJson, readLocalJson } = await import('./data-source')

const mockKvGetJson = vi.mocked(kvGetJson)
const mockReadLocalJson = vi.mocked(readLocalJson)

const rewards = { pointRewards: [{ point: 1000, gifts: [] }], missions: [], pointItemId: 94160904, updatedAt: 1 }

describe('getEventRewards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('イベントごとのキーにある値を返す', async () => {
    mockKvGetJson.mockResolvedValue(rewards)
    expect(await getEventRewards(80627)).toEqual(rewards)
    expect(mockKvGetJson).toHaveBeenCalledWith('event_rewards:80627')
    expect(mockReadLocalJson).not.toHaveBeenCalled()
  })

  it('キーが無いイベントは undefined', async () => {
    mockKvGetJson.mockResolvedValue(null)
    mockReadLocalJson.mockResolvedValue([{ key: 'event_rewards:80627', value: rewards }])
    expect(await getEventRewards(80000)).toBeUndefined()
  })

  it('KV が無いローカルではモックのキーを読む', async () => {
    mockKvGetJson.mockResolvedValue(null)
    mockReadLocalJson.mockResolvedValue([{ key: 'event_rewards:80627', value: rewards }])
    expect(await getEventRewards(80627)).toEqual(rewards)
    expect(mockReadLocalJson).toHaveBeenCalledWith('mocks/event-rewards.json')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./data-source', () => ({
  fetchData: vi.fn(),
}))
vi.mock('./get-items', () => ({
  getItems: vi.fn(),
}))
vi.mock('./to-api-item-id', () => ({
  toApiItemId: vi.fn(),
}))

const { getDrops } = await import('./get-drops')
const { fetchData } = await import('./data-source')
const { getItems } = await import('./get-items')
const { toApiItemId } = await import('./to-api-item-id')

const mockFetchData = vi.mocked(fetchData)
const mockGetItems = vi.mocked(getItems)
const mockToApiItemId = vi.mocked(toApiItemId)

describe('getDrops atlasId backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('backfills atlasId from the short-id mapping when master data lacks it', async () => {
    mockFetchData.mockResolvedValue({
      // 旧マスターデータ: atlasId が無い
      items: [{ id: '00', category: 'gold', name: '英雄の証' }],
      quests: [],
      drop_rates: [],
    })
    mockGetItems.mockResolvedValue([{ id: 6503, name: '英雄の証' } as never])
    // 育成計算機と同じ toApiItemId で短縮ID '00' に対応づく
    mockToApiItemId.mockReturnValue('00')

    const { items } = await getDrops()
    expect(items[0].atlasId).toBe(6503)
    expect(items[0].id).toBe('00')
  })

  it('is a no-op (no Atlas fetch) when items already carry atlasId', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: '00', category: 'gold', name: '英雄の証', atlasId: 6503 }],
      quests: [],
      drop_rates: [],
    })

    const { items } = await getDrops()
    expect(items[0].atlasId).toBe(6503)
    expect(mockGetItems).not.toHaveBeenCalled()
  })

  it('leaves items untouched when Atlas Academy is unavailable', async () => {
    mockFetchData.mockResolvedValue({
      items: [{ id: '00', category: 'gold', name: '英雄の証' }],
      quests: [],
      drop_rates: [],
    })
    mockGetItems.mockRejectedValue(new Error('Network error'))

    const { items } = await getDrops()
    expect(items[0].atlasId).toBeUndefined()
    expect(items[0].id).toBe('00')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLocalItems } from './get-local-items'

vi.mock('./get-items', () => ({
  getItems: vi.fn(),
}))

const { getItems } = await import('./get-items')
const mockGetItems = vi.mocked(getItems)

describe('getLocalItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array immediately without calling getItems when items is empty', async () => {
    const result = await getLocalItems([], 'ja')
    expect(result).toEqual([])
    expect(mockGetItems).not.toHaveBeenCalled()
  })

  it('calls getItems and returns items without throwing when Atlas Academy is available', async () => {
    mockGetItems.mockResolvedValue([])

    const items = [{ id: '6001', category: 'bronze', name: 'Test Material' }]
    const result = await getLocalItems(items, 'ja')

    expect(mockGetItems).toHaveBeenCalledWith('ja')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('6001')
  })

  it('falls back to master data names when Atlas Academy is unavailable (no 500)', async () => {
    mockGetItems.mockRejectedValue(new Error('Network error'))

    const items = [{ id: '6001', category: 'bronze', name: 'Fallback Name' }]
    await expect(getLocalItems(items, 'ja')).resolves.toEqual([
      {
        id: '6001',
        category: 'bronze',
        largeCategory: '',
        shortName: 'Fallback Name',
        name: 'Fallback Name',
        icon: undefined,
      },
    ])
  })

  it('falls back gracefully for all items when Atlas Academy fails', async () => {
    mockGetItems.mockRejectedValue(new Error('Timeout'))

    const items = [
      { id: '6001', category: 'bronze', name: 'Item A' },
      { id: '6002', category: 'silver', name: 'Item B' },
    ]
    const result = await getLocalItems(items, 'ja')

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Item A')
    expect(result[1].name).toBe('Item B')
  })
})

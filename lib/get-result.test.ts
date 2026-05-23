import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./data-source', () => ({
  readLocalJson: vi.fn(),
}))

import { readLocalJson } from './data-source'
import { getResult } from './get-result'

const mockReadLocalJson = readLocalJson as ReturnType<typeof vi.fn>

const minimalResult = {
  items: [],
  quests: [],
  drop_rates: [],
  total_ap: 0,
  total_lap: 0,
  params: { items: [] },
}

describe('getResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns createdAt when mock file is present', async () => {
    mockReadLocalJson.mockResolvedValue(minimalResult)
    const result = await getResult('test-id')
    expect(result.createdAt).toBeDefined()
    expect(typeof result.createdAt).toBe('string')
    // should be a valid ISO date string
    expect(isNaN(new Date(result.createdAt!).getTime())).toBe(false)
  })

  it('spreads mock result data alongside createdAt', async () => {
    mockReadLocalJson.mockResolvedValue(minimalResult)
    const result = await getResult('test-id')
    expect('items' in result).toBe(true)
  })
})

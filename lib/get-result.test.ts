import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./data-source', () => ({
  readLocalJson: vi.fn(),
}))

const mockPrepare = vi.fn()
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: {
      DB: {
        prepare: mockPrepare,
      },
    },
  })),
}))

import { readLocalJson } from './data-source'
import { getResult, canViewResult } from './get-result'

const mockReadLocalJson = readLocalJson as ReturnType<typeof vi.fn>

const minimalResult = {
  items: [],
  quests: [],
  drop_rates: [],
  total_ap: 0,
  total_lap: 0,
  params: { items: [] },
}

describe('canViewResult (pure logic)', () => {
  it('allows access if result is public, regardless of viewer', () => {
    expect(canViewResult(true, 'owner-1', null)).toBe(true)
    expect(canViewResult(true, 'owner-1')).toBe(true)
    expect(canViewResult(true, 'owner-1', 'other-user')).toBe(true)
    expect(canViewResult(true, 'owner-1', 'owner-1')).toBe(true)
  })

  it('allows access to private result only for the owner', () => {
    expect(canViewResult(false, 'owner-1', 'owner-1')).toBe(true)
    expect(canViewResult(false, 'owner-1', 'other-user')).toBe(false)
    expect(canViewResult(false, 'owner-1', null)).toBe(false)
    expect(canViewResult(false, 'owner-1')).toBe(false)
  })
})

describe('getResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns createdAt and isPublic when mock file is present', async () => {
    mockReadLocalJson.mockResolvedValue(minimalResult)
    const result = await getResult('test-id')
    expect(result.createdAt).toBeDefined()
    expect(typeof result.createdAt).toBe('string')
    expect(isNaN(new Date(result.createdAt!).getTime())).toBe(false)
    expect(result.isPublic).toBe(true)
    expect(result.isOwner).toBe(true)
    expect((result as Record<string, unknown>).userId).toBeUndefined()
  })

  it('spreads mock result data alongside createdAt', async () => {
    mockReadLocalJson.mockResolvedValue(minimalResult)
    const result = await getResult('test-id')
    expect('items' in result).toBe(true)
  })

  describe('D1 pathway', () => {
    beforeEach(() => {
      mockReadLocalJson.mockResolvedValue(null)
    })

    it('returns public result to any user without exposing owner userId', async () => {
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            result_data: JSON.stringify(minimalResult),
            created_at: '2026-09-27T00:00:00.000Z',
            batch_id: null,
            user_id: 'user-a',
            is_public: 1,
          }),
        }),
      })

      const result = await getResult('res-1', 'other-user')
      expect(result.isOwner).toBe(false)
      expect((result as Record<string, unknown>).userId).toBeUndefined()
      expect(result.isPublic).toBe(true)
      expect(result.createdAt).toBe('2026-09-27T00:00:00.000Z')
    })

    it('returns private result to the owner with isOwner true', async () => {
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            result_data: JSON.stringify(minimalResult),
            created_at: '2026-09-27T00:00:00.000Z',
            batch_id: null,
            user_id: 'owner-user',
            is_public: 0,
          }),
        }),
      })

      const result = await getResult('res-2', 'owner-user')
      expect(result.isOwner).toBe(true)
      expect((result as Record<string, unknown>).userId).toBeUndefined()
      expect(result.isPublic).toBe(false)
    })

    it('throws error when non-owner accesses private result', async () => {
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            result_data: JSON.stringify(minimalResult),
            created_at: '2026-09-27T00:00:00.000Z',
            batch_id: null,
            user_id: 'owner-user',
            is_public: 0,
          }),
        }),
      })

      await expect(getResult('res-2', 'stranger')).rejects.toThrow('Result not found for id res-2')
      await expect(getResult('res-2', null)).rejects.toThrow('Result not found for id res-2')
    })

    it('throws error when row is not found', async () => {
      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      })

      await expect(getResult('deleted-id', 'owner-user')).rejects.toThrow('Result not found for id deleted-id')
    })

    it('does not return siblingResult if sibling row was soft-deleted', async () => {
      mockPrepare.mockImplementation((sql: string) => {
        if (sql.includes('batch_id = ? AND id != ?')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue(null),
            }),
          }
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({
              result_data: JSON.stringify(minimalResult),
              created_at: '2026-09-27T00:00:00.000Z',
              batch_id: 'batch-1',
              user_id: 'owner-user',
              is_public: 1,
            }),
          }),
        }
      })

      const result = await getResult('res-1', 'owner-user')
      expect(result.siblingResult).toBeNull()
    })
  })
})

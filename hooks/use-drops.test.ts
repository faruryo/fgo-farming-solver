import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchDrops, __resetDropsCacheForTest } from './use-drops'

describe('drops module-level cache', () => {
  beforeEach(() => {
    __resetDropsCacheForTest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ items: [], quests: [], drop_rates: [], campaigns: [] }),
      })
    )
  })

  it('concurrent callers share a single /api/drops request', async () => {
    const [a, b] = await Promise.all([fetchDrops(), fetchDrops()])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  it('subsequent calls after the cache is populated do not refetch', async () => {
    await fetchDrops()
    await fetchDrops()
    await fetchDrops()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('resets the cache when fetch fails so callers can retry', async () => {
    __resetDropsCacheForTest()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }))
    await expect(fetchDrops()).rejects.toThrow(/500/)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ items: [{ id: 'a', name: 'A', category: 'b' }], quests: [], drop_rates: [], campaigns: [] }),
      })
    )
    const ok = await fetchDrops()
    expect(ok.items).toHaveLength(1)
  })

  it('normalizes missing fields to empty arrays', async () => {
    __resetDropsCacheForTest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    )
    const out = await fetchDrops()
    expect(out.items).toEqual([])
    expect(out.quests).toEqual([])
    expect(out.drop_rates).toEqual([])
    expect(out.campaigns).toEqual([])
  })
})

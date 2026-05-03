import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAndTransformData } from './update'

// Prevent reading /tmp/nice_war.json from disk so all tests use HTTP mock
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'))
}))

describe('update.ts Regression Tests', () => {
  const originalProcess = process

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('process', originalProcess)
  })

  it('fetches nice_war.json from API when local fs is not available (Cloudflare Workers simulation)', async () => {
    vi.stubGlobal('process', { versions: {} })

    vi.mocked(fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.endsWith('nice_item.json')) return { ok: true, json: () => Promise.resolve([]) } as Response
      if (urlStr.includes('spreadsheets')) return { ok: true, text: () => Promise.resolve('h\nh\n,,AP,データ数\n') } as Response
      if (urlStr.endsWith('nice_war.json')) {
        return {
          ok: true,
          json: () => Promise.resolve([{
            longName: 'Test War',
            spots: [{ quests: [{ id: 123, name: 'Test Quest' }] }]
          }])
        } as Response
      }
      return { ok: false } as Response
    })

    await fetchAndTransformData()

    const fetchCalls = vi.mocked(fetch).mock.calls.map(c => c[0].toString())
    expect(fetchCalls.some(url => url.endsWith('nice_war.json'))).toBe(true)
  })

  it('never fetches individual quest details (no subrequest for wave data)', async () => {
    vi.stubGlobal('process', { versions: {} })

    const mockItems = [{ id: 1, name: 'ItemA', type: 'skillLvUp', background: 'bronze', priority: 1 }]
    // 3-row header format: row0 ignored, row1 ignored, row2 = item names (col4+), row3+ = data
    const mockCSV = `header\nheader\n,,AP,データ数,ItemA\n` +
      Array.from({ length: 10 }, (_, i) => `Area,Q${i + 1},20,100,50`).join('\n')
    const mockWar = [{
      longName: 'Area',
      spots: [{
        quests: Array.from({ length: 10 }, (_, i) => ({ id: 1000 + i, name: `Q${i + 1}` }))
      }]
    }]

    vi.mocked(fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.endsWith('nice_item.json')) return { ok: true, json: () => Promise.resolve(mockItems) } as Response
      if (urlStr.includes('spreadsheets')) return { ok: true, text: () => Promise.resolve(mockCSV) } as Response
      if (urlStr.endsWith('nice_war.json')) return { ok: true, json: () => Promise.resolve(mockWar) } as Response
      return { ok: false } as Response
    })

    await fetchAndTransformData()

    const questDetailFetches = vi.mocked(fetch).mock.calls
      .map(c => c[0].toString())
      .filter(url => url.includes('/quest/'))

    expect(questDetailFetches.length).toBe(0)
  })

  it('includes aaQuestId on quests that matched Atlas Academy data', async () => {
    const mockItems = [{ id: 6001, name: '英雄の証', type: 'skillLvUp', background: 'bronze', priority: 201 }]
    const mockCSV = `header\nheader\n,,AP,データ数,証\nFreeArea,匠の塔,20,100,50`
    const mockWar = [{
      longName: 'FreeArea',
      spots: [{ quests: [{ id: 9999, name: '匠の塔' }] }]
    }]

    vi.mocked(fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.endsWith('nice_item.json')) return { ok: true, json: () => Promise.resolve(mockItems) } as Response
      if (urlStr.includes('spreadsheets')) return { ok: true, text: () => Promise.resolve(mockCSV) } as Response
      if (urlStr.endsWith('nice_war.json')) return { ok: true, json: () => Promise.resolve(mockWar) } as Response
      return { ok: false } as Response
    })

    const data = await fetchAndTransformData()

    const quest = data.quests.find(q => q.name === '匠の塔')
    expect(quest).toBeDefined()
    expect(quest?.aaQuestId).toBe(9999)
  })

  it('quests without Atlas Academy match have no aaQuestId', async () => {
    const mockItems = [{ id: 6001, name: '英雄の証', type: 'skillLvUp', background: 'bronze', priority: 201 }]
    const mockCSV = `header\nheader\n,,AP,データ数,証\nUnknownArea,謎のクエスト,20,100,50`
    // War data has no matching quest
    const mockWar = [{ longName: 'OtherArea', spots: [{ quests: [{ id: 1111, name: '別のクエスト' }] }] }]

    vi.mocked(fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr.endsWith('nice_item.json')) return { ok: true, json: () => Promise.resolve(mockItems) } as Response
      if (urlStr.includes('spreadsheets')) return { ok: true, text: () => Promise.resolve(mockCSV) } as Response
      if (urlStr.endsWith('nice_war.json')) return { ok: true, json: () => Promise.resolve(mockWar) } as Response
      return { ok: false } as Response
    })

    const data = await fetchAndTransformData()

    const quest = data.quests.find(q => q.name === '謎のクエスト')
    expect(quest).toBeDefined()
    expect(quest?.aaQuestId).toBeUndefined()
  })
})

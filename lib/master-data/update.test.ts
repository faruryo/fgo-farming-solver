import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeItemName, fetchAndTransformData, fetchDashboardMeta } from './update'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'))
}))

describe('normalizeItemName', () => {
  it('maps standard abbreviations correctly', () => {
    expect(normalizeItemName('証')).toBe('英雄の証')
    expect(normalizeItemName('骨')).toBe('凶骨')
    expect(normalizeItemName('ﾗﾝﾀﾝ')).toBe('ゴーストランタン')
  })

  it('normalizes class items correctly', () => {
    // 輝石/魔石/秘石: AA名は兵種名そのまま（剣の輝石, 弓の魔石）
    expect(normalizeItemName('剣輝')).toBe('剣の輝石')
    expect(normalizeItemName('弓魔')).toBe('弓の魔石')
    expect(normalizeItemName('槍秘')).toBe('槍の秘石')
    // ピース/モニュメント: AA名はクラス名（セイバーピース）
    expect(normalizeItemName('騎ピ')).toBe('ライダーピース')
    expect(normalizeItemName('術モ')).toBe('キャスターモニュメント')
  })

  it('returns same name if no mapping found', () => {
    expect(normalizeItemName('未知の素材')).toBe('未知の素材')
  })
})

describe('fetchDashboardMeta', () => {
  const NOW = 1778773507 // 2026-05-15 (fixed for deterministic tests)
  const PERMANENT = 1893423600
  const ACTIVE_CLOSE = NOW + 86400       // closes tomorrow
  const EXPIRED_CLOSE = NOW - 86400      // closed yesterday
  const PERMANENT_CLOSE = PERMANENT + 1  // beyond sentinel

  const makeGacha = (id: number, type: string, closedAt = ACTIVE_CLOSE) => ({
    id,
    name: `ガチャ${id}`,
    type,
    imageId: id + 80000,
    openedAt: NOW - 3600,
    closedAt,
    featuredSvtIds: [100100],
  })

  const makeEvent = (id: number, banner: string, finishedAt = ACTIVE_CLOSE) => ({
    id,
    name: `イベント${id}`,
    type: 'eventQuest',
    banner,
    startedAt: NOW - 3600,
    endedAt: finishedAt,
    finishedAt,
    quests: [],
    svts: [],
  })

  const makeServant = (id: number) => ({
    id,
    name: `サーヴァント${id}`,
    rarity: 5,
    collectionNo: 400,
    type: 'normal',
  })

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.setSystemTime(NOW * 1000)
  })

  it('includes only stone/chargeStone gachas, excludes friendPoint and permanent', async () => {
    const gachas = [
      makeGacha(1, 'stone'),
      makeGacha(2, 'chargeStone'),
      makeGacha(3, 'friendPoint'),       // excluded
      makeGacha(4, 'stone', EXPIRED_CLOSE),  // excluded (expired)
      makeGacha(5, 'stone', PERMANENT_CLOSE), // excluded (permanent)
    ]
    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve([makeEvent(1, 'https://example.com/banner.png')]) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve(gachas) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve([makeServant(100100)]) } as Response)

    const result = await fetchDashboardMeta()

    expect(result.gachas).toHaveLength(2)
    expect(result.gachas.map(g => g.id)).toEqual([1, 2])
  })

  it('generates correct SummonBanners URL for every gacha', async () => {
    const gachas = [makeGacha(10, 'stone'), makeGacha(20, 'chargeStone')]
    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve(gachas) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve([makeServant(100100)]) } as Response)

    const result = await fetchDashboardMeta()

    for (const g of result.gachas) {
      expect(g.banner).toMatch(/\/JP\/SummonBanners\/img_summon_\d+\.png$/)
    }
  })

  it('output is valid JSON with required DashboardMeta fields', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve([makeGacha(1, 'stone')]) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve([makeServant(100100)]) } as Response)

    const result = await fetchDashboardMeta()
    const serialized = JSON.stringify(result)

    expect(() => JSON.parse(serialized)).not.toThrow()
    expect(result).toHaveProperty('events')
    expect(result).toHaveProperty('gachas')
    expect(result).toHaveProperty('recentServants')
    expect(result).toHaveProperty('updatedAt')
    expect(Array.isArray(result.gachas)).toBe(true)
    result.gachas.forEach(g => {
      expect(g).toHaveProperty('id')
      expect(g).toHaveProperty('name')
      expect(g).toHaveProperty('banner')
      expect(g).toHaveProperty('openedAt')
      expect(g).toHaveProperty('closedAt')
      expect(g).toHaveProperty('pickupServants')
    })
  })
})

describe('fetchAndTransformData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('generates short item IDs via toApiItemId and applies Top 5 filtering', async () => {
    const mockAAItems = [
      { id: 6001, name: '英雄の証', type: 'skillLvUp', background: 'bronze', priority: 200 },
      { id: 6002, name: '凶骨',     type: 'skillLvUp', background: 'bronze', priority: 201 },
    ]

    const mockCSV = `周回あたりのドロップ率（％）,,Best5表はこちら
エリア,クエスト名,,,銅素材,,,銅素材2
,,AP,データ数,証,骨
エリア1,クエストA,20,100,50,10
エリア1,クエストB,20,100,60,5
エリア1,クエストC,20,100,40,2
エリア2,クエストD,21,100,70,1
エリア2,クエストE,22,100,80,0
エリア2,クエストF,23,100,90,0
`

    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve(mockAAItems) } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as Response)
      .mockResolvedValueOnce({ text: () => Promise.resolve(mockCSV) } as Response)

    const data = await fetchAndTransformData()

    // Items have short IDs
    expect(data.items.find(i => i.name === '英雄の証')?.id).toBe('00')
    expect(data.items.find(i => i.name === '凶骨')?.id).toBe('01')

    // Quests have 3-char short IDs
    expect(data.quests.every(q => q.id.length === 3)).toBe(true)
    expect(data.quests.find(q => q.name === 'クエストA')?.id).toBe('100')
    expect(data.quests.find(q => q.name === 'クエストD')?.id).toBe('110')

    // Drop rates use single drop_rate field
    const proofRates = data.drop_rates.filter(dr => dr.item_id === '00')
    expect(proofRates.length).toBeGreaterThan(0)
    expect(proofRates.every(dr => 'drop_rate' in dr)).toBe(true)
    expect(proofRates.every(dr => !('drop_rate_1' in dr))).toBe(true)

    // Top 5 filtering: all 6 quests selected (union of both items' top5)
    expect(proofRates).toHaveLength(6)
    const sorted = [...proofRates].sort((a, b) => b.drop_rate - a.drop_rate)
    expect(sorted[0].drop_rate).toBe(0.9)
    expect(sorted[5].drop_rate).toBe(0.4)
  })
})

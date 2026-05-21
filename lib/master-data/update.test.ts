import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeItemName, fetchAndTransformData, fetchDashboardMeta, extractApCampaigns, extractPodFreePeriods } from './update'

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
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as Response)

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

    // campaigns field present (empty in this fixture since nice_event returned [])
    expect(data.campaigns).toEqual([])
  })
})

describe('extractApCampaigns', () => {
  const idMap = new Map<number, string>([
    [94145400, '20'],
    [94145410, '21'],
    [94146500, '22'],
    [4000701, '30'],
  ])

  it('extracts questAp campaigns and maps Atlas quest IDs to short IDs', () => {
    const events: any[] = [
      {
        id: 71683,
        name: '消費AP 50%DOWN',
        startedAt: 1000,
        endedAt: 2000,
        finishedAt: 2000,
        type: 'questCampaign',
        campaigns: [
          { target: 'questAp', calcType: 'multiplication', value: 500, idx: 1 },
        ],
        campaignQuests: [
          { questId: 94145400, phase: 0, isExcepted: false },
          { questId: 94145410, phase: 0, isExcepted: false },
          { questId: 94146500, phase: 0, isExcepted: false },
        ],
      },
    ]
    const result = extractApCampaigns(events, idMap)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 71683,
      calcType: 'multiplication',
      value: 500,
      validFrom: 1000,
      validTo: 2000,
    })
    expect(result[0].questIds.sort()).toEqual(['20', '21', '22'])
  })

  it('skips campaigns whose target is not questAp', () => {
    const events: any[] = [
      {
        id: 1,
        name: 'Drop UP',
        startedAt: 0,
        endedAt: 1,
        finishedAt: 1,
        type: 'questCampaign',
        campaigns: [{ target: 'questDrop', calcType: 'multiplication', value: 200 }],
        campaignQuests: [{ questId: 94145400, phase: 0, isExcepted: false }],
      },
    ]
    expect(extractApCampaigns(events, idMap)).toEqual([])
  })

  it('omits campaignQuests with isExcepted=true and unmappable Atlas IDs', () => {
    const events: any[] = [
      {
        id: 9,
        name: 'AP DOWN',
        startedAt: 100,
        endedAt: 200,
        finishedAt: 200,
        type: 'questCampaign',
        campaigns: [{ target: 'questAp', calcType: 'multiplication', value: 500 }],
        campaignQuests: [
          { questId: 94145400, phase: 0, isExcepted: false },     // mapped → '20'
          { questId: 94145410, phase: 0, isExcepted: true },      // excepted → drop
          { questId: 99999999, phase: 0, isExcepted: false },     // unmapped → drop
        ],
      },
    ]
    const result = extractApCampaigns(events, idMap)
    expect(result).toHaveLength(1)
    expect(result[0].questIds).toEqual(['20'])
  })

  it('returns no campaign when no mappable quests remain', () => {
    const events: any[] = [
      {
        id: 9,
        name: 'AP DOWN',
        startedAt: 0,
        endedAt: 1,
        finishedAt: 1,
        type: 'questCampaign',
        campaigns: [{ target: 'questAp', calcType: 'multiplication', value: 500 }],
        campaignQuests: [{ questId: 99999999, phase: 0, isExcepted: false }],
      },
    ]
    expect(extractApCampaigns(events, idMap)).toEqual([])
  })

  it('emits one Campaign entry per questAp campaign within the same event', () => {
    const events: any[] = [
      {
        id: 50,
        name: 'multi-campaign',
        startedAt: 0,
        endedAt: 10,
        finishedAt: 10,
        type: 'questCampaign',
        campaigns: [
          { target: 'questAp', calcType: 'multiplication', value: 500, idx: 1 },
          { target: 'questAp', calcType: 'fixedValue', value: 0, idx: 2 },
        ],
        campaignQuests: [{ questId: 4000701, phase: 0, isExcepted: false }],
      },
    ]
    const result = extractApCampaigns(events, idMap)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.calcType).sort()).toEqual(['fixedValue', 'multiplication'])
    expect(result.every(r => r.questIds.length === 1 && r.questIds[0] === '30')).toBe(true)
  })

  it("omits campaignQuests whose afterClear is 'close' (first-clear-only)", () => {
    const events: any[] = [
      {
        id: 71679,
        name: '消費AP0！',
        startedAt: 0,
        endedAt: 10,
        finishedAt: 10,
        type: 'questCampaign',
        campaigns: [{ target: 'questAp', calcType: 'fixedValue', value: 0 }],
        campaignQuests: [
          { questId: 94145400, phase: 0, isExcepted: false }, // repeatLast → keep
          { questId: 94145410, phase: 0, isExcepted: false }, // close → drop
          { questId: 4000701, phase: 0, isExcepted: false }, // close → drop
        ],
      },
    ]
    const afterClearMap = new Map<number, string>([
      [94145400, 'repeatLast'],
      [94145410, 'close'],
      [4000701, 'close'],
    ])
    const result = extractApCampaigns(events, idMap, afterClearMap)
    expect(result).toHaveLength(1)
    expect(result[0].questIds).toEqual(['20'])
  })

  it("drops the whole campaign when every quest has afterClear='close'", () => {
    const events: any[] = [
      {
        id: 71679,
        name: '消費AP0！',
        startedAt: 0,
        endedAt: 10,
        finishedAt: 10,
        type: 'questCampaign',
        campaigns: [{ target: 'questAp', calcType: 'fixedValue', value: 0 }],
        campaignQuests: [
          { questId: 94145400, phase: 0, isExcepted: false },
          { questId: 4000701, phase: 0, isExcepted: false },
        ],
      },
    ]
    const afterClearMap = new Map<number, string>([
      [94145400, 'close'],
      [4000701, 'close'],
    ])
    expect(extractApCampaigns(events, idMap, afterClearMap)).toEqual([])
  })

  it('skips campaigns with unknown calcType but keeps known ones', () => {
    const events: any[] = [
      {
        id: 1,
        name: 'mixed',
        startedAt: 0,
        endedAt: 1,
        finishedAt: 1,
        type: 'questCampaign',
        campaigns: [
          { target: 'questAp', calcType: 'multiplication', value: 500 },
          { target: 'questAp', calcType: 'futureType', value: 100 },
        ],
        campaignQuests: [{ questId: 94145400, phase: 0, isExcepted: false }],
      },
    ]
    const result = extractApCampaigns(events, idMap)
    expect(result).toHaveLength(1)
    expect(result[0].calcType).toBe('multiplication')
  })
})

describe('extractPodFreePeriods', () => {
  const NOW = 1779000000 // arbitrary fixed timestamp
  const idMap = new Map<number, string>([
    [94150501, 'P0'],
    [94150502, 'P1'],
    [94150503, 'P2'],
  ])

  const baseEvent = {
    id: 71676,
    name: '期間限定 ストーム・ポッド消費なし！',
    type: 'questCampaign',
    startedAt: NOW - 86400,
    endedAt: NOW + 86400,
    finishedAt: NOW + 86400,
    campaigns: [{ target: 'questAp', calcType: 'multiplication', value: 1000, idx: 1 }],
    campaignQuests: [
      { questId: 94150501, phase: 0, isExcepted: false },
      { questId: 94150502, phase: 0, isExcepted: false },
      { questId: 94150503, phase: 0, isExcepted: false },
    ],
  } as any

  it('extracts pod-free periods by name (中黒あり)', () => {
    const result = extractPodFreePeriods([baseEvent], idMap, NOW)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 71676,
      name: '期間限定 ストーム・ポッド消費なし！',
      startedAt: NOW - 86400,
      endedAt: NOW + 86400,
    })
    expect(result[0].questIds.sort()).toEqual(['P0', 'P1', 'P2'])
  })

  it('also matches the legacy spelling without 中黒', () => {
    const ev = { ...baseEvent, name: 'ストームポッド消費なし' }
    const result = extractPodFreePeriods([ev], idMap, NOW)
    expect(result).toHaveLength(1)
  })

  it('ignores events whose name does not contain the marker', () => {
    const ev = { ...baseEvent, name: '消費AP 50%DOWN' }
    expect(extractPodFreePeriods([ev], idMap, NOW)).toEqual([])
  })

  it('ignores events whose type is not questCampaign', () => {
    const ev = { ...baseEvent, type: 'eventQuest' }
    expect(extractPodFreePeriods([ev], idMap, NOW)).toEqual([])
  })

  it('ignores events that are not currently active', () => {
    const futureEv = { ...baseEvent, startedAt: NOW + 100, endedAt: NOW + 1000, finishedAt: NOW + 1000 }
    const pastEv = { ...baseEvent, id: 71677, startedAt: NOW - 1000, endedAt: NOW - 100, finishedAt: NOW - 100 }
    expect(extractPodFreePeriods([futureEv, pastEv], idMap, NOW)).toEqual([])
  })

  it('drops unmappable Atlas quest IDs and excepted entries', () => {
    const ev = {
      ...baseEvent,
      campaignQuests: [
        { questId: 94150501, phase: 0, isExcepted: false },   // mapped → P0
        { questId: 94150502, phase: 0, isExcepted: true },    // excepted → drop
        { questId: 99999999, phase: 0, isExcepted: false },   // unmapped → drop
      ],
    }
    const result = extractPodFreePeriods([ev], idMap, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].questIds).toEqual(['P0'])
  })

  it('returns empty when every quest is unmappable', () => {
    const ev = {
      ...baseEvent,
      campaignQuests: [{ questId: 99999999, phase: 0, isExcepted: false }],
    }
    expect(extractPodFreePeriods([ev], idMap, NOW)).toEqual([])
  })
})

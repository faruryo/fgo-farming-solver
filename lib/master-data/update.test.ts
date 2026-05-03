import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeItemName, fetchAndTransformData } from './update'

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

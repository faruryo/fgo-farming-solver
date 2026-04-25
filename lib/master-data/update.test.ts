import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeItemName, fetchAndTransformData } from './update'

describe('normalizeItemName', () => {
  it('maps standard abbreviations correctly', () => {
    expect(normalizeItemName('証')).toBe('英雄の証')
    expect(normalizeItemName('骨')).toBe('凶骨')
    expect(normalizeItemName('ﾗﾝﾀﾝ')).toBe('ゴーストランタン')
  })

  it('normalizes class items correctly', () => {
    expect(normalizeItemName('剣輝')).toBe('セイバーの輝石')
    expect(normalizeItemName('弓魔')).toBe('アーチャーの魔石')
    expect(normalizeItemName('槍秘')).toBe('ランサーの秘石')
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

  it('transforms CSV data and applies Top 5 filtering', async () => {
    const mockAAItems = [
      { id: 6001, name: '英雄の証', type: 'material' },
      { id: 1, name: 'QP', type: 'qp' }
    ]

    const mockCSV = `周回あたりのドロップ率（％）,,Best5表はこちら
エリア,クエスト名,,,銅素材,,,QP
,,AP,データ数,証,骨,QP
エリア1,クエストA,20,100,50,10,1000
エリア1,クエストB,20,100,60,5,500
エリア1,クエストC,20,100,40,2,200
エリア2,クエストD,21,100,70,1,100
エリア2,クエストE,22,100,80,0,50
エリア2,クエストF,23,100,90,0,10
`

    // Setup mocks
    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve(mockAAItems) } as Response) // AA items
      .mockResolvedValueOnce({ text: () => Promise.resolve(mockCSV) } as Response)    // Spreadsheet

    const data = await fetchAndTransformData()

    // 1. Check matched items
    expect(data.items.find(i => i.name === '英雄の証')).toBeDefined()
    expect(data.items.find(i => i.name === 'QP')).toBeDefined()

    // 2. Check Top 5 filtering for '英雄の証' (ID: 6001)
    const proofRates = data.drop_rates.filter(dr => dr.item_id === '6001')
    expect(proofRates).toHaveLength(5)
    // Should keep 90, 80, 70, 60, 50 (sorted by drop_rate)
    expect(proofRates[0].drop_rate).toBe(0.9)
    expect(proofRates[4].drop_rate).toBe(0.5)

    // 3. Check QP (ID: 1)
    const qpRates = data.drop_rates.filter(dr => dr.item_id === '1')
    expect(qpRates).toHaveLength(5)
    expect(qpRates[0].drop_rate).toBe(10.0) // 1000% / 100 = 10.0

    // 4. Check quests: only referenced quests should remain
    // Quests F, E, D, B, A (for 6001 top 5) and potentially others for QP
    // All 6 quests are in top 5 for either 6001 or 1, so all should remain
    expect(data.quests).toHaveLength(6)
  })
})

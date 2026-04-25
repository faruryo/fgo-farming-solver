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

  it('generates short item IDs via toApiItemId and applies Top 5 filtering', async () => {
    // background + priority are required for toApiItemId to produce a non-empty short ID
    // priority floor 2 + bronze background → intercept 0 → IDs "00", "01"
    const mockAAItems = [
      { id: 6001, name: '英雄の証', type: 'material', background: 'bronze', priority: 200 },
      { id: 6002, name: '凶骨',     type: 'material', background: 'bronze', priority: 201 },
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
      .mockResolvedValueOnce({ text: () => Promise.resolve(mockCSV) } as Response)

    const data = await fetchAndTransformData()

    // 1. Items have short IDs ("00", "01"), not Atlas Academy numeric IDs
    const proofItem = data.items.find(i => i.name === '英雄の証')
    expect(proofItem).toBeDefined()
    expect(proofItem!.id).toBe('00')

    const boneItem = data.items.find(i => i.name === '凶骨')
    expect(boneItem).toBeDefined()
    expect(boneItem!.id).toBe('01')

    // 2. Quests have short 3-char IDs: Free areas get prefix "1X"
    //    エリア1 → prefix "10", エリア2 → prefix "11"
    expect(data.quests.every(q => q.id.length === 3)).toBe(true)
    const questA = data.quests.find(q => q.name === 'クエストA')
    expect(questA?.id).toBe('100')
    const questD = data.quests.find(q => q.name === 'クエストD')
    expect(questD?.id).toBe('110')

    // 3. Drop rates reference the new short IDs
    const proofRates = data.drop_rates.filter(dr => dr.item_id === '00')
    expect(proofRates.length).toBeGreaterThan(0)
    expect(proofRates.every(dr => dr.quest_id.length === 3)).toBe(true)

    // 4. Top 5 filtering:
    //    証 top5: F(90),E(80),D(70),B(60),A(50) — excludes C(40%)
    //    骨 top5: A(10),B(5),C(2),D(1) — only 4 quests have drops
    //    Union: all 6 selected → all 6 proof drop rates included
    expect(proofRates).toHaveLength(6)
    const sortedProof = [...proofRates].sort((a, b) => b.drop_rate_1 - a.drop_rate_1)
    expect(sortedProof[0].drop_rate_1).toBe(0.9)
    expect(sortedProof[5].drop_rate_1).toBe(0.4)
  })
})

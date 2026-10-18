import { describe, it, expect } from 'vitest'
import type { EventShopItem } from './master-data/types'
import { compactShop, decideEventImport } from './refresh-event-data-compact'
import type { AtlasShopItem, ItemMap } from './refresh-event-data-compact'

const itemMap: ItemMap = new Map([
  [100, { name: '素材A', icon: 'a.png' }],
  [94001, { name: '武蔵うどん', icon: 'udon.png' }],
])

const atlasShop = (costItemId: number, targetIds = [100]): AtlasShopItem => ({
  purchaseType: 'item',
  payType: 'eventItem',
  targetIds,
  setNum: 2,
  limitNum: 5,
  cost: { item: { id: costItemId }, amount: 30 },
})

const shopItem = (costItemId: number): EventShopItem => ({
  itemId: 100,
  qty: 1,
  costItemId,
  costAmount: 10,
  limitNum: 5,
})

describe('compactShop', () => {
  it('対価の通貨が itemMap にあれば表示名とアイコンを入れる', () => {
    expect(compactShop([atlasShop(94001)], itemMap)).toEqual([
      {
        itemId: 100,
        qty: 2,
        costItemId: 94001,
        costAmount: 30,
        limitNum: 5,
        name: '素材A',
        icon: 'a.png',
        costName: '武蔵うどん',
        costIcon: 'udon.png',
      },
    ])
  })

  it('対価の通貨が itemMap に無ければ通貨の表示名・アイコンを入れない', () => {
    const [entry] = compactShop([atlasShop(99999)], itemMap)
    expect(entry).not.toHaveProperty('costName')
    expect(entry).not.toHaveProperty('costIcon')
    expect(entry?.costItemId).toBe(99999)
  })
})

describe('decideEventImport', () => {
  it('ロトあり: ロト型として取り込む', () => {
    expect(decideEventImport(1, 1, [shopItem(94001)], itemMap)).toEqual({ kind: 'lottery' })
  })

  it('ロト無し・交換所あり: 最初のエントリーの対価の通貨と空のロトで取り込む', () => {
    expect(decideEventImport(0, 0, [shopItem(94001), shopItem(100)], itemMap)).toEqual({
      kind: 'shop',
      currency: { id: 94001, name: '武蔵うどん', icon: 'udon.png' },
      unlimitedBoxes: false,
      lotteries: [],
    })
  })

  it('ロト無し・交換所あり・通貨が itemMap に無い: 名前とアイコンは空文字', () => {
    expect(decideEventImport(0, 0, [shopItem(99999)], itemMap)).toMatchObject({
      kind: 'shop',
      currency: { id: 99999, name: '', icon: '' },
    })
  })

  it('ロトも交換所も無し: スキップ', () => {
    expect(decideEventImport(0, 0, [], itemMap).kind).toBe('skip')
  })

  it('ロトの検証が全滅: 交換所があってもスキップ', () => {
    expect(decideEventImport(2, 0, [shopItem(94001)], itemMap).kind).toBe('skip')
  })
})

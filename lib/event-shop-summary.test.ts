import { describe, it, expect } from 'vitest'
import type { EventShopItem } from './master-data/types'
import { groupShopByCurrency } from './event-shop-summary'

const entry = (
  itemId: number,
  costItemId: number,
  costAmount: number,
  limitNum: number,
  extra: Partial<EventShopItem> = {},
): EventShopItem => ({ itemId, qty: 1, costItemId, costAmount, limitNum, ...extra })

describe('groupShopByCurrency', () => {
  it('通貨ごとにまとめ、costAmount × limitNum の和を合計にする（通貨は最初に現れた順）', () => {
    const groups = groupShopByCurrency([
      entry(1, 10, 20, 3, { costName: 'うどん', costIcon: 'u.png' }),
      entry(2, 11, 5, 10, { costName: 'むすび' }),
      entry(3, 10, 100, 2, { costName: 'うどん', costIcon: 'u.png' }),
    ])
    expect(groups.map(g => [g.costItemId, g.costName, g.totalCost, g.unlimitedCount])).toEqual([
      [10, 'うどん', 260, 0],
      [11, 'むすび', 50, 0],
    ])
    expect(groups[0]?.costIcon).toBe('u.png')
    expect(groups[0]?.items.map(i => i.itemId)).toEqual([1, 3])
  })

  it('limitNum が 0 の品目は合計に含めず上限なしとして数える', () => {
    const [group] = groupShopByCurrency([entry(1, 10, 20, 3), entry(2, 10, 50, 0), entry(3, 10, 1, 0)])
    expect(group?.totalCost).toBe(60)
    expect(group?.unlimitedCount).toBe(2)
    expect(group?.items).toHaveLength(3)
  })

  it('通貨名が無いエントリーでもまとめられ、costName は undefined', () => {
    const [group] = groupShopByCurrency([entry(1, 10, 20, 3)])
    expect(group?.costItemId).toBe(10)
    expect(group?.costName).toBeUndefined()
    expect(group?.totalCost).toBe(60)
  })

  it('空なら空', () => {
    expect(groupShopByCurrency([])).toEqual([])
  })
})

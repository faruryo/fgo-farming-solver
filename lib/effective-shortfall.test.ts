import { describe, expect, it } from 'vitest'
import { computeEffectiveShortfall, finitePurposeOf } from './effective-shortfall'
import { DEFAULT_STOCK_BUFFER, type StockBuffer } from './quest-efficiency'

const S = 6516
// 金素材（通常素材）の在庫基準を 20 にした在庫基準。
const stockBuffer: StockBuffer = {
  ...DEFAULT_STOCK_BUFFER,
  normal: { ...DEFAULT_STOCK_BUFFER.normal, gold: 20 },
}
const items = [{ id: S, category: '金素材', largeCategory: '強化素材' }]

describe('computeEffectiveShortfall', () => {
  it('今の育成を進める: 不足は必要数 − 所持数（クラススコアの分を足した必要数 15、所持 8 なら 7）', () => {
    const result = computeEffectiveShortfall(new Map([[S, 15]]), { [S]: 8 }, items, stockBuffer, 'training')
    expect(result.purpose).toBe('training')
    expect(result.shortfall.get(S)).toBe(7)
    expect(result.required.get(S)).toBe(15)
    expect(result.unentered.size).toBe(0)
  })

  it('今の育成を進める: 所持数が必要数以上なら不足に入れず、所持数を入れていなければ 0 個として数える', () => {
    const result = computeEffectiveShortfall(new Map([[S, 3], [7001, 5]]), { [S]: 12 }, items, stockBuffer, 'training')
    expect(result.shortfall.has(S)).toBe(false)
    expect(result.shortfall.get(7001)).toBe(5)
  })

  it('新規サーヴァントに備える: 必要数 3、在庫基準 20、所持数 12 なら不足は 8', () => {
    const result = computeEffectiveShortfall(new Map([[S, 3]]), { [S]: 12 }, items, stockBuffer, 'reserve')
    expect(result.purpose).toBe('reserve')
    expect(result.shortfall.get(S)).toBe(8)
    expect(result.required.get(S)).toBe(20)
  })

  it('新規サーヴァントに備える: 育成の必要数が無くても在庫基準の分を不足にする', () => {
    const result = computeEffectiveShortfall(new Map(), { [S]: 12 }, items, stockBuffer, 'reserve')
    expect(result.shortfall.get(S)).toBe(8)
  })

  it('新規サーヴァントに備える: 所持数を入れていない素材は不足に数えない', () => {
    const result = computeEffectiveShortfall(new Map([[S, 30]]), {}, items, stockBuffer, 'reserve')
    expect(result.shortfall.has(S)).toBe(false)
    expect(result.unentered.has(S)).toBe(true)
    expect(result.required.get(S)).toBe(30)
  })

  it('素材全体の効率を見る: 今の育成を進めると同じに求める', () => {
    const all = computeEffectiveShortfall(new Map([[S, 3]]), { [S]: 1 }, items, stockBuffer, 'all')
    expect(all.purpose).toBe('training')
    expect(all.shortfall.get(S)).toBe(2)
    expect(finitePurposeOf('all')).toBe('training')
  })

  it('素材の分類が無い素材は在庫基準を持たず、必要数で求める', () => {
    const result = computeEffectiveShortfall(new Map([[S, 3]]), { [S]: 1 }, undefined, stockBuffer, 'reserve')
    expect(result.shortfall.get(S)).toBe(2)
  })
})

import { describe, expect, it } from 'vitest'
import { summarizeRoster } from './summarize'
import { image, type CardSpec } from './test-fixtures'

const np = (servant: number, value: number, lv: [number, number] = [80, 80]): CardSpec => ({
  servant,
  np: [value, 5],
  lv,
})

const ctx = { rarityOf: (id: number) => (id === 9 ? 5 : undefined), stored: {} }

describe('summarizeRoster', () => {
  it('並びを読む: 宝具Lv.順・降順の画像を並び順の検査に入れ、外した読みに推定を添える', () => {
    const img = image(0, [[np(1, 5), np(2, 5), np(3, 3), np(4, 5), np(5, 5)]], { key: 'npLv', order: 'desc', owned: 5 })
    const result = summarizeRoster([img], ctx)
    const row3 = result.rows.find((r) => r.servantId === 3)
    expect(row3).toMatchObject({ npLv: null, lv: 80 })
    expect(row3?.review).toMatchObject({ reasons: ['sort-order'], undecided: ['npLv'], npLvCandidates: [3, 5] })
    expect(result.rows.filter((r) => r.review)).toHaveLength(1)
    expect(result).toMatchObject({ unsortedImageCount: 0, shortfall: null })
  })

  it('並びを読めない画像: 値は取り込みの候補にし、並び順の検査と読めたカードの数に入れない', () => {
    const sorted = image(0, [[np(1, 5), np(2, 5)]], { key: 'npLv', order: 'desc', owned: 10 })
    // 並びの向きを読めなかった画像（並び順の検査をすれば「1・5」で両方が外れる）。所持数も比べない
    const unsorted = image(1, [[np(6, 1), np(7, 5)]], { key: 'npLv', order: null, owned: 7 })
    const result = summarizeRoster([sorted, unsorted], ctx)
    expect(result.unsortedImageCount).toBe(1)
    expect(result.rows.map((r) => [r.servantId, r.npLv, r.review])).toEqual([
      [1, 5, null],
      [2, 5, null],
      [6, 1, null],
      [7, 5, null],
    ])
    expect(result.shortfall).toEqual({ owned: 10, read: 2 })
  })

  it('並びの項目を読めない画像も同じ扱いにする', () => {
    const unsorted = image(0, [[np(6, 1), np(7, 5)]], { key: null, order: 'desc', owned: 10 })
    const result = summarizeRoster([unsorted], ctx)
    expect(result.unsortedImageCount).toBe(1)
    expect(result.rows.every((r) => r.review === null)).toBe(true)
    expect(result.shortfall).toBeNull()
  })

  it('撮り漏れ: 重なりを1枚と数え、いちばん多い並びの集まりの数と所持数を比べる', () => {
    const a = image(0, [[np(1, 5), np(2, 5)], [np(3, 5), np(4, 5)]], { key: 'npLv', order: 'desc', owned: 554 })
    const b = image(1, [[np(3, 5), np(4, 5)], [np(5, 5), np(6, 5)]], { key: 'npLv', order: 'desc', owned: 554 })
    const lvOrder = image(2, [[{ servant: 1, lv: [80, 80] }]], { key: 'lv', order: 'desc', owned: 554 })
    expect(summarizeRoster([a, b, lvOrder], ctx).shortfall).toEqual({ owned: 554, read: 6 })
  })

  it('所持数が画像の間で違えば枚数の検査をしない', () => {
    const a = image(0, [[np(1, 5)]], { key: 'npLv', order: 'desc', owned: 554 })
    const b = image(1, [[np(2, 5)]], { key: 'npLv', order: 'desc', owned: 553 })
    expect(summarizeRoster([a, b], ctx).shortfall).toBeNull()
  })

  it('レア度の検査を当てる', () => {
    const img = image(0, [[np(9, 5, [85, 85])]], { key: 'npLv', order: 'desc' })
    const [row] = summarizeRoster([img], ctx).rows
    expect(row.review?.reasons).toEqual(['rarity-mismatch'])
  })

  it('前に取り込んだ値より低い行を「要確認」にする', () => {
    const img = image(0, [[np(1, 5)]], { key: 'npLv', order: 'desc' })
    const [row] = summarizeRoster([img], { ...ctx, stored: { 1: { lv: 90 } } }).rows
    expect(row.review?.reasons).toEqual(['lower-than-saved'])
  })
})

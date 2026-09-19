import { describe, expect, it } from 'vitest'
import { getMaterialBreakdown, mergeMaterials } from './merge-materials'

describe('mergeMaterials', () => {
  it('両方が空の場合は空オブジェクトを返す', () => {
    expect(mergeMaterials({}, {})).toEqual({})
  })

  it('サーヴァント側のみある場合はサーヴァント素材をそのまま返す', () => {
    const svt = { '6503': 30, '1': 1000 }
    expect(mergeMaterials(svt, {})).toEqual(svt)
  })

  it('クラススコア側のみある場合はクラススコア素材をそのまま返す', () => {
    const cs = { '6503': 70, '50': 6680 }
    expect(mergeMaterials({}, cs)).toEqual(cs)
  })

  it('共通キーがある場合は数値を合算する', () => {
    const svt = { '6503': 30, '1': 1000, '6501': 10 }
    const cs = { '6503': 70, '1': 317000000, '50': 6680 }
    const res = mergeMaterials(svt, cs)

    expect(res['6503']).toBe(100)
    expect(res['1']).toBe(317001000)
    expect(res['6501']).toBe(10)
    expect(res['50']).toBe(6680)
  })
})

describe('getMaterialBreakdown', () => {
  it('特定アイテムの内訳を正しく返す', () => {
    const svt = { '6503': 30 }
    const cs = { '6503': 70 }
    expect(getMaterialBreakdown('6503', svt, cs)).toEqual({
      servant: 30,
      classScore: 70,
      total: 100,
    })
  })

  it('片方にしか存在しない場合も0で補完して返す', () => {
    const svt = { '6501': 15 }
    const cs = { '50': 6680 }
    expect(getMaterialBreakdown('6501', svt, cs)).toEqual({
      servant: 15,
      classScore: 0,
      total: 15,
    })
    expect(getMaterialBreakdown('50', svt, cs)).toEqual({
      servant: 0,
      classScore: 6680,
      total: 6680,
    })
  })
})

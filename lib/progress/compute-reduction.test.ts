import { describe, it, expect } from 'vitest'
import { computeReduction, buildNeedByApiItemId } from './compute-reduction'
import type { Drops } from '../get-drops'

// 1クエスト qA(ap20)が item g(atlasId 6503)を drop_rate 1.0 で落とす最小フィクスチャ。
// N 個集めるには N 周(ap=N*20)必要 → total_ap=N*20, total_lap=N。
const makeDrops = (): Drops =>
  ({
    items: [
      { id: 'g', atlasId: 6503, category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' },
    ],
    quests: [{ id: 'qA', area: 'A', name: 'qA', section: 'Free', ap: 20 }],
    drop_rates: [{ quest_id: 'qA', item_id: 'g', drop_rate: 1.0 }],
    campaigns: [],
  }) as unknown as Drops

describe('computeReduction (方式1: 目標固定の再ソルブ)', () => {
  it('目標固定で所持が増えた分だけ残りAP/周回が減る', () => {
    // 目標 g=10(atlasId 6503)。過去所持 0 → needPast 10、現在所持 5 → needNow 5。
    const r = computeReduction(makeDrops(), { '6503': 10 }, { '6503': 5 }, { '6503': 0 }, ['qA'])
    expect(r).not.toBeNull()
    expect(r!.reducedAp).toBeCloseTo(200 - 100) // 10周ぶん − 5周ぶん
    expect(r!.reducedLap).toBeCloseTo(10 - 5)
  })

  it('所持が変わっていなければ目標を増やしても減少は0(目標固定のため)', () => {
    // 過去所持 == 現在所持。現在目標は両辺で固定されるので reduced=0。
    const r = computeReduction(makeDrops(), { '6503': 999 }, { '6503': 5 }, { '6503': 5 }, ['qA'])
    expect(r).not.toBeNull()
    expect(r!.reducedAp).toBeCloseTo(0)
    expect(r!.reducedLap).toBeCloseTo(0)
  })

  it('過去所持が無ければ null(算出不能でフォールバック)', () => {
    expect(computeReduction(makeDrops(), { '6503': 10 }, { '6503': 5 }, null, ['qA'])).toBeNull()
    expect(computeReduction(makeDrops(), { '6503': 10 }, { '6503': 5 }, undefined, ['qA'])).toBeNull()
  })

  it('buildNeedByApiItemId は atlasId 目標−所持を apiItemId キーの need にする', () => {
    const need = buildNeedByApiItemId({ '6503': 10 }, { '6503': 3 }, makeDrops())
    expect(need).toEqual({ g: 7 }) // 短縮ID 'g' キー、不足 7
  })

  it('目標0や充足済みは need に含めない', () => {
    expect(buildNeedByApiItemId({ '6503': 0 }, {}, makeDrops())).toEqual({})
    expect(buildNeedByApiItemId({ '6503': 5 }, { '6503': 5 }, makeDrops())).toEqual({})
  })
})

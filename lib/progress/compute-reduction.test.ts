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

// 2アイテム/2クエスト版フィクスチャ(各アイテム専用クエスト、ap20、drop_rate1.0)。
// item g は atlasId 6503(qA)、item h は atlasId 7001(qB)。
const makeTwoItemDrops = (): Drops =>
  ({
    items: [
      { id: 'g', atlasId: 6503, category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' },
      { id: 'h', atlasId: 7001, category: '金素材', largeCategory: '強化素材', name: 'holy', shortName: 'h' },
    ],
    quests: [
      { id: 'qA', area: 'A', name: 'qA', section: 'Free', ap: 20 },
      { id: 'qB', area: 'B', name: 'qB', section: 'Free', ap: 20 },
    ],
    drop_rates: [
      { quest_id: 'qA', item_id: 'g', drop_rate: 1.0 },
      { quest_id: 'qB', item_id: 'h', drop_rate: 1.0 },
    ],
    campaigns: [],
  }) as unknown as Drops

describe('computeReduction (消費中立化: 過去所持クランプ)', () => {
  it('(a) 獲得のみ: 過去30→現在50、目標100 → reducedAp=400, reducedLap=20(従来どおり)', () => {
    const r = computeReduction(makeDrops(), { '6503': 100 }, { '6503': 50 }, { '6503': 30 }, ['qA'])
    expect(r).not.toBeNull()
    expect(r!.reducedAp).toBeCloseTo(400)
    expect(r!.reducedLap).toBeCloseTo(20)
  })

  it('(b) 獲得+消費の混在: gは獲得(過去30→現在50)、hは育成消費で純減(過去20→現在5)。修正前ならhの純減分がマイナス寄与するが、修正後はhがクランプされgの獲得分(20*20=400)のみ計上される', () => {
    const r = computeReduction(
      makeTwoItemDrops(),
      { '6503': 100, '7001': 50 },
      { '6503': 50, '7001': 5 },
      { '6503': 30, '7001': 20 },
      ['qA', 'qB']
    )
    expect(r).not.toBeNull()
    expect(r!.reducedAp).toBeCloseTo(400)
    expect(r!.reducedLap).toBeCloseTo(20)
  })

  it('(c) 消費のみ: 過去50→現在30(純減)、目標100 → reducedAp=0, reducedLap=0(負にならない)', () => {
    const r = computeReduction(makeDrops(), { '6503': 100 }, { '6503': 30 }, { '6503': 50 }, ['qA'])
    expect(r).not.toBeNull()
    expect(r!.reducedAp).toBeCloseTo(0)
    expect(r!.reducedLap).toBeCloseTo(0)
  })
})

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

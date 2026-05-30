import { describe, it, expect } from 'vitest'
import { computeQuestEfficiency, QuestEfficiency, SECONDARY_WEIGHT } from './quest-efficiency'
import { Drops } from './get-drops'
import { Campaign } from '../interfaces/fgodrop'

// 小さな決定的フィクスチャ:
//   g   = 金素材(gold mat)     qA(ap20) 1.0 / qB(ap40) 1.0
//   gem = 秘石(skill stone gold) qA(ap20) 1.0
//   s   = 銀素材(silver mat)    qB(ap40) 1.0
const makeDrops = (campaigns: Campaign[] = []): Drops =>
  ({
    items: [
      { id: 'g', category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' },
      { id: 's', category: '銀素材', largeCategory: '強化素材', name: 'silver', shortName: 's' },
      { id: 'gem', category: '秘石', largeCategory: 'スキル石', name: 'gem', shortName: 'gem' },
    ],
    quests: [
      { id: 'qA', area: 'A', name: 'qA', section: 'Free', ap: 20, waveCount: 1, qp: 100 },
      { id: 'qB', area: 'B', name: 'qB', section: 'Free', ap: 40, waveCount: 3, qp: 100 },
    ],
    drop_rates: [
      { quest_id: 'qA', item_id: 'g', drop_rate: 1.0 },
      { quest_id: 'qA', item_id: 'gem', drop_rate: 1.0 },
      { quest_id: 'qB', item_id: 'g', drop_rate: 1.0 },
      { quest_id: 'qB', item_id: 's', drop_rate: 1.0 },
    ],
    campaigns,
  }) as unknown as Drops

const byId = (res: QuestEfficiency[]): Record<string, QuestEfficiency> =>
  Object.fromEntries(res.map(r => [r.questId, r]))
const contrib = (q: QuestEfficiency, itemId: string) =>
  q.contributions.find(c => c.itemId === itemId)

describe('computeQuestEfficiency', () => {
  it('bestEff で正規化される(最良クエストは relativeEff=1、効率半分は 0.5)', () => {
    const res = byId(computeQuestEfficiency(makeDrops(), { shortageOnly: false }))
    // bestEff(g) = max(1/20, 1/40) = 0.05 (qA)
    expect(contrib(res.qA, 'g')!.relativeEff).toBeCloseTo(1)
    expect(contrib(res.qB, 'g')!.relativeEff).toBeCloseTo(0.5)
    // qA: g(1) + gem(1) = 2、qB: g(0.5) + s(1) = 1.5
    expect(res.qA.score).toBeCloseTo(2)
    expect(res.qB.score).toBeCloseTo(1.5)
  })

  it('score 降順で返る', () => {
    const res = computeQuestEfficiency(makeDrops(), { shortageOnly: false })
    expect(res[0].questId).toBe('qA')
    expect(res[0].score).toBeGreaterThanOrEqual(res[1].score)
  })

  it('不足(owned < goal)は重み1', () => {
    const res = byId(computeQuestEfficiency(makeDrops(), { goals: { g: 10 }, possession: {} }))
    expect(contrib(res.qA, 'g')!.weight).toBe(1)
  })

  it('充足済みでも余剰がしきい値以下なら次点(0.3)', () => {
    const res = byId(
      computeQuestEfficiency(makeDrops(), { goals: { g: 10 }, possession: { g: 40 } }),
    )
    // 余剰 = 40 - 10 = 30 ≤ gold 既定 50
    expect(contrib(res.qA, 'g')!.weight).toBeCloseTo(SECONDARY_WEIGHT)
  })

  it('余剰がしきい値を超えると重み0(寄与しない)', () => {
    const res = byId(
      computeQuestEfficiency(makeDrops(), { goals: { g: 10 }, possession: { g: 100 } }),
    )
    expect(contrib(res.qA, 'g')).toBeUndefined()
  })

  it('しきい値を下げると次点から外れる(再計算)', () => {
    const res = byId(
      computeQuestEfficiency(makeDrops(), {
        goals: { g: 10 },
        possession: { g: 40 },
        surplusThreshold: { gold: 20 },
      }),
    )
    // 余剰 30 > gold 20 → 0
    expect(contrib(res.qA, 'g')).toBeUndefined()
  })

  it('石除くでスキル石が寄与しない', () => {
    const res = byId(computeQuestEfficiency(makeDrops(), { shortageOnly: false, includeSkillStones: false }))
    expect(contrib(res.qA, 'gem')).toBeUndefined()
    expect(res.qA.score).toBeCloseTo(1) // g のみ
  })

  it("denominator='turn'(周回効率)はターン数で割り、1ターンクエストを高評価する", () => {
    // qA=1ターン, qB=3ターン。共に g を 1.0 drop。
    // eff(g,qA)=1/1=1, eff(g,qB)=1/3 → bestEff=1 → relativeEff(qA)=1, relativeEff(qB)=1/3。
    const res = byId(computeQuestEfficiency(makeDrops(), { shortageOnly: false, denominator: 'turn' }))
    expect(contrib(res.qA, 'g')!.relativeEff).toBeCloseTo(1)
    expect(contrib(res.qB, 'g')!.relativeEff).toBeCloseTo(1 / 3)
  })

  it("denominator='turn' で waveCount 未設定なら 1 ターン扱い", () => {
    const drops = {
      items: [{ id: 'g', category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' }],
      quests: [
        { id: 'q1', area: 'X', name: 'one', section: 'Free', ap: 40, waveCount: 1 },
        { id: 'q2', area: 'Y', name: 'unknown', section: 'Free', ap: 40 }, // waveCount 無し
      ],
      drop_rates: [
        { quest_id: 'q1', item_id: 'g', drop_rate: 1.0 },
        { quest_id: 'q2', item_id: 'g', drop_rate: 1.0 },
      ],
      campaigns: [],
    } as unknown as Drops
    const res = byId(computeQuestEfficiency(drops, { shortageOnly: false, denominator: 'turn' }))
    // 両方とも 1 ターン扱い → 同点
    expect(contrib(res.q2, 'g')!.relativeEff).toBeCloseTo(1)
    expect(res.q1.score).toBeCloseTo(res.q2.score)
  })

  it('includeQp で QP を擬似アイテムとして加算する(default は加算しない)', () => {
    const off = byId(computeQuestEfficiency(makeDrops(), { shortageOnly: false }))
    expect(off.qA.contributions.some(c => c.itemId === 'reward:qp')).toBe(false)

    const on = byId(computeQuestEfficiency(makeDrops(), { shortageOnly: false, includeQp: true }))
    // qp: qA=100/ap20=5, qB=100/ap40=2.5 → bestEff=5 → relativeEff(qA)=1, (qB)=0.5
    const qpA = on.qA.contributions.find(c => c.itemId === 'reward:qp')
    expect(qpA?.relativeEff).toBeCloseTo(1)
    expect(qpA?.weight).toBe(1)
    expect(on.qB.contributions.find(c => c.itemId === 'reward:qp')?.relativeEff).toBeCloseTo(0.5)
    // 加算により score が上がる
    expect(on.qA.score).toBeCloseTo(off.qA.score + 1)
  })

  it('キャンペーン AP を反映する(qB の AP 半減で g の効率が上がる)', () => {
    const campaign: Campaign = {
      id: 1,
      calcType: 'multiplication',
      value: 500, // 50% DOWN → effAp(qB) = 40*0.5 = 20
      validFrom: 0,
      validTo: 2 ** 31,
      questIds: ['qB'],
    }
    const res = byId(
      computeQuestEfficiency(makeDrops([campaign]), {
        shortageOnly: false,
        activeCampaigns: [campaign],
      }),
    )
    // effAp(qB)=20 で bestEff(g)=0.05 に並ぶ → relativeEff(g,qB)=1
    expect(contrib(res.qB, 'g')!.relativeEff).toBeCloseTo(1)
  })
})

import { describe, it, expect } from 'vitest'
import {
  buildNeedByApiItemId,
  computeItemWeight,
  computeQuestEfficiency,
  DEFAULT_STOCK_BUFFER,
  effectiveDeficiency,
  QuestEfficiency,
  SECONDARY_WEIGHT,
  StockBuffer,
} from './quest-efficiency'
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

  it('モニュピ除くでピースとモニュメントがまとめて寄与しない', () => {
    // largeCategory='モニュピ' のピース(銀)・モニュメント(金)はどちらも除外される。
    const drops = {
      items: [
        { id: 'g', category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' },
        { id: 'piece', category: 'ピース', largeCategory: 'モニュピ', name: 'piece', shortName: 'p' },
        { id: 'mon', category: 'モニュメント', largeCategory: 'モニュピ', name: 'monument', shortName: 'm' },
      ],
      quests: [{ id: 'qA', area: 'A', name: 'qA', section: 'Free', ap: 20 }],
      drop_rates: [
        { quest_id: 'qA', item_id: 'g', drop_rate: 1.0 },
        { quest_id: 'qA', item_id: 'piece', drop_rate: 1.0 },
        { quest_id: 'qA', item_id: 'mon', drop_rate: 1.0 },
      ],
      campaigns: [],
    } as unknown as Drops
    const res = byId(computeQuestEfficiency(drops, { shortageOnly: false, includePieces: false }))
    expect(contrib(res.qA, 'piece')).toBeUndefined()
    expect(contrib(res.qA, 'mon')).toBeUndefined()
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

  it('所持数・必要数は atlasId で参照する(育成計算機と同じID空間)', () => {
    const drops = {
      items: [{ id: 'g', atlasId: 6503, category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' }],
      quests: [{ id: 'qA', area: 'A', name: 'qA', section: 'Free', ap: 20 }],
      drop_rates: [{ quest_id: 'qA', item_id: 'g', drop_rate: 1.0 }],
      campaigns: [],
    } as unknown as Drops
    // goal/owned は atlasId('6503') キーで渡す。短縮ID('g')では参照されない。
    const res = byId(
      computeQuestEfficiency(drops, { goals: { '6503': 10 }, possession: { '6503': 3 } }),
    )
    expect(contrib(res.qA, 'g')!.weight).toBe(1) // owned 3 < goal 10 → 不足
    // 短縮IDで渡しても効かない(atlasId 空間で見るため)
    const res2 = byId(
      computeQuestEfficiency(drops, { goals: { g: 10 }, possession: { g: 100 } }),
    )
    // goal/owned が atlasId 側に無い → goal=0,owned=0 → 余剰0 ≤ gold既定50 → 次点(0.3)
    expect(contrib(res2.qA, 'g')!.weight).toBeCloseTo(SECONDARY_WEIGHT)
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

// gold 素材(通常素材): DEFAULT_STOCK_BUFFER.normal.gold = 50
const goldMat = { id: 'g', category: '金素材', largeCategory: '強化素材' }
// gold 秘石(スキル石): DEFAULT_STOCK_BUFFER.skillStone.gold = 60
const goldGem = { id: 'gem', category: '秘石', largeCategory: 'スキル石' }
// レア不明(category がマッピングに無い)
const unknownRarity = { id: 'u', category: '謎の素材', largeCategory: '強化素材' }

describe('computeItemWeight: stockEnabled の ON/OFF と境界(D2)', () => {
  const baseOpts = {
    shortageOnly: true,
    includeSkillStones: true,
    includePieces: true,
    stockBuffer: DEFAULT_STOCK_BUFFER,
  }

  it('育成不足(owned<goal)は stockEnabled に関わらず重み1', () => {
    expect(computeItemWeight(goldMat, 5, 10, { ...baseOpts, stockEnabled: false })).toBe(1)
    expect(computeItemWeight(goldMat, 5, 10, { ...baseOpts, stockEnabled: true })).toBe(1)
  })

  it('OFF: owned==effGoal(goal+buffer)は境界外(重み0)', () => {
    // goal=10, buffer(gold,normal)=50 → effGoal=60
    expect(computeItemWeight(goldMat, 60, 10, { ...baseOpts, stockEnabled: false })).toBe(0)
  })

  it('OFF: owned==effGoal-1 は次点(0.3)', () => {
    expect(computeItemWeight(goldMat, 59, 10, { ...baseOpts, stockEnabled: false })).toBeCloseTo(
      SECONDARY_WEIGHT,
    )
  })

  it('ON: owned==effGoal-1 は目標(1.0)に昇格', () => {
    expect(computeItemWeight(goldMat, 59, 10, { ...baseOpts, stockEnabled: true })).toBe(1)
  })

  it('ON: owned==effGoal は重み0(ストック込み目標に到達)', () => {
    expect(computeItemWeight(goldMat, 60, 10, { ...baseOpts, stockEnabled: true })).toBe(0)
  })

  it('buffer=0(モニュピ銅相当の未設定レア)は OFF/ON 双方で owned>=goal なら重み0', () => {
    const stockBuffer: StockBuffer = {
      normal: { gold: 0, silver: 100, bronze: 200 },
      skillStone: DEFAULT_STOCK_BUFFER.skillStone,
      monumentPiece: DEFAULT_STOCK_BUFFER.monumentPiece,
    }
    expect(computeItemWeight(goldMat, 10, 10, { ...baseOpts, stockBuffer, stockEnabled: false })).toBe(0)
    expect(computeItemWeight(goldMat, 10, 10, { ...baseOpts, stockBuffer, stockEnabled: true })).toBe(0)
  })

  it('goal=0 かつ stockEnabled=ON は effGoal=buffer になり、所持がそれ未満なら重み1', () => {
    // buffer(gold,normal)=50
    expect(computeItemWeight(goldMat, 49, 0, { ...baseOpts, stockEnabled: true })).toBe(1)
    expect(computeItemWeight(goldMat, 50, 0, { ...baseOpts, stockEnabled: true })).toBe(0)
  })

  it('goal=0 かつ stockEnabled=OFF は次点(0.3)で低所持を拾う(従来挙動)', () => {
    expect(computeItemWeight(goldMat, 49, 0, { ...baseOpts, stockEnabled: false })).toBeCloseTo(
      SECONDARY_WEIGHT,
    )
  })

  it('レア不明の素材はストック対象外(buffer=0)で owned>=goal なら重み0', () => {
    expect(computeItemWeight(unknownRarity, 0, 0, { ...baseOpts, stockEnabled: true })).toBe(0)
    expect(computeItemWeight(unknownRarity, 0, 0, { ...baseOpts, stockEnabled: false })).toBe(0)
  })

  it('カテゴリ群でストック個数が異なる(通常素材 gold=50 / スキル石 gold=60)', () => {
    // 同じ owned=55, goal=0 で、normal は ON 時に重み0(effGoal=50を超過)、
    // skillStone は ON 時に重み1(effGoal=60未満)。
    expect(computeItemWeight(goldMat, 55, 0, { ...baseOpts, stockEnabled: true })).toBe(0)
    expect(computeItemWeight(goldGem, 55, 0, { ...baseOpts, stockEnabled: true })).toBe(1)
  })
})

describe('effectiveDeficiency: 共有純関数の境界(クエスト効率の重み判定と整合)', () => {
  it('stockEnabled=OFF は育成不足のみ(従来の max(0, goal-owned))', () => {
    expect(effectiveDeficiency(goldMat, 10, 4, DEFAULT_STOCK_BUFFER, false)).toBe(6)
    expect(effectiveDeficiency(goldMat, 10, 10, DEFAULT_STOCK_BUFFER, false)).toBe(0)
    // 余剰があっても OFF では実効不足はそのまま 0(次点バンドは重み判定側のみの概念)
    expect(effectiveDeficiency(goldMat, 10, 30, DEFAULT_STOCK_BUFFER, false)).toBe(0)
  })

  it('stockEnabled=ON は effGoal(=goal+buffer)基準の不足になる', () => {
    // goal=10, buffer(gold,normal)=50 → effGoal=60
    expect(effectiveDeficiency(goldMat, 10, 0, DEFAULT_STOCK_BUFFER, true)).toBe(60)
    expect(effectiveDeficiency(goldMat, 10, 59, DEFAULT_STOCK_BUFFER, true)).toBe(1)
    expect(effectiveDeficiency(goldMat, 10, 60, DEFAULT_STOCK_BUFFER, true)).toBe(0)
    expect(effectiveDeficiency(goldMat, 10, 100, DEFAULT_STOCK_BUFFER, true)).toBe(0)
  })

  it('goal=0・stockEnabled=ON は effGoal=buffer のみの不足になる', () => {
    expect(effectiveDeficiency(goldMat, 0, 0, DEFAULT_STOCK_BUFFER, true)).toBe(50)
    expect(effectiveDeficiency(goldMat, 0, 50, DEFAULT_STOCK_BUFFER, true)).toBe(0)
  })

  it('クエスト効率の重み判定(computeItemWeight)と同じ境界で一致する', () => {
    // owned=effGoal-1 では不足>0(重み1/0.3いずれかで寄与) / owned=effGoal では不足0(重み0)
    const goal = 10
    const buf = DEFAULT_STOCK_BUFFER.normal.gold // 50
    const effGoalMinus1 = goal + buf - 1
    const effGoal = goal + buf
    expect(effectiveDeficiency(goldMat, goal, effGoalMinus1, DEFAULT_STOCK_BUFFER, true)).toBeGreaterThan(0)
    expect(
      computeItemWeight(goldMat, effGoalMinus1, goal, {
        shortageOnly: true,
        includeSkillStones: true,
        includePieces: true,
        stockBuffer: DEFAULT_STOCK_BUFFER,
        stockEnabled: true,
      }),
    ).toBe(1)
    expect(effectiveDeficiency(goldMat, goal, effGoal, DEFAULT_STOCK_BUFFER, true)).toBe(0)
    expect(
      computeItemWeight(goldMat, effGoal, goal, {
        shortageOnly: true,
        includeSkillStones: true,
        includePieces: true,
        stockBuffer: DEFAULT_STOCK_BUFFER,
        stockEnabled: true,
      }),
    ).toBe(0)
  })
})

describe('buildNeedByApiItemId', () => {
  const dropsWithAtlas: Drops = {
    items: [
      { id: 'g', atlasId: 1, category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' },
      { id: 's', atlasId: 2, category: '銀素材', largeCategory: '強化素材', name: 'silver', shortName: 's' },
      // atlasId 無し(短縮ID側のみ存在)は対象外になるべき
      { id: 'noAtlas', category: '銀素材', largeCategory: '強化素材', name: 'no atlas', shortName: 'n' },
    ],
    quests: [],
    drop_rates: [],
    campaigns: [],
  } as unknown as Drops

  it('stockEnabled=false では育成不足(max(0,目標-所持))のみを apiItemId キーで返す', () => {
    const need = buildNeedByApiItemId(
      { '1': 100, '2': 50 },
      { '1': 40, '2': 50 },
      dropsWithAtlas,
      DEFAULT_STOCK_BUFFER,
      false,
    )
    expect(need).toEqual({ g: 60 })
  })

  it('stockEnabled=true では effectiveDeficiency と同じ値(育成必要+ストック)になる', () => {
    const need = buildNeedByApiItemId(
      { '1': 10 },
      { '1': 0, '2': 100 },
      dropsWithAtlas,
      DEFAULT_STOCK_BUFFER,
      true,
    )
    // gold(normal) buffer=50 → effGoal=60
    // silver(normal) 目標未設定(0)・所持100 = buffer(100) なので effGoal=100, 不足0
    expect(need).toEqual({ g: 60 })
  })

  it('atlasId が無いアイテムは対象外', () => {
    const need = buildNeedByApiItemId(
      { noAtlas: 100 },
      {},
      dropsWithAtlas,
      DEFAULT_STOCK_BUFFER,
      false,
    )
    expect(need).toEqual({})
  })
})

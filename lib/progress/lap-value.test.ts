import { describe, it, expect } from 'vitest'
import { resolveUnitPrices, computeForwardProgress, computeEffortLaps } from './lap-value'
import type { Drops } from '../get-drops'
import { resolveStockBuffer } from '../quest-efficiency'

// 1クエスト qA(ap20)が item g(atlasId 6503)を drop_rate 1.0 で落とす最小フィクスチャ。
const makeSingleItemDrops = (): Drops =>
  ({
    items: [
      { id: 'g', atlasId: 6503, category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' },
    ],
    quests: [{ id: 'qA', area: 'A', name: 'qA', section: 'Free', ap: 20 }],
    drop_rates: [{ quest_id: 'qA', item_id: 'g', drop_rate: 1.0 }],
    campaigns: [],
  }) as unknown as Drops

// item g は選択クエスト qA(rate 0.5)にも非選択クエスト qB(rate 1.0、より高率)にも
// ドロップするが、単価は「選択内の最高率」を優先する(選択外がより高率でも使わない)。
// item h は選択クエスト(qA)に一切ドロップせず、非選択 qB(rate 0.2)のみに存在 → フォールバック対象。
const makeFallbackDrops = (): Drops =>
  ({
    items: [
      { id: 'g', atlasId: 6503, category: '金素材', largeCategory: '強化素材', name: 'gold', shortName: 'g' },
      { id: 'h', atlasId: 7001, category: '金素材', largeCategory: '強化素材', name: 'holy', shortName: 'h' },
    ],
    quests: [
      { id: 'qA', area: 'A', name: 'qA', section: 'Free', ap: 20 },
      { id: 'qB', area: 'B', name: 'qB', section: 'Free', ap: 30 },
    ],
    drop_rates: [
      { quest_id: 'qA', item_id: 'g', drop_rate: 0.5 },
      { quest_id: 'qB', item_id: 'g', drop_rate: 1.0 },
      { quest_id: 'qB', item_id: 'h', drop_rate: 0.2 },
    ],
    campaigns: [],
  }) as unknown as Drops

describe('resolveUnitPrices', () => {
  it('選択クエスト内にドロップがあれば、選択外がより高率でもそちらを優先しない', () => {
    const prices = resolveUnitPrices(makeFallbackDrops(), ['qA'])
    // g: 選択(qA)内の最高率 0.5 を使う(qB の 1.0 は無視) → lapPrice=1/0.5=2, apPrice=20/0.5=40
    expect(prices.get('6503')).toEqual({ lapPrice: 2, apPrice: 40 })
  })

  it('選択クエストにドロップが無い素材は全クエスト中の最高率にフォールバックする', () => {
    const prices = resolveUnitPrices(makeFallbackDrops(), ['qA'])
    // h: 選択(qA)には存在せず、全体では qB(rate 0.2)のみ → lapPrice=1/0.2=5, apPrice=30/0.2=150
    expect(prices.get('7001')).toEqual({ lapPrice: 5, apPrice: 150 })
  })

  it('選択クエストが空なら全アイテムが全クエストフォールバックになる', () => {
    const prices = resolveUnitPrices(makeFallbackDrops(), [])
    // g: 全体最高率は qB の 1.0 → lapPrice=1、AP単価は min(20/0.5=40, 30/1.0=30)=30
    expect(prices.get('6503')).toEqual({ lapPrice: 1, apPrice: 30 })
  })
})

describe('computeForwardProgress (前進周回)', () => {
  it('過去所持が無ければ null(算出不能)', () => {
    expect(
      computeForwardProgress({
        drops: makeSingleItemDrops(),
        selectedQuestIds: ['qA'],
        targets: { '6503': 100 },
        currentPosession: { '6503': 50 },
        pastPosession: null,
        stockBuffer: resolveStockBuffer(null, null),
        stockEnabled: false,
      })
    ).toBeNull()
  })

  it('獲得のみ: 過去30→現在50、目標100 → 20個ぶん解消(lapPrice=1) → forwardLaps=20, forwardApEquivalent=400', () => {
    const r = computeForwardProgress({
      drops: makeSingleItemDrops(),
      selectedQuestIds: ['qA'],
      targets: { '6503': 100 },
      currentPosession: { '6503': 50 },
      pastPosession: { '6503': 30 },
      stockBuffer: resolveStockBuffer(null, null),
      stockEnabled: false,
    })
    expect(r).not.toBeNull()
    expect(r!.forwardLaps).toBeCloseTo(20)
    expect(r!.forwardApEquivalent).toBeCloseTo(400)
  })

  it('消費のみ(過去50→現在30の純減)は forwardLaps を負にしない(クランプ中立)', () => {
    const r = computeForwardProgress({
      drops: makeSingleItemDrops(),
      selectedQuestIds: ['qA'],
      targets: { '6503': 100 },
      currentPosession: { '6503': 30 },
      pastPosession: { '6503': 50 },
      stockBuffer: resolveStockBuffer(null, null),
      stockEnabled: false,
    })
    expect(r).not.toBeNull()
    expect(r!.forwardLaps).toBeCloseTo(0)
    expect(r!.forwardApEquivalent).toBeCloseTo(0)
  })

  it('stockEnabled=OFF はバッファを無視し育成目標のみで判定する', () => {
    const r = computeForwardProgress({
      drops: makeSingleItemDrops(),
      selectedQuestIds: ['qA'],
      targets: { '6503': 50 },
      currentPosession: { '6503': 90 },
      pastPosession: { '6503': 0 },
      // gold の既定バッファは60(DEFAULT_STOCK_BUFFER.normal.gold)。
      stockBuffer: resolveStockBuffer(null, null),
      stockEnabled: false,
    })
    // effTarget=50(バッファ無視)。past0→now90 は target 50 を超えるが、
    // 実効不足は 50 分しか計上されない(deficitPast=50, deficitNow=max(0,50-90)=0)。
    expect(r!.forwardLaps).toBeCloseTo(50)
  })

  it('stockEnabled=ON はバッファぶんも実効目標として計上する', () => {
    const r = computeForwardProgress({
      drops: makeSingleItemDrops(),
      selectedQuestIds: ['qA'],
      targets: { '6503': 50 },
      currentPosession: { '6503': 90 },
      pastPosession: { '6503': 0 },
      // gold の既定バッファ60 → effTarget=50+60=110。
      stockBuffer: resolveStockBuffer(null, null),
      stockEnabled: true,
    })
    // effTarget=110 > 現在所持90 なので全量(90)が前進として計上される。
    expect(r!.forwardLaps).toBeCloseTo(90)
  })

  it('複数素材の獲得+消費混在でも、消費側がマイナス寄与しない', () => {
    const drops = makeFallbackDrops()
    const r = computeForwardProgress({
      drops,
      selectedQuestIds: ['qA'],
      // g: 獲得(過去0→現在50)、h: 育成消費で純減(過去20→現在5)
      targets: { '6503': 100, '7001': 100 },
      currentPosession: { '6503': 50, '7001': 5 },
      pastPosession: { '6503': 0, '7001': 20 },
      stockBuffer: resolveStockBuffer(null, null),
      stockEnabled: false,
    })
    // g: resolved=50, lapPrice=1/0.5=2 → 100。h: resolved=0(クランプ) → 0。合計100。
    expect(r!.forwardLaps).toBeCloseTo(100)
  })
})

describe('computeEffortLaps (労力周回)', () => {
  it('過去所持が無ければ 0', () => {
    expect(computeEffortLaps(makeSingleItemDrops(), ['qA'], null, { '6503': 50 })).toBe(0)
  })

  it('純増(獲得)ぶんを周回換算する(余剰込み・目標を問わない)', () => {
    const laps = computeEffortLaps(makeSingleItemDrops(), ['qA'], { '6503': 10 }, { '6503': 35 })
    expect(laps).toBeCloseTo(25)
  })

  it('純減(育成投入)は加算しない', () => {
    const laps = computeEffortLaps(makeSingleItemDrops(), ['qA'], { '6503': 40 }, { '6503': 10 })
    expect(laps).toBe(0)
  })

  it('QP(atlasId 1)は除外する(単価が解決できても加算しない)', () => {
    const base = makeSingleItemDrops()
    const drops: Drops = {
      ...base,
      items: [
        ...base.items,
        { id: 'qp', atlasId: 1, category: 'QP', largeCategory: '', name: 'QP', shortName: 'qp' } as unknown as Drops['items'][number],
      ],
      drop_rates: [...base.drop_rates, { quest_id: 'qA', item_id: 'qp', drop_rate: 1.0 }],
    }
    const laps = computeEffortLaps(drops, ['qA'], { '6503': 0, '1': 1000 }, { '6503': 10, '1': 999999 })
    expect(laps).toBeCloseTo(10)
  })
})

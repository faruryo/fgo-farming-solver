import { describe, it, expect } from 'vitest'
import type { Drops } from '../get-drops'
import { resolveStockBuffer } from '../quest-efficiency'
import { computeForwardProgress, computeEffortLaps } from './lap-value'
import { finalizeBaselineSummary } from './finalize-baseline'
import { classifyTier } from './tier'
import type { PeriodSummary } from './types'

// ペルソナ受け入れテスト(design.md の「ペルソナ検証」節、tasks.md 2.6)。
// elapsedMinutes=43200(30日)基準で、design.md が想定する tier 到達を1ペルソナ=1テストで固定する。
// フィクスチャは合成データ(2〜3アイテム×専用クエスト、drop_rate を調整して単価を作る)。

const ELAPSED_30_DAYS = 43200

const baseSummary = (overrides: Partial<PeriodSummary> = {}): PeriodSummary => ({
  period: 'previous',
  tier: 'none',
  growthTotal: 0,
  newServantCount: 0,
  newServants: [],
  servantGrowth: [],
  elapsedMinutes: ELAPSED_30_DAYS,
  fallback: null,
  ...overrides,
})

type ItemDef = {
  id: string
  atlasId: number
  rarity: '金素材' | '銀素材' | '銅素材'
}

// 各アイテムに専用クエストを1つ割り当てる最小フィクスチャビルダー。
const makeDrops = (
  defs: Array<ItemDef & { questId: string; ap: number; dropRate: number }>
): Drops =>
  ({
    items: defs.map((d) => ({
      id: d.id,
      atlasId: d.atlasId,
      category: d.rarity,
      largeCategory: '強化素材',
      name: d.id,
      shortName: d.id,
    })),
    quests: defs.map((d) => ({ id: d.questId, area: 'A', name: d.questId, section: 'Free', ap: d.ap })),
    drop_rates: defs.map((d) => ({ quest_id: d.questId, item_id: d.id, drop_rate: d.dropRate })),
    campaigns: [],
  }) as unknown as Drops

const noBuffer = resolveStockBuffer(null, null)

describe('ペルソナ受け入れテスト(design.md、elapsedMinutes=43200基準)', () => {
  it('P1 新米: 低率クエストしか選択していなくても自然APフル相当(≈19周/日)で large に到達する', () => {
    // item A: 選択クエスト qA(rate 0.3、低率)にドロップ。lapPrice=1/0.3≈3.333。
    // item B: 選択クエストには無く、非選択 qB(rate 0.5)のみにドロップ → 単価フォールバック。lapPrice=2。
    const drops = makeDrops([
      { id: 'a', atlasId: 6001, rarity: '金素材', questId: 'qA', ap: 20, dropRate: 0.3 },
      { id: 'b', atlasId: 6002, rarity: '金素材', questId: 'qB', ap: 20, dropRate: 0.5 },
    ])
    const selectedQuestIds = ['qA'] // qB は選択外(新米はまだ qB を解放していない想定)
    const targets = { '6001': 300, '6002': 300 }
    const past = { '6001': 0, '6002': 0 }
    const current = { '6001': 120, '6002': 85 }

    const forward = computeForwardProgress({
      drops,
      selectedQuestIds,
      targets,
      currentPosession: current,
      pastPosession: past,
      stockBuffer: noBuffer,
      stockEnabled: false,
    })
    // a: 120個 × (1/0.3) = 400周。b: 85個 × (1/0.5) = 170周。合計570周/30日 ≈ 19周/日。
    expect(forward!.forwardLaps).toBeCloseTo(570)
    expect(forward!.forwardLaps / (ELAPSED_30_DAYS / 1440)).toBeCloseTo(19)

    const summary = finalizeBaselineSummary(baseSummary(), {
      itemsFarmed: 205,
      itemsConsumed: 0,
      forwardLaps: forward!.forwardLaps,
      forwardApEquivalent: forward!.forwardApEquivalent,
      effortLaps: forward!.forwardLaps,
    })
    expect(summary.tier).toBe('large')
  })

  it('P2 ログイン勢: 微獲得(≈2周/日)は small に留まる', () => {
    const drops = makeDrops([{ id: 'c', atlasId: 6003, rarity: '銅素材', questId: 'qC', ap: 20, dropRate: 1.0 }])
    const forward = computeForwardProgress({
      drops,
      selectedQuestIds: ['qC'],
      targets: { '6003': 300 },
      currentPosession: { '6003': 60 },
      pastPosession: { '6003': 0 },
      stockBuffer: noBuffer,
      stockEnabled: false,
    })
    // 60周/30日=2周/日。
    expect(forward!.forwardLaps / (ELAPSED_30_DAYS / 1440)).toBeCloseTo(2)

    const summary = finalizeBaselineSummary(baseSummary(), {
      itemsFarmed: 60,
      itemsConsumed: 0,
      forwardLaps: forward!.forwardLaps,
      forwardApEquivalent: forward!.forwardApEquivalent,
      effortLaps: forward!.forwardLaps,
    })
    expect(summary.tier).toBe('small')
  })

  it('P3 イベント月: バッファ込み不足解消+育成消費混在で≈42周/日 → large(消費が引かず、バッファ分が乗る)', () => {
    // item C: 育成必要数1000+バッファ300(金の既定バッファ=60ではなく、テスト用に大きめの
    // バッファを明示指定して「バッファ分が乗る」ことをはっきり示す)。
    const stockBuffer = resolveStockBuffer({ normal: { gold: 300, silver: 150, bronze: 300 } }, null)
    const drops = makeDrops([
      { id: 'd', atlasId: 6004, rarity: '金素材', questId: 'qD', ap: 20, dropRate: 1.0 }, // lapPrice=1
      { id: 'e', atlasId: 6005, rarity: '金素材', questId: 'qE', ap: 20, dropRate: 1.0 }, // 育成消費のみ(混在)
    ])
    const selectedQuestIds = ['qD', 'qE']
    const targets = { '6004': 1000, '6005': 100 }
    const past = { '6004': 0, '6005': 80 }
    // e は育成投入で純減(80→20)。d はバッファ込み実効目標(1300)まで届かない範囲で獲得(→1260)。
    const current = { '6004': 1260, '6005': 20 }

    const forward = computeForwardProgress({
      drops,
      selectedQuestIds,
      targets,
      currentPosession: current,
      pastPosession: past,
      stockBuffer,
      stockEnabled: true,
    })
    // d: effTarget=1300、past0→now1260(未飽和)→resolved=1260、lapPrice=1 → 1260周。
    // e: 消費のみ → resolved=0(クランプで負にならない)。合計1260周/30日=42周/日。
    expect(forward!.forwardLaps).toBeCloseTo(1260)
    expect(forward!.forwardLaps / (ELAPSED_30_DAYS / 1440)).toBeCloseTo(42)

    // バッファ無効化時は育成目標(1000)止まりで計上が減ることを確認(バッファ分が乗ることの裏取り)。
    const forwardWithoutBuffer = computeForwardProgress({
      drops,
      selectedQuestIds,
      targets,
      currentPosession: current,
      pastPosession: past,
      stockBuffer,
      stockEnabled: false,
    })
    expect(forwardWithoutBuffer!.forwardLaps).toBeCloseTo(1000)
    expect(forwardWithoutBuffer!.forwardLaps).toBeLessThan(forward!.forwardLaps)

    const summary = finalizeBaselineSummary(baseSummary(), {
      itemsFarmed: 1260,
      itemsConsumed: 60,
      forwardLaps: forward!.forwardLaps,
      forwardApEquivalent: forward!.forwardApEquivalent,
      effortLaps: 1260,
    })
    expect(summary.tier).toBe('large')
  })

  it('P3 ボックス月: 銅銀素材の大量不足解消で≈70周/日 → legendary', () => {
    const drops = makeDrops([
      { id: 'f', atlasId: 6006, rarity: '銅素材', questId: 'qF', ap: 20, dropRate: 0.5 }, // lapPrice=2
      { id: 'g', atlasId: 6007, rarity: '銀素材', questId: 'qG', ap: 20, dropRate: 1.0 }, // lapPrice=1
    ])
    const selectedQuestIds = ['qF', 'qG']
    const targets = { '6006': 2000, '6007': 2000 }
    const past = { '6006': 0, '6007': 0 }
    const current = { '6006': 600, '6007': 900 }

    const forward = computeForwardProgress({
      drops,
      selectedQuestIds,
      targets,
      currentPosession: current,
      pastPosession: past,
      stockBuffer: noBuffer,
      stockEnabled: false,
    })
    // f: 600×2=1200周。g: 900×1=900周。合計2100周/30日=70周/日。
    expect(forward!.forwardLaps).toBeCloseTo(2100)
    expect(forward!.forwardLaps / (ELAPSED_30_DAYS / 1440)).toBeCloseTo(70)

    const summary = finalizeBaselineSummary(baseSummary(), {
      itemsFarmed: 1500,
      itemsConsumed: 0,
      forwardLaps: forward!.forwardLaps,
      forwardApEquivalent: forward!.forwardApEquivalent,
      effortLaps: forward!.forwardLaps,
    })
    expect(summary.tier).toBe('legendary')
  })

  it('P4 常時りんご勢: ≈40周/日 → large', () => {
    const drops = makeDrops([{ id: 'h', atlasId: 6008, rarity: '金素材', questId: 'qH', ap: 20, dropRate: 1.0 }])
    const forward = computeForwardProgress({
      drops,
      selectedQuestIds: ['qH'],
      targets: { '6008': 2000 },
      currentPosession: { '6008': 1200 },
      pastPosession: { '6008': 0 },
      stockBuffer: noBuffer,
      stockEnabled: false,
    })
    // 1200周/30日=40周/日。
    expect(forward!.forwardLaps / (ELAPSED_30_DAYS / 1440)).toBeCloseTo(40)

    const summary = finalizeBaselineSummary(baseSummary(), {
      itemsFarmed: 1200,
      itemsConsumed: 0,
      forwardLaps: forward!.forwardLaps,
      forwardApEquivalent: forward!.forwardApEquivalent,
      effortLaps: forward!.forwardLaps,
    })
    expect(summary.tier).toBe('large')
  })

  it('P5 備蓄王: 前進0(全て実効目標超の余剰)・労力≈90周/日 → 補完で large 止まり(legendary 不可)、労力修飾メッセージ条件が真', () => {
    // 育成目標・バッファとも既に満たしている(所持が実効目標を超える余剰のみ)ため、
    // 過去も現在も実効目標を上回っており forwardLaps=0。一方で獲得(余剰積み増し)は続いている。
    const drops = makeDrops([{ id: 'i', atlasId: 6009, rarity: '金素材', questId: 'qI', ap: 20, dropRate: 1.0 }])
    const target = { '6009': 100 }
    // 実効目標(バッファ無効なので100)を過去(500)・現在(3200)とも大きく上回る。
    const past = { '6009': 500 }
    const current = { '6009': 3200 }

    const forward = computeForwardProgress({
      drops,
      selectedQuestIds: ['qI'],
      targets: target,
      currentPosession: current,
      pastPosession: past,
      stockBuffer: noBuffer,
      stockEnabled: false,
    })
    expect(forward!.forwardLaps).toBe(0)

    const effortLaps = computeEffortLaps(drops, ['qI'], past, current)
    // 2700周/30日=90周/日。
    expect(effortLaps).toBeCloseTo(2700)
    expect(effortLaps / (ELAPSED_30_DAYS / 1440)).toBeCloseTo(90)

    const summary = finalizeBaselineSummary(baseSummary(), {
      itemsFarmed: 2700,
      itemsConsumed: 0,
      forwardLaps: forward!.forwardLaps,
      forwardApEquivalent: forward!.forwardApEquivalent,
      effortLaps,
    })
    // 補完(D4): 労力90周/日はlegendary相当だが、legendaryは前進限定でlargeにキャップされる。
    expect(summary.tier).toBe('large')

    // 労力修飾(mashu-messages.ts の isDirectionLowOrMid && isHighEffort 相当の判定)。
    // 方向性(前進周回)は forwardLaps=0 → none(medium以下)。労力は90周/日 → large 以上。
    const directionTier = classifyTier(summary.forwardLaps ?? 0, summary.elapsedMinutes)
    expect(directionTier).toBe('none')
    const effortTier = classifyTier(summary.effortLaps ?? 0, summary.elapsedMinutes)
    expect(['large', 'legendary']).toContain(effortTier)
  })
})

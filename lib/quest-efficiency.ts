import { Drops } from './get-drops'
import { Campaign } from '../interfaces/fgodrop'
import { computeEffectiveAp } from './solver'
import {
  categoryGroup,
  CategoryGroup,
  getRarityByCategory,
  isMonumentOrPiece,
  isSkillStone,
  Rarity,
} from './item-rarity'

// クエストの「効率ポイント」を算出する純粋関数群。
//
// score(q) = Σ_i  relativeEff(i,q) × weight[i]
//   relativeEff(i,q) = eff(i,q) / bestEff(i)   ∈ [0,1]
//   bestEff(i)       = max over q of  eff(i,q)
//   eff(i,q)         = drop_rate(q,i) / denom(q)
//   denom(q)         = 'ap' なら effAp(q) / 'turn' なら waveCount(q)(=ターン数)
//   effAp(q)         = computeEffectiveAp(q.ap, q.id, activeCampaigns)
//
// スプレッドシートの「相対効率の合計」を踏襲し、所持数・目標・レア別余剰しきい値で
// 個人最適化する(2段階重み)。denominator で AP効率/周回効率(ターン数で割る)を切り替える。

export type SurplusThreshold = Record<Rarity, number>

/**
 * 通常素材(強化素材)レア別の既定ストック数。`stockBuffer.normal` の既定であり、
 * `stockEnabled=OFF` 時は「次点(0.3)で拾う余剰の上限」も兼ねる。
 * 旧キー `efficiency/surplusThreshold` の既定値かつ移行フォールバックでもある
 * (`hooks/use-stock-target.ts` / `resolveStockBuffer`)。
 * 値の根拠は `DEFAULT_STOCK_BUFFER` のコメント参照(1体あたり平均必要数 × 約3)。
 */
export const DEFAULT_SURPLUS_THRESHOLD: SurplusThreshold = {
  gold: 60,
  silver: 150,
  bronze: 300,
}

/** 次点(充足済みだが余剰が少ない素材)の重み。 */
export const SECONDARY_WEIGHT = 0.3

/**
 * 余剰ストック(`stockBuffer`)。カテゴリ群(通常素材/スキル石/モニュピ)× レア
 * (金銀銅、モニュピは金銀のみ)で保持する。`stockEnabled` でこの値の強度が
 * 「次点(0.3)で拾う余剰の上限」(OFF)↔「目標(1.0)に上乗せするストック個数」
 * (ON)に切り替わる(D2/D7)。
 */
export type StockBuffer = {
  normal: Record<Rarity, number>
  skillStone: Record<Rarity, number>
  monumentPiece: Partial<Record<Rarity, number>>
}

/** 部分指定可の `StockBuffer`(各群・各レアが欠けてよい)。保存値・オプションの入力型。 */
export type PartialStockBuffer = {
  [G in keyof StockBuffer]?: Partial<Record<Rarity, number>>
}

/**
 * カテゴリ群×レア別ストックバッファのデフォルト。
 *
 * 「★5を1体、最終再臨＋3スキル全Lv10にできる量」を目安に、直近の★5 25体
 * (Atlas Academy: 最終再臨4段 + 各スキルのLv10化を3スキル分)を集計した
 * 「1種あたりの平均必要数」を約3倍(≒3体ぶんのストック)した値:
 *   - 通常素材 1種あたり平均  : 金≈20 / 銀≈50 / 銅≈100  → ×3 = 金60 / 銀150 / 銅300
 *   - スキル石 1種あたり平均  : 各≈51 (5+12を3スキル)   → ×3 ≈ 各150
 *   - モニュピ 1種あたり平均  : 各≈17 (5+12)            → ×3 ≈ 各50
 * 通常素材は banded で個体差が大きい(銅は最大260/種の例も)ため、これは“平均的に
 * 1〜3体まかなえる”目安。ユーザーは所持数モーダルで上書きできる。
 */
export const DEFAULT_STOCK_BUFFER: StockBuffer = {
  // 通常素材は DEFAULT_SURPLUS_THRESHOLD と同値(次点バンドの既定と共有)。
  normal: { ...DEFAULT_SURPLUS_THRESHOLD },
  skillStone: { gold: 150, silver: 150, bronze: 150 },
  monumentPiece: { gold: 50, silver: 50 },
}

/**
 * 効率の分母。
 * - 'ap'   : 実効AP(AP効率 = AP1あたりのドロップ)
 * - 'turn' : ターン数=wave数(周回効率 = 1ターンあたりのドロップ)。
 *            3ターンクエストより1ターンクエストを高評価する(速い周回ほど有利)。
 *            wave 数データが無いクエストは 1 ターン扱いにフォールバック。
 */
export type EfficiencyDenominator = 'ap' | 'turn'

/** wave 数が不明なクエストのフォールバックターン数。 */
export const DEFAULT_TURNS = 1

export type QuestEfficiencyOptions = {
  /** 所持数 atlasId -> owned count(育成計算機の posession と同じ Atlas ID 空間)。 */
  possession?: Record<string, number | undefined>
  /** 必要数 atlasId -> required count(育成計算機の material/result と同じ Atlas ID 空間)。 */
  goals?: Record<string, number | undefined>
  /** effective-AP 補正用のアクティブキャンペーン。空なら元 AP。 */
  activeCampaigns?: Campaign[]
  /** 不足のみモード(true、default)か全部モード(false)。 */
  shortageOnly?: boolean
  /** スキル石を含めるか(default true)。false で「石除く」。 */
  includeSkillStones?: boolean
  /** ピース(銀の霊基再臨素材)を含めるか(default true)。false で「ピース除く」。 */
  includePieces?: boolean
  /** レア別余剰しきい値(部分指定可、デフォルトとマージ)。`stockBuffer.normal` の指定が無い場合のフォールバックにも使う。 */
  surplusThreshold?: Partial<SurplusThreshold>
  /** カテゴリ群×レア別ストックバッファ(部分指定可、デフォルトとマージ)。 */
  stockBuffer?: PartialStockBuffer
  /** 余剰ストックを目標に含めるグローバル設定(default false)。ON で余剰ストック帯が次点(0.3)から目標(1.0)に昇格する。 */
  stockEnabled?: boolean
  /** 効率の分母。'ap'(default=AP効率) か 'turn'(周回効率=ターン数で割る)。 */
  denominator?: EfficiencyDenominator
  /** QP 報酬を効率ポイントに加算する(default false)。 */
  includeQp?: boolean
  /** 基本絆P を効率ポイントに加算する(default false)。 */
  includeBond?: boolean
  /** マスターEXP を効率ポイントに加算する(default false)。 */
  includeExp?: boolean
}

/** 報酬(擬似アイテム)の contribution itemId プレフィックス。 */
export const REWARD_ITEM_PREFIX = 'reward:'
type RewardDef = { key: 'qp' | 'bond' | 'exp'; field: 'qp' | 'bondPoints' | 'exp' }
const REWARD_DEFS: RewardDef[] = [
  { key: 'qp', field: 'qp' },
  { key: 'bond', field: 'bondPoints' },
  { key: 'exp', field: 'exp' },
]

export type ItemContribution = {
  itemId: string
  dropRate: number
  /** その素材の最良クエストに対する相対効率(0〜1)。 */
  relativeEff: number
  /** 個人最適化の重み(0 / 0.3 / 1)。 */
  weight: number
  /** relativeEff × weight。 */
  weighted: number
}

export type QuestEfficiency = {
  questId: string
  score: number
  /** weighted 降順の素材別内訳。 */
  contributions: ItemContribution[]
}

type ItemLike = { id: string; category: string; largeCategory?: string; atlasId?: number }

/** 所持数・必要数(material/result)は Atlas ID 空間で持つため、アイテムの参照キーは atlasId を優先。 */
const possessionKey = (item: ItemLike): string => (item.atlasId != null ? String(item.atlasId) : item.id)

/**
 * 旧 `efficiency/surplusThreshold`(flat 金銀銅)から `stockBuffer.normal` への移行込みで
 * `stockBuffer` を解決する。`storedStockBuffer` が既に保存されていればそれを優先し、
 * 無ければ `legacySurplusThreshold`(旧キー)を `normal` 群の初期値として使う
 * (skillStone/monumentPiece は常にデフォルト)。新規ユーザー(両方未設定)はデフォルトのまま。
 */
export const resolveStockBuffer = (
  storedStockBuffer: PartialStockBuffer | null | undefined,
  legacySurplusThreshold: Partial<SurplusThreshold> | null | undefined,
): StockBuffer => {
  if (storedStockBuffer != null) {
    return {
      normal: { ...DEFAULT_STOCK_BUFFER.normal, ...storedStockBuffer.normal },
      skillStone: { ...DEFAULT_STOCK_BUFFER.skillStone, ...storedStockBuffer.skillStone },
      monumentPiece: { ...DEFAULT_STOCK_BUFFER.monumentPiece, ...storedStockBuffer.monumentPiece },
    }
  }
  return {
    normal: { ...DEFAULT_STOCK_BUFFER.normal, ...(legacySurplusThreshold ?? {}) },
    skillStone: { ...DEFAULT_STOCK_BUFFER.skillStone },
    monumentPiece: { ...DEFAULT_STOCK_BUFFER.monumentPiece },
  }
}

/**
 * アイテムのストックバッファ個数(`stockBuffer[group(item)][rarity(item)]`)。
 * レアリティ不明の素材はストック対象外として 0 を返す(D7/D3)。
 */
export const buffer = (item: ItemLike, stockBuffer: StockBuffer): number => {
  const rarity = getRarityByCategory(item.category)
  if (!rarity) return 0
  const group: CategoryGroup = categoryGroup(item.largeCategory)
  return stockBuffer[group][rarity] ?? 0
}

/**
 * 実効必要数 = 育成必要数 + (stockEnabled ? buffer(item) : 0)。
 * 全 farming 画面(クエスト効率・周回ソルバー取り込み・配布アドバイザー)が
 * 同じ定義を参照することで「今どちらの目標で見ているか」の不整合を構造的に防ぐ(D3)。
 */
export const effectiveRequired = (
  item: ItemLike,
  trainingRequired: number,
  stockBuffer: StockBuffer,
  stockEnabled: boolean,
): number => trainingRequired + (stockEnabled ? buffer(item, stockBuffer) : 0)

/** 実効不足 = max(0, 実効必要数 − 所持)。 */
export const effectiveDeficiency = (
  item: ItemLike,
  trainingRequired: number,
  owned: number,
  stockBuffer: StockBuffer,
  stockEnabled: boolean,
): number => Math.max(0, effectiveRequired(item, trainingRequired, stockBuffer, stockEnabled) - owned)

/**
 * 単一素材の重みを決定する(2段階)。
 *   - includeSkillStones=false かつスキル石 → 0
 *   - includePieces=false かつモニュピ → 0
 *   - 全部モード → 1(stockEnabled に関わらず)
 *   - 不足(owned < goal) → 1(主優先)
 *   - goal ≤ owned < effGoal(余剰ストック範囲) → stockEnabled=OFF なら次点(0.3)、ON なら目標(1)に昇格
 *   - owned ≥ effGoal(ストック込み目標達成 / レア不明) → 0
 * `effGoal = goal + (stockEnabled ? buffer(item) : 0)`。目標未設定(goal=0)の素材は
 * `effGoal = stockEnabled ? buffer(item) : 0` となり、ON 時は「全素材を一定数ストック」の
 * 意図に合致する。
 */
export const computeItemWeight = (
  item: ItemLike,
  owned: number,
  goal: number,
  opts: {
    shortageOnly: boolean
    includeSkillStones: boolean
    includePieces: boolean
    stockBuffer: StockBuffer
    stockEnabled: boolean
  },
): number => {
  if (!opts.includeSkillStones && isSkillStone(item.largeCategory)) return 0
  if (!opts.includePieces && isMonumentOrPiece(item.largeCategory)) return 0
  if (!opts.shortageOnly) return 1
  if (owned < goal) return 1
  const buf = buffer(item, opts.stockBuffer)
  // 余剰ストック範囲(goal <= owned < goal+buf)の判定には常に buf(=stockBuffer)を使う。
  // stockEnabled はこの範囲内での重みの強度(次点0.3 / 目標1.0)だけを切り替える(D2)。
  if (owned >= goal + buf) return 0
  return opts.stockEnabled ? 1 : SECONDARY_WEIGHT
}

/**
 * 全クエストの効率ポイントを算出し、score 降順で返す。
 * 規模は(クエスト数 数百)×(素材 ~95)で軽量。
 */
export const computeQuestEfficiency = (
  drops: Drops,
  options: QuestEfficiencyOptions = {},
): QuestEfficiency[] => {
  const {
    possession = {},
    goals = {},
    activeCampaigns = [],
    shortageOnly = true,
    includeSkillStones = true,
    includePieces = true,
    stockEnabled = false,
    denominator = 'ap',
    includeQp = false,
    includeBond = false,
    includeExp = false,
  } = options
  // 旧 `surplusThreshold` は normal 群のフォールバック(移行元)。`stockBuffer` が明示されれば優先。
  // 解決ロジックは resolveStockBuffer に集約(コンポーネント側のフック useStockTarget と同一)。
  const resolvedStockBuffer = resolveStockBuffer(options.stockBuffer ?? null, options.surplusThreshold)
  const enabledRewards = REWARD_DEFS.filter(
    r => (r.key === 'qp' && includeQp) || (r.key === 'bond' && includeBond) || (r.key === 'exp' && includeExp),
  )

  const itemById = new Map(drops.items.map(i => [i.id, i]))

  // クエストごとの「分母」。'ap'=実効AP / 'turn'=ターン数(wave数)。0以下は無効。
  const denomByQuest = new Map<string, number>()
  for (const q of drops.quests) {
    let denom: number
    if (denominator === 'turn') {
      const turns = (q as { waveCount?: number }).waveCount
      denom = turns != null && turns > 0 ? turns : DEFAULT_TURNS
    } else {
      denom = activeCampaigns.length > 0 ? computeEffectiveAp(q.ap, q.id, activeCampaigns) : q.ap
    }
    denomByQuest.set(q.id, denom)
  }

  // eff(i,q) = drop_rate / denom(q)。分母が0以下なら無効。
  const effOf = (dr: { quest_id: string; drop_rate: number }): number | null => {
    const denom = denomByQuest.get(dr.quest_id)
    if (denom == null || denom <= 0) return null
    return dr.drop_rate / denom
  }

  // bestEff per item = max(eff) across quests
  const bestEffByItem = new Map<string, number>()
  for (const dr of drops.drop_rates) {
    if (dr.drop_rate <= 0) continue
    const eff = effOf(dr)
    if (eff == null) continue
    if (eff > (bestEffByItem.get(dr.item_id) ?? 0)) bestEffByItem.set(dr.item_id, eff)
  }

  // weight per item (キャッシュ)
  const weightByItem = new Map<string, number>()
  const weightFor = (itemId: string): number => {
    const cached = weightByItem.get(itemId)
    if (cached != null) return cached
    const item = itemById.get(itemId)
    const key = item ? possessionKey(item) : itemId
    const w = item
      ? computeItemWeight(item, possession[key] ?? 0, goals[key] ?? 0, {
          shortageOnly,
          includeSkillStones,
          includePieces,
          stockBuffer: resolvedStockBuffer,
          stockEnabled,
        })
      : 0
    weightByItem.set(itemId, w)
    return w
  }

  // accumulate contributions per quest
  const acc = new Map<string, ItemContribution[]>()
  for (const dr of drops.drop_rates) {
    if (dr.drop_rate <= 0) continue
    const eff = effOf(dr)
    if (eff == null) continue
    const bestEff = bestEffByItem.get(dr.item_id)
    if (bestEff == null || bestEff <= 0) continue
    const weight = weightFor(dr.item_id)
    if (weight <= 0) continue
    const relativeEff = eff / bestEff
    const list = acc.get(dr.quest_id) ?? []
    list.push({
      itemId: dr.item_id,
      dropRate: dr.drop_rate,
      relativeEff,
      weight,
      weighted: relativeEff * weight,
    })
    acc.set(dr.quest_id, list)
  }

  // 報酬(QP/絆/EXP)の bestEff。各報酬を「最良クエストの 報酬/分母」で正規化する。
  const amountOf = (q: { [k: string]: unknown }, field: string): number => {
    const v = q[field]
    return typeof v === 'number' && v > 0 ? v : 0
  }
  const bestEffReward = new Map<string, number>()
  for (const rw of enabledRewards) {
    let best = 0
    for (const q of drops.quests) {
      const denom = denomByQuest.get(q.id)
      const amount = amountOf(q as unknown as Record<string, unknown>, rw.field)
      if (amount > 0 && denom != null && denom > 0) best = Math.max(best, amount / denom)
    }
    if (best > 0) bestEffReward.set(rw.key, best)
  }

  const result: QuestEfficiency[] = drops.quests.map(q => {
    const contributions = [...(acc.get(q.id) ?? [])]
    // 報酬を擬似アイテムとして加算(トグルON時、weight=1)。
    const denom = denomByQuest.get(q.id)
    if (denom != null && denom > 0) {
      for (const rw of enabledRewards) {
        const best = bestEffReward.get(rw.key)
        const amount = amountOf(q as unknown as Record<string, unknown>, rw.field)
        if (best != null && best > 0 && amount > 0) {
          const relativeEff = amount / denom / best
          contributions.push({
            itemId: `${REWARD_ITEM_PREFIX}${rw.key}`,
            dropRate: amount,
            relativeEff,
            weight: 1,
            weighted: relativeEff,
          })
        }
      }
    }
    contributions.sort((a, b) => b.weighted - a.weighted)
    const score = contributions.reduce((s, c) => s + c.weighted, 0)
    return { questId: q.id, score, contributions }
  })
  result.sort((a, b) => b.score - a.score)
  return result
}

/**
 * 必要数(目標)を Atlas ID 空間に統合する。
 * - materialResult: 育成計算機の必要数(Atlas ID キー)= 主ソース。
 * - itemsRaw: 周回ソルバー目標(短縮ID キー、文字列可)→ atlasId に変換して補完。
 */
export const mergeGoals = (
  materialResult: Record<string, number>,
  itemsRaw: Record<string, string | number | undefined>,
  dropItems: { id: string; atlasId?: number }[],
): Record<string, number> => {
  const shortToAtlas = new Map<string, number>()
  for (const i of dropItems) if (i.atlasId != null) shortToAtlas.set(i.id, i.atlasId)

  const out: Record<string, number> = {}
  for (const [shortId, v] of Object.entries(itemsRaw)) {
    const atlas = shortToAtlas.get(shortId)
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
    if (atlas != null && Number.isFinite(n) && n > 0) out[String(atlas)] = n
  }
  for (const [atlasId, n] of Object.entries(materialResult)) {
    if (Number.isFinite(n) && n > 0) out[atlasId] = n // material/result が優先
  }
  return out
}

/**
 * 必要数(目標)・所持数(いずれも atlasId キー)から、ストック込みの実効不足を
 * apiItemId キー(drops の短縮ID)で組み立てる。進捗レポートの周回換算(`lib/progress/lap-value.ts`)
 * は素材ごとの単価換算に `effectiveRequired` を直接使うため本関数は経由しない ──
 * 配布アドバイザー(material-selection-advisor.tsx)・周回ソルバー取り込み(material/result.tsx)
 * など、ストック目標を反映すべき全消費者がこの関数(or 同じ `effectiveDeficiency`)を
 * 経由することで、画面間の不足数の不整合を構造的に防ぐ(D3)。
 */
export const buildNeedByApiItemId = (
  targets: Record<string, number | string | undefined>,
  possession: Record<string, number | string | undefined>,
  drops: Drops,
  stockBuffer: StockBuffer,
  stockEnabled: boolean,
): Record<string, number> => {
  const toNum = (v: number | string | undefined): number => {
    const n = typeof v === 'string' ? Number(v) : v
    return Number.isFinite(n) ? (n as number) : 0
  }
  const need: Record<string, number> = {}
  for (const item of drops.items) {
    const atlasId = (item as { atlasId?: number }).atlasId
    if (atlasId == null) continue
    const key = String(atlasId)
    const required = toNum(targets[key])
    const owned = toNum(possession[key])
    const deficit = effectiveDeficiency(item, required, owned, stockBuffer, stockEnabled)
    if (deficit > 0) need[item.id] = deficit
  }
  return need
}

/** 単一クエストの効率ポイント(詳細ページ用)。該当が無ければ null。 */
export const computeSingleQuestEfficiency = (
  drops: Drops,
  questId: string,
  options: QuestEfficiencyOptions = {},
): QuestEfficiency | null =>
  computeQuestEfficiency(drops, options).find(q => q.questId === questId) ?? null

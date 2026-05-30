import { Drops } from './get-drops'
import { Campaign } from '../interfaces/fgodrop'
import { computeEffectiveAp } from './solver'
import { getRarityByCategory, isPiece, isSkillStone, Rarity } from './item-rarity'

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

/** レア別余剰しきい値のデフォルト。充足済みでも余剰がこれ以下なら「次点」で拾う。 */
export const DEFAULT_SURPLUS_THRESHOLD: SurplusThreshold = {
  gold: 50,
  silver: 100,
  bronze: 200,
}

/** 次点(充足済みだが余剰が少ない素材)の重み。 */
export const SECONDARY_WEIGHT = 0.3

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
  /** レア別余剰しきい値(部分指定可、デフォルトとマージ)。 */
  surplusThreshold?: Partial<SurplusThreshold>
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
 * 単一素材の重みを決定する(2段階)。
 *   - includeSkillStones=false かつスキル石 → 0
 *   - 全部モード → 1
 *   - 不足(owned < goal) → 1
 *   - 充足済みで余剰 ≤ レア別しきい値 → SECONDARY_WEIGHT(次点)
 *   - 余剰 > しきい値 / レア不明 → 0
 * 目標未設定(goal=0)の素材は余剰=所持数となり、同じしきい値が「低所持素材を拾う」基準も兼ねる。
 */
export const computeItemWeight = (
  item: ItemLike,
  owned: number,
  goal: number,
  opts: { shortageOnly: boolean; includeSkillStones: boolean; includePieces: boolean; threshold: SurplusThreshold },
): number => {
  if (!opts.includeSkillStones && isSkillStone(item.largeCategory)) return 0
  if (!opts.includePieces && isPiece(item.category)) return 0
  if (!opts.shortageOnly) return 1
  if (owned < goal) return 1
  const rarity = getRarityByCategory(item.category)
  if (!rarity) return 0
  const surplus = owned - goal
  return surplus <= opts.threshold[rarity] ? SECONDARY_WEIGHT : 0
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
    denominator = 'ap',
    includeQp = false,
    includeBond = false,
    includeExp = false,
  } = options
  const threshold: SurplusThreshold = { ...DEFAULT_SURPLUS_THRESHOLD, ...(options.surplusThreshold ?? {}) }
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
          threshold,
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

/** 単一クエストの効率ポイント(詳細ページ用)。該当が無ければ null。 */
export const computeSingleQuestEfficiency = (
  drops: Drops,
  questId: string,
  options: QuestEfficiencyOptions = {},
): QuestEfficiency | null =>
  computeQuestEfficiency(drops, options).find(q => q.questId === questId) ?? null

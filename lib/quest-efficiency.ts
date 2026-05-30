import { Drops } from './get-drops'
import { Campaign } from '../interfaces/fgodrop'
import { computeEffectiveAp } from './solver'
import { getRarityByCategory, isSkillStone, Rarity } from './item-rarity'

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
  /** 所持数 itemId -> owned count */
  possession?: Record<string, number | undefined>
  /** 目標 itemId -> required count */
  goals?: Record<string, number | undefined>
  /** effective-AP 補正用のアクティブキャンペーン。空なら元 AP。 */
  activeCampaigns?: Campaign[]
  /** 不足のみモード(true、default)か全部モード(false)。 */
  shortageOnly?: boolean
  /** スキル石を含めるか(default true)。false で「石除く」。 */
  includeSkillStones?: boolean
  /** レア別余剰しきい値(部分指定可、デフォルトとマージ)。 */
  surplusThreshold?: Partial<SurplusThreshold>
  /** 効率の分母。'ap'(default=AP効率) か 'turn'(周回効率=ターン数で割る)。 */
  denominator?: EfficiencyDenominator
}

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

type ItemLike = { id: string; category: string; largeCategory?: string }

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
  opts: { shortageOnly: boolean; includeSkillStones: boolean; threshold: SurplusThreshold },
): number => {
  if (!opts.includeSkillStones && isSkillStone(item.largeCategory)) return 0
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
    denominator = 'ap',
  } = options
  const threshold: SurplusThreshold = { ...DEFAULT_SURPLUS_THRESHOLD, ...(options.surplusThreshold ?? {}) }

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
    const w = item
      ? computeItemWeight(item, possession[itemId] ?? 0, goals[itemId] ?? 0, {
          shortageOnly,
          includeSkillStones,
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

  const result: QuestEfficiency[] = drops.quests.map(q => {
    const contributions = (acc.get(q.id) ?? []).sort((a, b) => b.weighted - a.weighted)
    const score = contributions.reduce((s, c) => s + c.weighted, 0)
    return { questId: q.id, score, contributions }
  })
  result.sort((a, b) => b.score - a.score)
  return result
}

/** 単一クエストの効率ポイント(詳細ページ用)。該当が無ければ null。 */
export const computeSingleQuestEfficiency = (
  drops: Drops,
  questId: string,
  options: QuestEfficiencyOptions = {},
): QuestEfficiency | null =>
  computeQuestEfficiency(drops, options).find(q => q.questId === questId) ?? null

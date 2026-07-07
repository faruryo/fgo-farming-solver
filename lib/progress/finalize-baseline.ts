import type { PeriodSummary } from './types'
import { classifyTier, classifyEffortTier } from './tier'

// AP → 概算費用(円)。AP/2(半額) → スタミナ → 課金石 → 円の素朴換算。
export const yenFromAp = (ap: number): number =>
  Math.round((ap / 144 / 168) * 10000)

export type EnrichInputs = {
  /** 比較スナップショット以降に獲得した素材の合計個数(QP除外、表示用)。 */
  itemsFarmed: number
  /** 比較スナップショット以降に育成等で消費した素材の合計個数(QP除外、表示用)。 */
  itemsConsumed: number
  /** 前進周回(tier 主指標)・AP相当(内訳表示)。lap-value.ts 未算出なら undefined。 */
  forwardLaps?: number
  forwardApEquivalent?: number
  /** 労力周回(前進ゼロ時の tier 補完・表示に使用)。 */
  effortLaps?: number
}

// enriched(クライアント)で baseline を確定する純ロジック。
//   - tier の主指標は「前進周回(forwardLaps) ÷ 経過日数」。classifyTier が
//     design.md D2 のしきい値(0/>0/≥5/≥15/≥60)で5段階判定する。
//   - forwardLaps が無い/0以下の日は、労力周回(effortLaps)で tier を補完する
//     (classifyEffortTier、legendary には到達させず large を上限)。
//   - forwardLaps/ApEquivalent/Yen・effortLaps・itemsFarmed/Consumed は表示用に保持。
//   - fallback(zero_progress)は前進周回・労力周回・育成総量・新規入手が
//     すべて無いときのみ。いずれかがあれば実進捗として扱う。
//
// 重要: ここで fallback='zero_progress' を付けても、それは「実際に比較できたが
// 変化が無かった」ことを表す。比較対象が無い no_snapshot_for_period とは別物であり、
// selectBaseline はこの区別を保って前者を優先する(往復選定での誤フォールバック防止)。
export const finalizeBaselineSummary = (
  baseline: PeriodSummary,
  inputs: EnrichInputs
): PeriodSummary => {
  const { itemsFarmed, itemsConsumed, forwardLaps, forwardApEquivalent, effortLaps } = inputs
  const hasForward = forwardLaps != null && forwardLaps > 0
  const effort = effortLaps ?? 0
  // 主指標: 前進周回/日。無い/0以下なら労力周回で補完(large 上限)。
  const tier = hasForward
    ? classifyTier(forwardLaps as number, baseline.elapsedMinutes)
    : classifyEffortTier(effort, baseline.elapsedMinutes)
  const fallback: PeriodSummary['fallback'] =
    !hasForward &&
    effort <= 0 &&
    baseline.growthTotal <= 0 &&
    baseline.newServantCount === 0
      ? 'zero_progress'
      : null

  return {
    ...baseline,
    itemsFarmed,
    itemsConsumed,
    forwardLaps,
    forwardApEquivalent,
    forwardYen: forwardApEquivalent != null ? yenFromAp(forwardApEquivalent) : undefined,
    effortLaps,
    tier,
    fallback,
  }
}

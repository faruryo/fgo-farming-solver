import type { PeriodSummary } from './types'
import { classifyTierByThroughput } from './throughput'

// 残りAP → 概算費用(円)。AP/2(半額) → スタミナ → 課金石 → 円の素朴換算。
export const yenFromAp = (ap: number): number =>
  Math.round((ap / 144 / 168) * 10000)

export type EnrichInputs = {
  /** 比較スナップショット以降に獲得した素材の合計個数(QP除外)。 */
  itemsFarmed: number
  /** 比較スナップショット以降に育成等で消費した素材の合計個数(QP除外)。 */
  itemsConsumed: number
  /** 目標固定再ソルブによる残りAP減少(副指標)。ソルバー未実行なら undefined。 */
  reducedAp?: number
  reducedLap?: number
}

// enriched(クライアント)で baseline を確定する純ロジック。
//   - tier はスループット(獲得+育成投入)で判定(育成投入した日も none にしない)。
//   - reducedAp/Lap/Yen は副指標として保持(>0 の日のみ表示は描画側の責務)。
//   - fallback(zero_progress)はスループット・育成総量・新規入手・reducedAp が
//     すべて無いときのみ。いずれかがあれば実進捗として扱う。
//
// 重要: ここで fallback='zero_progress' を付けても、それは「実際に比較できたが
// 変化が無かった」ことを表す。比較対象が無い no_snapshot_for_period とは別物であり、
// selectBaseline はこの区別を保って前者を優先する(往復選定での誤フォールバック防止)。
export const finalizeBaselineSummary = (
  baseline: PeriodSummary,
  inputs: EnrichInputs
): PeriodSummary => {
  const { itemsFarmed, itemsConsumed, reducedAp, reducedLap } = inputs
  const throughput = itemsFarmed + itemsConsumed
  const tier = classifyTierByThroughput(throughput, baseline.elapsedMinutes)

  const noReduced = reducedAp == null || reducedAp <= 0
  const fallback: PeriodSummary['fallback'] =
    throughput <= 0 &&
    baseline.growthTotal <= 0 &&
    baseline.newServantCount === 0 &&
    noReduced
      ? 'zero_progress'
      : null

  return {
    ...baseline,
    itemsFarmed,
    itemsConsumed,
    reducedAp,
    reducedLap,
    reducedYen: reducedAp != null ? yenFromAp(reducedAp) : undefined,
    tier,
    fallback,
  }
}

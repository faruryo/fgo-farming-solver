import type { EfficiencyDenominator } from './quest-efficiency'

export type EfficiencyScoreLabelKey = 'ap-efficiency-score' | 'turn-efficiency-score'

/** スコア見出しの i18n キー。分母で切り替えて AP/周回の取り違えを防ぐ。 */
export const efficiencyScoreLabelKey = (
  denominator: EfficiencyDenominator,
): EfficiencyScoreLabelKey =>
  denominator === 'turn' ? 'turn-efficiency-score' : 'ap-efficiency-score'

/** `t()` 第2引数用の日本語フォールバック。 */
export const efficiencyScoreLabelFallback = (denominator: EfficiencyDenominator): string =>
  denominator === 'turn' ? '周回効率ポイント' : 'AP効率ポイント'

/** スコア（数値・見出し）の色。APは金、周回はスチールで対比する。 */
export const efficiencyScoreColorVar = (denominator: EfficiencyDenominator): string =>
  denominator === 'turn' ? 'var(--efficiency-turn)' : 'var(--efficiency-ap)'

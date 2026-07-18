import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import type { ProgressTier } from './types'
import type { Rarity } from './rarity-ap-sample'

const isOwned = (entry: ChaldeaState[string] | undefined): boolean =>
  entry != null && entry.disabled === false

export type NewServantEntry = {
  servantId: string
  rarity: Rarity | null
}

// New servants are those that flipped from disabled=true to disabled=false
// between the past snapshot and the current state. When the past snapshot has
// no chaldea state recorded (material absent → past=null), the true→false
// transition is unobservable, so we report zero new servants rather than
// counting the entire roster as "new" (which would inflate deltaAp with a
// phantom offset). See progress-visualizer spec: 新規サーヴァント検出.
export const detectNewServants = (
  current: ChaldeaState | null,
  past: ChaldeaState | null,
  rarityById: Map<string, Rarity>
): NewServantEntry[] => {
  if (!current || !past) return []
  const entries: NewServantEntry[] = []
  for (const [id, entry] of Object.entries(current)) {
    if (id === 'all') continue
    if (!isOwned(entry)) continue
    if (isOwned(past[id])) continue
    entries.push({ servantId: id, rarity: rarityById.get(id) ?? null })
  }
  return entries
}

// 5段階しきい値(1日あたり推定周回数)。design.md 2026-07-18 の実測較正(ユーザー1名の
// 体感に基づく指定値)による: legendary=100 / large=30 / medium=15。自然回復量
// (288AP/日)への厳密なアンカーではない(比較窓を30/60/90日に拡張し「不当に低く出る」
// 問題は窓選定側で解決したため、しきい値自体はユーザー最終判断の実測値を採用した)。
// 一箇所に集約し調整可能にする。
export const LAP_TIER_THRESHOLDS = {
  legendary: 100,
  large: 30,
  medium: 15,
} as const

// 5-tier classification (design.md D1/D2)。
// laps: 周回換算値(前進周回、または補完時は労力周回)。目標に対する消費中立の
// 増分を周回数に独立換算したもので、LP再ソルブ(compute-reduction.ts)を経由しない。
export const classifyTier = (
  laps: number,
  elapsedMinutes: number
): ProgressTier => {
  if (laps <= 0) return 'none'
  if (elapsedMinutes <= 0) {
    // No elapsed time → any positive value counts as large (legendary は避ける)。
    return 'large'
  }
  const perDay = laps / (elapsedMinutes / 1440)
  if (perDay >= LAP_TIER_THRESHOLDS.legendary) return 'legendary'
  if (perDay >= LAP_TIER_THRESHOLDS.large) return 'large'
  if (perDay >= LAP_TIER_THRESHOLDS.medium) return 'medium'
  return 'small'
}

// 労力周回による tier 補完(design.md D4)。同じしきい値を適用するが、legendary は
// 前進周回限定のため large を上限にキャップする(備蓄王が毎回最上位になるインフレ防止)。
export const classifyEffortTier = (
  effortLaps: number,
  elapsedMinutes: number
): ProgressTier => {
  const tier = classifyTier(effortLaps, elapsedMinutes)
  return tier === 'legendary' ? 'large' : tier
}

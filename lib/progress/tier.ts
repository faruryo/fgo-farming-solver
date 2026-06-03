import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import type { ProgressTier } from './types'
import type { Rarity } from './rarity-ap-sample'
import type { RarityApTable } from './rarity-ap-table'

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

export const sumNewServantOffsetAp = (
  newServants: NewServantEntry[],
  apTable: RarityApTable
): number => {
  let total = 0
  for (const { rarity } of newServants) {
    if (rarity == null) continue
    total += apTable[rarity] ?? 0
  }
  return total
}

// 4-tier classification.
// reducedAp: アイテム入手により「残りに必要なAP」が減った量(正で進捗)。
// 目標を現在で固定した再ソルブで算出され、目標増加の影響は含まない。
export const classifyTier = (
  reducedAp: number,
  elapsedMinutes: number
): ProgressTier => {
  const deltaAp = reducedAp
  if (deltaAp <= 0) return 'none'
  const naturalRecoveryAp = elapsedMinutes / 5
  if (naturalRecoveryAp <= 0) {
    // No elapsed time → any positive delta counts as large.
    return 'large'
  }
  if (deltaAp >= naturalRecoveryAp * 1.5) return 'large'
  if (deltaAp >= naturalRecoveryAp) return 'medium'
  return 'small'
}

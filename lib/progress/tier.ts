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

// New servants are those that flipped from disabled=true (or missing) in the
// past snapshot to disabled=false in the current state.
export const detectNewServants = (
  current: ChaldeaState | null,
  past: ChaldeaState | null,
  rarityById: Map<string, Rarity>
): NewServantEntry[] => {
  if (!current) return []
  const entries: NewServantEntry[] = []
  for (const [id, entry] of Object.entries(current)) {
    if (id === 'all') continue
    if (!isOwned(entry)) continue
    if (past && isOwned(past[id])) continue
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

// 4-tier classification per design.md Decision #3.
// deltaAp: AP saved between snapshots (positive when target ap decreased),
// already adjusted for new-servant offsets by the caller.
export const classifyTier = (
  deltaAp: number,
  elapsedMinutes: number
): ProgressTier => {
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

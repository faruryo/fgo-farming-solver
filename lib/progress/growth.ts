import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import { servantGrowthSum } from './diff'
import type { ServantGrowthEntry } from './types'

// Returns a list of servants whose total growth-target window shrank from
// past → current (i.e. user reduced the remaining range by actually leveling
// up). Shrink is treated as positive progress.
export const computeServantGrowthDeltas = (
  current: ChaldeaState | null,
  past: ChaldeaState | null,
  nameById?: Map<string, string>
): ServantGrowthEntry[] => {
  if (!current || !past) return []
  const out: ServantGrowthEntry[] = []
  for (const [id, currentEntry] of Object.entries(current)) {
    if (id === 'all') continue
    const pastEntry = past[id]
    if (!pastEntry) continue
    const currentSum = servantGrowthSum(currentEntry)
    const pastSum = servantGrowthSum(pastEntry)
    const delta = pastSum - currentSum
    if (delta > 0) {
      out.push({
        servantId: id,
        servantName: nameById?.get(id),
        delta,
      })
    }
  }
  out.sort((a, b) => b.delta - a.delta)
  return out
}

// Target AP increased when the past snapshot's target ap is LESS than now's.
// Caller passes the current target_ap (from the most recent solver run or
// derived from the current items) and the past one (likewise).
export const computeTargetApIncrease = (
  currentTargetAp: number,
  pastTargetAp: number
): number => Math.max(0, currentTargetAp - pastTargetAp)

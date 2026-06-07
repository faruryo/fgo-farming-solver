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

// 所持(disabled=false)サーヴァントのスキル現在レベル(各スキルの range.start)の合計。
// スキルは 1..10 の 3 つ。未所持サーヴァントは数えない。
const sumOwnedSkillLevels = (state: ChaldeaState | null): number => {
  if (!state) return 0
  let total = 0
  for (const [id, sv] of Object.entries(state)) {
    if (id === 'all' || !sv || sv.disabled) continue
    const skill = sv.targets?.skill
    if (!skill || skill.disabled) continue
    for (const r of skill.ranges) total += r.start ?? 0
  }
  return total
}

// スキル合計の変化 = 現在の所持スキルレベル合計 − 過去の所持スキルレベル合計。
// computeServantGrowthDeltas と違い新規入手サーヴァントも含む(過去は未所持=0 扱い)ため、
// 新キャラのスキル育成も「増分」として捕捉できる。
export const computeSkillLevelDelta = (
  current: ChaldeaState | null,
  past: ChaldeaState | null
): number => sumOwnedSkillLevels(current) - sumOwnedSkillLevels(past)

// Target AP increased when the past snapshot's target ap is LESS than now's.
// Caller passes the current target_ap (from the most recent solver run or
// derived from the current items) and the past one (likewise).
export const computeTargetApIncrease = (
  currentTargetAp: number,
  pastTargetAp: number
): number => Math.max(0, currentTargetAp - pastTargetAp)

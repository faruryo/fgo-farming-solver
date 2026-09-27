import { bondIncrement } from './estimate'

/**
 * 到達見込みの概算に使う定数。いずれも自然回復・配布だけを見た近似で、果実やイベント配布は含めない。
 * - AP: 5分で1回復 → 1日288
 * - ストーム・ポッド: ログインボーナス 3個/日 + 交換 40個/月(30日換算)。所持上限9は長期では無視できるとみなす
 */
export const AP_PER_DAY = 288
export const PODS_PER_DAY = 3
export const PODS_PER_MONTH = 40

export type Bottleneck = 'ap' | 'pods' | null

export const timeToGoal = ({ ap, pods }: { ap: number; pods: number }) => {
  const apDays = ap / AP_PER_DAY
  // 30日あたりの供給で割って浮動小数の誤差を避ける
  const podDays = (pods * 30) / (PODS_PER_DAY * 30 + PODS_PER_MONTH)
  const days = Math.ceil(Math.max(apDays, podDays))
  if (days === 0) return { days, bottleneck: null as Bottleneck }
  return { days, bottleneck: (podDays > apDays ? 'pods' : 'ap') as Bottleneck }
}

/** 累計絆(bondGrowth)での、目標Lvまでの到達率(0〜1)。見積もれない入力なら null。 */
export const bondProgress = (
  growth: readonly number[] | undefined,
  { currentLevel, remainingToNext, targetLevel }: { currentLevel: number; remainingToNext: number; targetLevel: number },
): number | null => {
  const toNext = bondIncrement(growth, currentLevel)
  const goal = growth?.[targetLevel - 1]
  if (toNext === null || !goal) return null
  const earned = (growth?.[currentLevel - 1] ?? 0) + toNext - remainingToNext
  return Math.min(1, Math.max(0, earned / goal))
}

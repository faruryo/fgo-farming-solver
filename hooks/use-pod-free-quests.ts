import { useMemo } from 'react'
import type { PodFreePeriod } from '../lib/master-data/types'

export type PodFreeQuestsState = {
  /** ポッド消費なし期間中か否か。1 件以上 active 期間があるなら true。 */
  isActive: boolean
  /** Active 期間に含まれる全 questId を union した Set。期間外は空集合。 */
  questIds: Set<string>
  /** 直近に終了する active 期間 (最上段強調用)。 */
  currentPeriod?: PodFreePeriod
}

/**
 * Pure derivation used by both `usePodFreeQuests` and its tests.
 * Filters `podFreePeriods` by current time and returns a union questId Set.
 */
export const computePodFreeQuestsState = (
  podFreePeriods: PodFreePeriod[] | undefined,
  nowSec: number,
): PodFreeQuestsState => {
  const periods = podFreePeriods ?? []
  const active = periods.filter(p => p.startedAt <= nowSec && p.endedAt > nowSec)
  if (active.length === 0) {
    return { isActive: false, questIds: new Set<string>() }
  }
  const questIds = new Set<string>()
  for (const p of active) {
    for (const id of p.questIds) questIds.add(id)
  }
  const currentPeriod = active.reduce((a, b) => (a.endedAt <= b.endedAt ? a : b))
  return { isActive: true, questIds, currentPeriod }
}

/**
 * "ストーム・ポッド消費なし" 期間を判定する hook。
 * `dashboardMeta.podFreePeriods` を入力として、現在時刻 (秒) で active な期間を抽出する。
 * 古いデータで `podFreePeriods` が未定義の場合は空状態でフォールバックする。
 */
export const usePodFreeQuests = (
  podFreePeriods: PodFreePeriod[] | undefined,
  nowSec: number,
): PodFreeQuestsState => {
  return useMemo(
    () => computePodFreeQuestsState(podFreePeriods, nowSec),
    [podFreePeriods, nowSec],
  )
}

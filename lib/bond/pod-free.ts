import type { PodFreePeriod } from '../master-data/types'
import { AP_PER_DAY } from './progress'

const SECONDS_PER_DAY = 24 * 60 * 60

/** ストームポッド消費なし期間の見積もりに使う入力。期間のデータが無ければ空の表を渡す。 */
export type PodFreeContext = {
  /** questId → そのクエストを含む有効な期間の終わり(秒)。 */
  podFreeEndsAt: ReadonlyMap<string, number>
  nowSec: number
  /** りんご・石を使う: 期間中の周回をすべて無料と数え、AP の上限を置かない。 */
  useApples: boolean
}

/** 有効な期間の判定は computePodFreeQuestsState と同じ。複数の期間に含まれるクエストは遅い終わりを使う。 */
export const podFreeEndsAtByQuest = (
  podFreePeriods: readonly PodFreePeriod[] | undefined,
  nowSec: number,
): Map<string, number> => {
  const endsAt = new Map<string, number>()
  for (const period of podFreePeriods ?? []) {
    if (!(period.startedAt <= nowSec && period.endedAt > nowSec)) continue
    for (const questId of period.questIds) {
      endsAt.set(questId, Math.max(endsAt.get(questId) ?? 0, period.endedAt))
    }
  }
  return endsAt
}

/** 期間の残り時間に自然回復する AP。端数の日も含める。 */
const apUntil = (remainingSec: number) => (Math.max(0, remainingSec) * AP_PER_DAY) / SECONDS_PER_DAY

/** 1つのクエストを単独で回すときに、期間内に無料と数える周回数。 */
export const podFreeRuns = ({
  remainingSec,
  effectiveAp,
  runs,
  useApples,
}: {
  remainingSec: number
  effectiveAp: number
  runs: number
  useApples: boolean
}): number => {
  if (runs <= 0) return 0
  if (useApples || effectiveAp <= 0) return runs
  return Math.min(runs, Math.floor(apUntil(remainingSec) / effectiveAp))
}

export type PodFreeDemand = {
  questId: string
  remainingSec: number
  effectiveAp: number
  runs: number
}

/**
 * 期間中のクエストが複数あるとき、同じ時間帯の自然回復の AP を2回数えないように分け合う。
 * 終わりの早い期間から順に、そこまでの累計 AP の残りを必要 AP の割合で分け、必要 AP を上限にして余りを後に回す。
 */
export const allocatePodFreeRuns = (
  demands: readonly PodFreeDemand[],
  useApples: boolean,
): Map<string, number> => {
  const freeRuns = new Map<string, number>()
  const shared: PodFreeDemand[] = []
  for (const demand of demands) {
    if (useApples || demand.effectiveAp <= 0) freeRuns.set(demand.questId, Math.max(0, demand.runs))
    else shared.push(demand)
  }
  const byEnd = new Map<number, PodFreeDemand[]>()
  for (const demand of shared) byEnd.set(demand.remainingSec, [...(byEnd.get(demand.remainingSec) ?? []), demand])
  let used = 0
  for (const [remainingSec, group] of [...byEnd].sort(([a], [b]) => a - b)) {
    const available = Math.max(0, apUntil(remainingSec) - used)
    const need = (demand: PodFreeDemand) => Math.max(0, demand.runs) * demand.effectiveAp
    const totalNeed = group.reduce((sum, demand) => sum + need(demand), 0)
    for (const demand of group) {
      const ap = totalNeed > 0 ? Math.min(need(demand), (available * need(demand)) / totalNeed) : 0
      used += ap
      freeRuns.set(demand.questId, Math.floor(ap / demand.effectiveAp))
    }
  }
  return freeRuns
}

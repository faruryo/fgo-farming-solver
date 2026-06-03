import type { Drops } from '../get-drops'
import { solveBoth } from '../solver'
import type { Params } from '../../interfaces/api'

// 「アイテム入手による残りの減少」算出(方式1: 目標を現在で固定して再ソルブ)。
//
// 育成計算機の `material/result`(目標総数)と `posession`(所持)は atlasId キー、
// ソルバーは drops の短縮ID(apiItemId = item.id)キーで解く。drops の各 item が
// `atlasId` を保持しているので、それを橋渡しに need(= max(0, 目標 − 所持))を
// apiItemId キーで組み立てる。

type CountMap = Record<string, number | string | undefined>

const toNum = (v: number | string | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? (n as number) : 0
}

/**
 * 現在目標(atlasId キー)と所持(atlasId キー)から、ソルバー用 need(apiItemId キー)を作る。
 * need(item) = max(0, 目標 − 所持)。目標が無い/0 の素材は対象外。
 */
export const buildNeedByApiItemId = (
  targets: CountMap,
  posession: CountMap,
  drops: Drops
): Record<string, number> => {
  const need: Record<string, number> = {}
  for (const item of drops.items) {
    const atlasId = (item as { atlasId?: number }).atlasId
    if (atlasId == null) continue
    const key = String(atlasId)
    const goal = toNum(targets[key])
    if (goal <= 0) continue
    const owned = toNum(posession[key])
    const deficit = Math.max(0, goal - owned)
    if (deficit > 0) need[item.id] = deficit
  }
  return need
}

export type SolveTotals = { totalAp: number; totalLap: number }

/** need(apiItemId キー)を許可クエストで解き、AP最小/周回最小それぞれの総量を返す。 */
export const solveTotals = (
  drops: Drops,
  need: Record<string, number>,
  quests: string[]
): SolveTotals => {
  if (Object.keys(need).length === 0) return { totalAp: 0, totalLap: 0 }
  const params: Params = { objective: 'both', items: need, quests }
  // 進捗指標の安定のためキャンペーンは適用しない(nominal AP)。
  const res = solveBoth(drops, params, { applyCampaigns: false })
  return { totalAp: res.ap.total_ap, totalLap: res.lap.total_lap }
}

export type Reduction = { reducedAp: number; reducedLap: number }

/**
 * 目標を現在で固定し、所持だけ過去→現在へ動かしたときの残りAP/周回の減少量。
 *   reducedAp  = solve(現在目標 − 過去所持).total_ap  − solve(現在目標 − 現在所持).total_ap
 *   reducedLap = 同上の total_lap
 * 過去所持が無い場合は算出不能として null を返す。
 */
export const computeReduction = (
  drops: Drops,
  currentTargets: CountMap,
  currentPosession: CountMap,
  pastPosession: CountMap | null | undefined,
  quests: string[]
): Reduction | null => {
  if (pastPosession == null) return null
  const now = solveTotals(drops, buildNeedByApiItemId(currentTargets, currentPosession, drops), quests)
  const past = solveTotals(drops, buildNeedByApiItemId(currentTargets, pastPosession, drops), quests)
  return {
    reducedAp: past.totalAp - now.totalAp,
    reducedLap: past.totalLap - now.totalLap,
  }
}

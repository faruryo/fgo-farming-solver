import { useMemo } from 'react'
import { BothResult, Result, isBothResult, Params } from '../interfaces/api'
import { Drops } from '../lib/get-drops'
import { solve, solveBoth } from '../lib/solver'
import { useActiveCampaigns } from './use-active-campaigns'

/**
 * Re-solve the user's most recent farming targets against the current drops
 * data and currently-active AP campaigns. The saved result on D1 reflects the
 * state at solve time and may not include campaigns that started afterwards;
 * the dashboard always wants the campaign-reflected view, so we re-run the
 * LP locally on every mount whose inputs differ.
 *
 * Returns null when no recent result exists (the dashboard then falls back
 * to its "no recent calculation" UX upstream).
 */
export const useDashboardResult = (
  recentResult: Result | BothResult | null,
  drops: Drops | null,
): Result | BothResult | null => {
  const { activeCampaigns, digest, nowSec } = useActiveCampaigns(drops?.campaigns)

  return useMemo(() => {
    if (!recentResult || !drops || drops.quests.length === 0) return null

    const params: Params = isBothResult(recentResult)
      ? recentResult.lap.params
      : recentResult.params

    if (!params || !params.items || !params.quests) return null

    const options = { applyCampaigns: true as const, nowSec }

    const hasMatchingQuests = params.quests.some((id) =>
      drops.quests.some((q) => q.id === id)
    )
    if (!hasMatchingQuests) return null

    if (isBothResult(recentResult)) {
      const res = solveBoth(drops, params, options)
      if (res.ap.quests.length === 0 && res.lap.quests.length === 0) return null
      return res
    }
    const res = solve(drops, params, options)
    if (res.quests.length === 0) return null
    return res
    // `digest` and `activeCampaigns.length` are intentionally part of the
    // dep set so re-solves run only when the active campaign set changes
    // (in addition to drops / recentResult changes). They are derived from
    // drops.campaigns + the bucketed nowSec, so listing them keeps the
    // memo's invalidation explicit even though it's transitively covered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentResult, drops, digest, activeCampaigns.length, nowSec])
}

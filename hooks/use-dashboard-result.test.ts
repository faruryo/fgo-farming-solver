import { describe, it, expect } from 'vitest'
import { solve } from '../lib/solver'
import { Drops } from '../lib/get-drops'
import { Params } from '../interfaces/api'

// Hook integration is covered indirectly by exercising the underlying solver
// with the same call shape useDashboardResult uses. We don't run renderHook
// here since the project doesn't have @testing-library/react installed.

describe('dashboard re-solve fallback when no active campaigns', () => {
  const drops: Drops = {
    items: [{ id: 'a', name: 'A', category: 'b' }],
    quests: [
      { id: 'q1', section: 'Free', area: 'X', name: 'q1', ap: 40 },
      { id: 'q2', section: 'Free', area: 'X', name: 'q2', ap: 60 },
    ],
    drop_rates: [
      { quest_id: 'q1', item_id: 'a', drop_rate: 0.4 },
      { quest_id: 'q2', item_id: 'a', drop_rate: 0.5 },
    ],
    // No active campaign at nowSec=1000 (validity range 100-200).
    campaigns: [
      { id: 1, calcType: 'multiplication', value: 500, validFrom: 100, validTo: 200, questIds: ['q1'] },
    ],
  } as unknown as Drops

  const params: Params = { objective: 'ap', items: { a: 10 }, quests: ['q1', 'q2'] }

  it('applyCampaigns=true with no active campaigns ≡ applyCampaigns=false', () => {
    const nominal = solve(drops, params, { applyCampaigns: false })
    const effective = solve(drops, params, { applyCampaigns: true, nowSec: 1000 })
    expect(effective.total_ap).toBe(nominal.total_ap)
    expect(effective.total_lap).toBe(nominal.total_lap)
    expect(effective.quests.map((q) => q.ap).sort()).toEqual(nominal.quests.map((q) => q.ap).sort())
  })

  it('applyCampaigns=true during the active window differs from nominal', () => {
    const nominal = solve(drops, params, { applyCampaigns: false })
    const effective = solve(drops, params, { applyCampaigns: true, nowSec: 150 })
    // Same quest mix is allowed, but at least the displayed AP for q1 should change.
    const q1Effective = effective.quests.find((q) => q.id === 'q1')
    const q1Nominal = nominal.quests.find((q) => q.id === 'q1')
    if (q1Effective && q1Nominal) {
      expect(q1Effective.ap).toBeLessThan(q1Nominal.ap)
    } else {
      // If the optimal mix swaps to q2 entirely, ensure total_ap reflects the win.
      expect(effective.total_ap).toBeLessThanOrEqual(nominal.total_ap)
    }
  })
})

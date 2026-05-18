import { describe, it, expect } from 'vitest'
import { solve } from '../solver'
import type { Drops } from '../get-drops'

// Verifies that the call shape used inside `computeServantAp`
// (lib/progress/rarity-ap-sample.ts) stays campaign-agnostic. The rarity-AP
// table is intended to be a stable baseline — if a future refactor accidentally
// enables campaigns here, the table would drift with each AP-halve event.
describe('rarity-ap-sample solve call shape', () => {
  const drops: Drops = {
    items: [{ id: 'a', name: 'A', category: 'b' }],
    quests: [{ id: 'q1', section: 'Free', area: 'X', name: 'q1', ap: 40 }],
    drop_rates: [{ quest_id: 'q1', item_id: 'a', drop_rate: 1.0 }],
    campaigns: [
      // Aggressive long-running half-AP campaign for q1.
      { id: 1, calcType: 'multiplication', value: 500, validFrom: 0, validTo: 1e12, questIds: ['q1'] },
    ],
  } as unknown as Drops

  it('solve() with the rarity-ap-sample call shape ignores campaigns', () => {
    // Mirrors the actual call in computeServantAp:
    //   solve(drops, { objective: 'ap', items, quests: allowedQuestIds })
    const result = solve(drops, {
      objective: 'ap',
      items: { a: 5 },
      quests: ['q1'],
    })
    // 5 drops at 1.0 rate ⇒ 5 laps × 40 AP = 200 (nominal).
    // If campaigns were applied, total_ap would be 100 (= 5 × 20).
    expect(result.total_ap).toBe(200)
    expect(result.quests[0]?.ap).toBe(40)
  })
})

import { describe, it, expect } from 'vitest'
import { filterCandidateQuests } from './quest-selection'
import type { DropRate, Quest } from './types'

describe('filterCandidateQuests', () => {
  const makeQuest = (id: string, ap = 20): Quest => ({
    id,
    name: `Quest ${id}`,
    area: 'Area',
    section: 'Free',
    ap,
  })

  it('keeps top 5 quests per item and top 100 by relative score when over 100 quests exist', () => {
    // Create 110 quests
    const quests: Quest[] = Array.from({ length: 110 }, (_, i) => makeQuest(`q${i + 1}`, 20))
    
    // For item1, top 5 quests are q1..q5 (high drop rates), q6..q110 have decreasing drop rates
    const dropRates: DropRate[] = quests.map((q, idx) => ({
      quest_id: q.id,
      item_id: 'item1',
      drop_rate: (110 - idx) / 100, // q1 has 1.10, q2 has 1.09, ..., q100 has 0.11, q101..q110 have 0.10..0.01
    }))

    const result = filterCandidateQuests(quests, dropRates)

    expect(result.quests).toHaveLength(100)
    const resultIds = result.quests.map(q => q.id)
    expect(resultIds).not.toContain('q101')
    expect(resultIds).not.toContain('q110')
    expect(resultIds.slice(0, 5)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5'])
  })

  it('includes multi-drop quests through Relative Efficiency Score', () => {
    const quests: Quest[] = [
      makeQuest('q1', 20), // best for item1
      makeQuest('q2', 20), // best for item2
      makeQuest('q3', 20), // multi-drop: 90% of best for item1 and 90% of best for item2 => relative score = 1.8
      makeQuest('q4', 20), // low drop
    ]

    const dropRates: DropRate[] = [
      { quest_id: 'q1', item_id: 'item1', drop_rate: 1.0 },
      { quest_id: 'q2', item_id: 'item2', drop_rate: 1.0 },
      { quest_id: 'q3', item_id: 'item1', drop_rate: 0.9 },
      { quest_id: 'q3', item_id: 'item2', drop_rate: 0.9 },
      { quest_id: 'q4', item_id: 'item1', drop_rate: 0.01 },
    ]

    const result = filterCandidateQuests(quests, dropRates)

    const selectedIds = result.quests.map(q => q.id)
    expect(selectedIds).toContain('q1')
    expect(selectedIds).toContain('q2')
    expect(selectedIds).toContain('q3')
  })
})

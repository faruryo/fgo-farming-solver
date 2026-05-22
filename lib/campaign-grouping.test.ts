import { describe, it, expect } from 'vitest'
import { groupCampaignsByName } from './campaign-grouping'
import type { DashboardEvent } from './master-data/types'

const mkEvent = (overrides: Partial<DashboardEvent> & { id: number; name: string }): DashboardEvent => ({
  banner: null,
  startedAt: 0,
  endedAt: 0,
  shopFinishedAt: 0,
  type: 'questCampaign',
  drops: [],
  ...overrides,
})

describe('groupCampaignsByName', () => {
  it('groups events sharing the same name into one group', () => {
    const input = [
      { event: mkEvent({ id: 1, name: '消費AP 50%DOWN', endedAt: 100, campaignQuestsCount: 650 }), category: 'farming' as const },
      { event: mkEvent({ id: 2, name: '消費AP 50%DOWN', endedAt: 200, campaignQuestsCount: 416 }), category: 'farming' as const },
      { event: mkEvent({ id: 3, name: '消費AP 50%DOWN', endedAt: 150, campaignQuestsCount: 286 }), category: 'farming' as const },
    ]
    const groups = groupCampaignsByName(input)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('消費AP 50%DOWN')
    expect(groups[0].events.map(e => e.id)).toEqual([1, 3, 2]) // sorted by endedAt asc
    expect(groups[0].totalQuests).toBe(650 + 416 + 286)
    expect(groups[0].earliestEndedAt).toBe(100)
    expect(groups[0].latestEndedAt).toBe(200)
  })

  it('keeps differently-named events separate', () => {
    const input = [
      { event: mkEvent({ id: 1, name: '消費AP 50%DOWN', endedAt: 100, campaignQuestsCount: 10 }), category: 'farming' as const },
      { event: mkEvent({ id: 2, name: '消費AP 75%DOWN', endedAt: 100, campaignQuestsCount: 20 }), category: 'farming' as const },
    ]
    const groups = groupCampaignsByName(input)
    expect(groups).toHaveLength(2)
    expect(groups.map(g => g.name).sort()).toEqual(['消費AP 50%DOWN', '消費AP 75%DOWN'])
  })

  it('handles single-event groups identically to multi', () => {
    const input = [
      { event: mkEvent({ id: 1, name: '絆獲得量アップ', endedAt: 500, campaignQuestsCount: 0 }), category: 'other' as const },
    ]
    const groups = groupCampaignsByName(input)
    expect(groups).toHaveLength(1)
    expect(groups[0].events).toHaveLength(1)
    expect(groups[0].totalQuests).toBe(0)
    expect(groups[0].earliestEndedAt).toBe(500)
    expect(groups[0].latestEndedAt).toBe(500)
  })

  it('inherits category from the first occurrence', () => {
    const input = [
      { event: mkEvent({ id: 1, name: 'X', endedAt: 100 }), category: 'farming' as const },
      { event: mkEvent({ id: 2, name: 'X', endedAt: 200 }), category: 'other' as const },
    ]
    const groups = groupCampaignsByName(input)
    expect(groups[0].category).toBe('farming')
  })
})

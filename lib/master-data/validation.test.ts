import { describe, expect, it } from 'vitest'
import type { DashboardMeta, MasterData } from './types'
import { validateDashboardMeta, validateMasterData } from './validation'

const sampleDrops: MasterData = {
  items: [{ id: '00', name: 'A', category: 'material' }],
  quests: [
    { id: '100', name: 'Q1', area: 'X', ap: 20, section: 'Free' },
    { id: '000', name: 'D1', area: '修練場（月）', ap: 40, section: 'Daily' },
  ],
  drop_rates: [{ quest_id: '100', item_id: '00', drop_rate: 0.5 }],
  campaigns: [],
}

const sampleDashboard: DashboardMeta = {
  events: [
    { id: 1, name: 'E', banner: 'b', startedAt: 0, endedAt: 0, shopFinishedAt: 0, type: 'eventQuest', drops: [] },
  ],
  gachas: [
    { id: 1, name: 'G', banner: 'b', openedAt: 0, closedAt: 0, pickupServants: [] },
  ],
  recentServants: [
    { id: 1, name: 'S', rarity: 5, face: 'f', releasedAt: 0, collectionNo: 1 },
  ],
  updatedAt: 0,
}

describe('validateMasterData', () => {
  it('accepts a fully populated payload', () => {
    expect(validateMasterData(sampleDrops).ok).toBe(true)
  })

  it('rejects when items is empty', () => {
    const r = validateMasterData({ ...sampleDrops, items: [] })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/items/)
  })

  it('rejects when quests is empty', () => {
    const r = validateMasterData({ ...sampleDrops, quests: [] })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/quests/)
  })

  it('rejects when drop_rates is empty', () => {
    const r = validateMasterData({ ...sampleDrops, drop_rates: [] })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/drop_rates/)
  })

  it('rejects duplicate quest ids', () => {
    const r = validateMasterData({
      ...sampleDrops,
      quests: [
        { id: '100', name: 'Q1', area: 'X', ap: 20, section: 'Free' },
        { id: '100', name: 'Q2', area: 'X', ap: 20, section: 'Free' },
      ],
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/duplicate quest id/)
  })

  it('rejects quest ids that do not match the short-id pattern', () => {
    const r = validateMasterData({
      ...sampleDrops,
      quests: [{ id: 'X1', name: 'Q1', area: 'X', ap: 20, section: 'Free' }],
      drop_rates: [{ quest_id: 'X1', item_id: '00', drop_rate: 0.5 }],
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/does not match/)
  })

  it("rejects a Daily quest whose id does not start with '0'", () => {
    const r = validateMasterData({
      ...sampleDrops,
      quests: [{ id: '100', name: 'D1', area: '修練場（月）', ap: 40, section: 'Daily' }],
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/prefix conflicts with section/)
  })

  it("rejects a Free quest whose id starts with '0'", () => {
    const r = validateMasterData({
      ...sampleDrops,
      quests: [{ id: '010', name: 'Q1', area: 'X', ap: 20, section: 'Free' }],
      drop_rates: [{ quest_id: '010', item_id: '00', drop_rate: 0.5 }],
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/prefix conflicts with section/)
  })

  it('rejects duplicate item ids', () => {
    const r = validateMasterData({
      ...sampleDrops,
      items: [
        { id: '00', name: 'A', category: 'material' },
        { id: '00', name: 'B', category: 'material' },
      ],
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/duplicate item id/)
  })

  it('rejects drop_rates referencing a quest id that is not in quests', () => {
    const r = validateMasterData({
      ...sampleDrops,
      drop_rates: [{ quest_id: '1zz', item_id: '00', drop_rate: 0.5 }],
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/unknown quest id/)
  })
})

describe('validateDashboardMeta', () => {
  it('accepts a fully populated payload', () => {
    expect(validateDashboardMeta(sampleDashboard).ok).toBe(true)
  })

  it('accepts when only gachas is empty (no pickup period)', () => {
    expect(validateDashboardMeta({ ...sampleDashboard, gachas: [] }).ok).toBe(true)
  })

  it('accepts when only events is empty (between events)', () => {
    expect(validateDashboardMeta({ ...sampleDashboard, events: [] }).ok).toBe(true)
  })

  it('rejects when both events and gachas are empty', () => {
    const r = validateDashboardMeta({ ...sampleDashboard, events: [], gachas: [] })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/both empty/)
  })
})

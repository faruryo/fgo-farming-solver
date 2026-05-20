import { describe, expect, it } from 'vitest'
import type { DashboardMeta, MasterData } from './types'
import { validateDashboardMeta, validateMasterData } from './validation'

const sampleDrops: MasterData = {
  items: [{ id: 'a', name: 'A', category: 'material' }],
  quests: [{ id: 'q1', name: 'Q1', area: 'X', ap: 20, section: 'Free' }],
  drop_rates: [{ quest_id: 'q1', item_id: 'a', drop_rate: 0.5 }],
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

import { describe, it, expect } from 'vitest'
import { categorizeCampaignEvent, isPodFreeCampaignEvent, isNoiseQuestAp } from './campaign-category'
import type { DashboardEvent } from './master-data/types'

const mkEvent = (overrides: Partial<DashboardEvent>): DashboardEvent => ({
  id: 1,
  name: 'X',
  banner: null,
  startedAt: 0,
  endedAt: 0,
  shopFinishedAt: 0,
  type: 'questCampaign',
  drops: [],
  ...overrides,
})

describe('isNoiseQuestAp', () => {
  it('flags questAp × multiplication × 1000 as noise', () => {
    expect(isNoiseQuestAp({ target: 'questAp', calcType: 'multiplication', value: 1000 })).toBe(true)
  })
  it('does not flag a true 50% discount', () => {
    expect(isNoiseQuestAp({ target: 'questAp', calcType: 'multiplication', value: 500 })).toBe(false)
  })
  it('does not flag non-questAp targets', () => {
    expect(isNoiseQuestAp({ target: 'questFp', calcType: 'multiplication', value: 1000 })).toBe(false)
  })
})

describe('categorizeCampaignEvent', () => {
  it('classifies real AP discount as farming', () => {
    const ev = mkEvent({
      name: '消費AP 50%DOWN',
      campaigns: [{ target: 'questAp', calcType: 'multiplication', value: 500 }],
    })
    expect(categorizeCampaignEvent(ev)).toBe('farming')
  })

  it('does NOT classify a pure noise questAp (value=1000) as farming', () => {
    const ev = mkEvent({
      name: '謎キャンペーン',
      campaigns: [{ target: 'questAp', calcType: 'multiplication', value: 1000 }],
    })
    expect(categorizeCampaignEvent(ev)).toBe('other')
  })

  it('rescues ストーム・ポッド named events into farming even if only noise campaigns', () => {
    const ev = mkEvent({
      name: '期間限定 ストーム・ポッド消費なし！',
      campaigns: [{ target: 'questAp', calcType: 'multiplication', value: 1000 }],
    })
    expect(categorizeCampaignEvent(ev)).toBe('farming')
  })

  it('classifies questUseRewardAddItem with stormpod targetIds=49 as farming', () => {
    const ev = mkEvent({
      name: '星光の砂2倍',
      campaigns: [{ target: 'questUseRewardAddItem', calcType: 'multiplication', value: 200, targetIds: [49] }],
    })
    expect(categorizeCampaignEvent(ev)).toBe('farming')
  })

  it('classifies questUseRewardAddItem with non-49 targetIds as other', () => {
    const ev = mkEvent({
      name: '別アイテム報酬2倍',
      campaigns: [{ target: 'questUseRewardAddItem', calcType: 'multiplication', value: 200, targetIds: [100] }],
    })
    expect(categorizeCampaignEvent(ev)).toBe('other')
  })

  it('classifies skill enhancement campaigns as upgrade', () => {
    const ev = mkEvent({
      name: '大成功UP',
      campaigns: [{ target: 'largeSuccess', calcType: 'multiplication', value: 200 }],
    })
    expect(categorizeCampaignEvent(ev)).toBe('upgrade')
  })

  it('classifies bond/fp campaigns as other', () => {
    const ev = mkEvent({
      name: '絆ポイント2倍',
      campaigns: [{ target: 'questFriendship', calcType: 'multiplication', value: 200 }],
    })
    expect(categorizeCampaignEvent(ev)).toBe('other')
  })
})

describe('isPodFreeCampaignEvent', () => {
  it('matches 中黒 spelling', () => {
    expect(isPodFreeCampaignEvent(mkEvent({ name: '期間限定 ストーム・ポッド消費なし！' }))).toBe(true)
  })
  it('matches legacy spelling without 中黒', () => {
    expect(isPodFreeCampaignEvent(mkEvent({ name: 'ストームポッド消費なし' }))).toBe(true)
  })
  it('does not match unrelated events', () => {
    expect(isPodFreeCampaignEvent(mkEvent({ name: '消費AP 50%DOWN' }))).toBe(false)
  })
})

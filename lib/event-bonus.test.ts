import { describe, it, expect } from 'vitest'
import type { NiceExtraPassiveSkill } from '../interfaces/atlas-academy'
import { extractEventBonuses } from './event-bonus'

const NOW = 1_790_000_000
const skill = (
  conds: { eventId: number; startedAt?: number; endedAt: number }[],
  functions: NiceExtraPassiveSkill['functions']
): NiceExtraPassiveSkill => ({
  extraPassive: conds.map(c => ({ startedAt: NOW - 60, ...c })),
  functions,
})
const damage = (value: number) => ({ funcType: 'addStateShort', buffs: [{ type: 'upDamage' }], svals: [{ Rate: 1000, Value: value }] })
const bond = (rate: number) => ({ funcType: 'servantFriendshipUp', buffs: [], svals: [{ RateCount: rate }] })

describe('extractEventBonuses', () => {
  it('keeps limited-event damage and bond bonuses, merged per event by maximum', () => {
    expect(extractEventBonuses([
      skill([{ eventId: 80627, endedAt: NOW + 100 }], [damage(300), bond(200)]),
      skill([{ eventId: 80627, endedAt: NOW + 100 }], [damage(1000)]),
    ], NOW)).toEqual([{ eventId: 80627, startedAt: NOW - 60, endedAt: NOW + 100, damage: 100, bond: 20 }])
  })

  it('attaches the event name when known', () => {
    expect(extractEventBonuses(
      [skill([{ eventId: 80627, endedAt: NOW + 100 }], [bond(200)])],
      NOW,
      new Map([[80627, 'くたばれ！ パンプキンファーム・スローター']])
    )).toEqual([{ eventId: 80627, eventName: 'くたばれ！ パンプキンファーム・スローター', startedAt: NOW - 60, endedAt: NOW + 100, bond: 20 }])
  })

  it('unions the windows when one event has conditions with different periods', () => {
    expect(extractEventBonuses([
      skill([{ eventId: 80507, endedAt: NOW + 500 }, { eventId: 80507, endedAt: NOW + 100 }], [bond(200)]),
    ], NOW)).toEqual([{ eventId: 80507, startedAt: NOW - 60, endedAt: NOW + 500, bond: 20 }])
  })

  it('drops permanent (sentinel), ended, non-event and non-bonus passives', () => {
    expect(extractEventBonuses([
      skill([{ eventId: 80593, endedAt: 1893423600 }], [damage(300)]),
      skill([{ eventId: 80301, endedAt: NOW }], [bond(200)]),
      skill([{ eventId: 0, endedAt: NOW + 100 }], [bond(200)]),
      skill([{ eventId: 80627, endedAt: NOW + 100 }], [{ funcType: 'addStateShort', buffs: [{ type: 'upAtk' }], svals: [{ Value: 100 }] }]),
    ], NOW)).toEqual([])
  })
})

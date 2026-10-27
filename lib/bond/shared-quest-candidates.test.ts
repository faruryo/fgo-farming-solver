import { describe, expect, it } from 'vitest'
import type { Quest } from '../../interfaces/fgodrop'
import { bondQuestCandidates } from './quest-candidates'
import { defaultSharedBondQuestId, sharedBondQuestCandidates } from './shared-quest-candidates'

const quest = (id: string, area: string, name: string, bondPoints: number): Quest => ({
  id,
  section: 'Free',
  area,
  name,
  ap: 40,
  bondPoints,
})

const QUESTS = [
  quest('saber', '冠位研鑽戦', '〔セイバー〕 Ⅶ', 4748),
  quest('caster', '冠位研鑽戦', '〔キャスター〕 Ⅶ', 4748),
  quest('extra1', '冠位研鑽戦', '〔エクストラⅠ〕火 Ⅶ', 4748),
  quest('ordeal', 'オーディール・コール', '月光採掘場', 3797),
  quest('daily', '修練場（月）', '弓極級', 815),
]

const listsFor = (...classNames: string[]) => classNames.map(c => bondQuestCandidates(QUESTS, [], c))
const ids = (...classNames: string[]) => sharedBondQuestCandidates(listsFor(...classNames)).map(c => c.quest.id)

describe('sharedBondQuestCandidates', () => {
  it('returns no candidates when no servant is selected', () => {
    expect(sharedBondQuestCandidates([])).toEqual([])
  })

  it('returns no candidates when the servants share no quest', () => {
    expect(sharedBondQuestCandidates([[], []])).toEqual([])
    expect(sharedBondQuestCandidates([[], bondQuestCandidates(QUESTS, [], 'caster')])).toEqual([])
  })

  it('drops grand training quests for servants of different classes', () => {
    expect(ids('caster', 'saber')).toEqual(['ordeal', 'daily'])
  })

  it('keeps the order of the first servant', () => {
    expect(ids('caster', 'caster')).toEqual(['caster', 'ordeal', 'daily'])
  })

  it('keeps unconfirmed-class quests marked as unconfirmed', () => {
    const shared = sharedBondQuestCandidates(listsFor('pretender', 'shielder'))
    expect(shared.filter(c => c.unconfirmedClass).map(c => c.quest.id)).toEqual(['extra1'])
  })
})

describe('defaultSharedBondQuestId', () => {
  const shared = sharedBondQuestCandidates(listsFor('caster', 'saber'))

  it('uses the first servant quest when it is shared', () => {
    expect(defaultSharedBondQuestId(shared, 'daily')).toBe('daily')
  })

  it('falls back to the first confirmed candidate when the first servant quest is not shared', () => {
    expect(defaultSharedBondQuestId(shared, 'caster')).toBe('ordeal')
    expect(defaultSharedBondQuestId(shared, undefined)).toBe('ordeal')
    const unconfirmedFirst = sharedBondQuestCandidates(listsFor('pretender'))
    expect(defaultSharedBondQuestId(unconfirmedFirst, 'gone')).toBe('ordeal')
  })

  it('returns undefined when nothing is shared', () => {
    expect(defaultSharedBondQuestId([], 'daily')).toBeUndefined()
  })
})

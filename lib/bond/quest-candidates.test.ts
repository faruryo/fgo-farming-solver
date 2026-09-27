import { describe, expect, it } from 'vitest'
import type { Campaign, Quest } from '../../interfaces/fgodrop'
import { bondQuestCandidates } from './quest-candidates'

const quest = (id: string, area: string, name: string, bondPoints: number | undefined, ap = 40): Quest => ({
  id,
  section: 'Free',
  area,
  name,
  ap,
  bondPoints,
})

const QUESTS = [
  quest('saber', '冠位研鑽戦', '〔セイバー〕 Ⅶ', 4748),
  quest('caster', '冠位研鑽戦', '〔キャスター〕 Ⅶ', 4748),
  quest('caster-low', '冠位研鑽戦', '〔キャスター〕 Ⅲ', 3622),
  quest('extra1', '冠位研鑽戦', '〔エクストラⅠ〕火 Ⅶ', 4748),
  quest('extra2', '冠位研鑽戦', '〔エクストラⅡ〕風 Ⅶ', 4748),
  quest('unknown', '冠位研鑽戦', '〔ビースト〕 Ⅶ', 9999),
  quest('no-label', '冠位研鑽戦', '名前なし', 9999),
  quest('ordeal', 'オーディール・コール', '月光採掘場', 3797),
  quest('daily', '修練場（月）', '弓極級', 815),
  quest('no-bond', '修練場（月）', '剣極級', undefined),
]

const ids = (className: string, campaigns: Campaign[] = []) =>
  bondQuestCandidates(QUESTS, campaigns, className).map(c => c.quest.id)

describe('bondQuestCandidates', () => {
  it.each([
    ['caster sees only the caster grand training', 'caster', ['caster', 'ordeal', 'caster-low', 'daily']],
    ['saber sees only the saber grand training', 'saber', ['saber', 'ordeal', 'daily']],
    ['extra class sees Extra I/II but no base-class grand training', 'pretender', ['extra1', 'extra2', 'ordeal', 'daily']],
    ['shielder counts as an extra class', 'shielder', ['extra1', 'extra2', 'ordeal', 'daily']],
  ])('%s', (_label, className, expected) => {
    expect(ids(className)).toEqual(expected)
  })

  it('marks Extra I/II as unconfirmed and nothing else', () => {
    const marked = bondQuestCandidates(QUESTS, [], 'pretender')
      .filter(c => c.unconfirmedClass)
      .map(c => c.quest.id)
    expect(marked).toEqual(['extra1', 'extra2'])
  })

  it('ranks by bond points per effective AP using active AP campaigns', () => {
    const halfAp: Campaign = {
      id: 1,
      calcType: 'multiplication',
      value: 500,
      validFrom: 0,
      validTo: 1,
      questIds: ['daily'],
    }
    const candidates = bondQuestCandidates(QUESTS, [halfAp], 'caster')
    expect(candidates.find(c => c.quest.id === 'daily')?.effectiveAp).toBe(20)
    // 815/20 = 40.75 は 3622/40 = 90.55 より低いまま、順位は bondPoints/AP で決まる
    expect(candidates.map(c => c.quest.id)).toEqual(['caster', 'ordeal', 'caster-low', 'daily'])
    const deepCut: Campaign = { ...halfAp, calcType: 'fixedValue', value: 5 }
    expect(bondQuestCandidates(QUESTS, [deepCut], 'caster')[0].quest.id).toBe('daily')
  })
})

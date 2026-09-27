import type { ClassName } from '../../interfaces/atlas-academy'
import type { Campaign, Quest } from '../../interfaces/fgodrop'
import { computeEffectiveAp } from '../solver'

const GRAND_TRAINING_AREA = '冠位研鑽戦'

const BASE_CLASS_BY_LABEL = new Map<string, ClassName>([
  ['セイバー', 'saber'],
  ['アーチャー', 'archer'],
  ['ランサー', 'lancer'],
  ['ライダー', 'rider'],
  ['キャスター', 'caster'],
  ['アサシン', 'assassin'],
  ['バーサーカー', 'berserker'],
])
const BASE_CLASSES = new Set<string>(BASE_CLASS_BY_LABEL.values())

export type BondQuestCandidate = {
  quest: Quest
  effectiveAp: number
  /** 〔エクストラⅠ/Ⅱ〕のように対象クラスをデータから確定できない候補。 */
  unconfirmedClass: boolean
}

// 冠位研鑽戦はクエスト名の〔クラス〕で編成縛りを判定する。判定できないものは勧めない。
const classRestriction = (
  quest: Quest,
  className: string,
): { allowed: boolean; unconfirmedClass: boolean } => {
  if (!quest.area.includes(GRAND_TRAINING_AREA)) return { allowed: true, unconfirmedClass: false }
  const open = quest.name.indexOf('〔')
  const close = quest.name.indexOf('〕', open)
  const label = open >= 0 && close > open ? quest.name.slice(open + 1, close) : undefined
  if (label?.startsWith('エクストラ'))
    return { allowed: !BASE_CLASSES.has(className), unconfirmedClass: true }
  const target = label ? BASE_CLASS_BY_LABEL.get(label) : undefined
  return { allowed: !!target && target === className, unconfirmedClass: false }
}

export const bondQuestCandidates = (
  quests: readonly Quest[],
  activeCampaigns: Campaign[],
  className: string,
): BondQuestCandidate[] =>
  quests
    .flatMap(quest => {
      if (!quest.bondPoints) return []
      const { allowed, unconfirmedClass } = classRestriction(quest, className)
      if (!allowed) return []
      return [{ quest, effectiveAp: computeEffectiveAp(quest.ap, quest.id, activeCampaigns), unconfirmedClass }]
    })
    .sort(
      (a, b) =>
        (b.quest.bondPoints as number) / b.effectiveAp - (a.quest.bondPoints as number) / a.effectiveAp,
    )

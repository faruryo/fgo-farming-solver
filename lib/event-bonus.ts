import type { NiceExtraPassiveSkill } from '../interfaces/atlas-academy'

/** damage は特攻の与ダメージ増加%、bond は絆獲得量の増加%。該当しない種類は持たない。 */
export type ServantEventBonus = {
  eventId: number
  startedAt: number
  endedAt: number
  damage?: number
  bond?: number
}

// 恒常イベント由来のボーナスは終了日がこの番兵値になり、期間で絞れない。
const PERMANENT_SENTINEL = 1893423600

const maxOf = (a: number | undefined, b: number | undefined): number | undefined =>
  a === undefined || b === undefined ? (a ?? b) : Math.max(a, b)

const bonusOf = (skill: NiceExtraPassiveSkill): Pick<ServantEventBonus, 'damage' | 'bond'> => {
  let damage: number | undefined
  let bond: number | undefined
  for (const fn of skill.functions) {
    if (fn.buffs[0]?.type === 'upDamage') damage = maxOf(damage, fn.svals.at(-1)?.Value)
    if (fn.funcType === 'servantFriendshipUp') bond = maxOf(bond, fn.svals.at(-1)?.RateCount)
  }
  return {
    ...(damage ? { damage: damage / 10 } : {}),
    ...(bond ? { bond: bond / 10 } : {}),
  }
}

/** 期間限定イベントの特攻・絆ボーナスを、イベントごとに最大値でまとめる。終了済み・恒常のものは捨てる。 */
export const extractEventBonuses = (skills: NiceExtraPassiveSkill[] = [], nowSec: number): ServantEventBonus[] => {
  const byEvent = new Map<number, ServantEventBonus>()
  for (const skill of skills) {
    const bonus = bonusOf(skill)
    if (!bonus.damage && !bonus.bond) continue
    for (const { eventId, startedAt, endedAt } of skill.extraPassive) {
      if (!eventId || endedAt >= PERMANENT_SENTINEL || endedAt <= nowSec) continue
      const prev = byEvent.get(eventId)
      const damage = maxOf(prev?.damage, bonus.damage)
      const bond = maxOf(prev?.bond, bonus.bond)
      byEvent.set(eventId, {
        eventId,
        startedAt,
        endedAt,
        ...(damage ? { damage } : {}),
        ...(bond ? { bond } : {}),
      })
    }
  }
  return [...byEvent.values()]
}

export type EventBonusGroup = { key: string; damage: number; bond: number; servantIds: Set<number> }

/** 開催中のボーナスを (特攻%, 絆%) の組で束ねる。強い順。 */
// ponytail: 同時開催のイベントは区別せず同じ組に混ぜる。イベント別に分けたくなったら key に eventId を足す。
export const groupActiveEventBonuses = (
  servants: { id: number; eventBonuses?: ServantEventBonus[] }[],
  nowSec = Math.floor(Date.now() / 1000)
): EventBonusGroup[] => {
  const groups = new Map<string, EventBonusGroup>()
  for (const servant of servants) {
    for (const b of servant.eventBonuses ?? []) {
      if (b.startedAt > nowSec || b.endedAt <= nowSec) continue
      const damage = b.damage ?? 0
      const bond = b.bond ?? 0
      const key = `${damage}:${bond}`
      const group = groups.get(key) ?? { key, damage, bond, servantIds: new Set<number>() }
      group.servantIds.add(servant.id)
      groups.set(key, group)
    }
  }
  return [...groups.values()].sort((a, b) => b.damage - a.damage || b.bond - a.bond)
}

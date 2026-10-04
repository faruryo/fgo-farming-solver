import type { NiceExtraPassiveSkill } from '../interfaces/atlas-academy'

/** damage は特攻の与ダメージ増加%、bond は絆獲得量の増加%。該当しない種類は持たない。 */
export type ServantEventBonus = {
  eventId: number
  /** 取れなかったときは無い（画面側でイベント ID を出す）。 */
  eventName?: string
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

const mergeBonus = (
  prev: ServantEventBonus | undefined,
  bonus: Pick<ServantEventBonus, 'damage' | 'bond'>,
  { eventId, startedAt, endedAt }: Pick<ServantEventBonus, 'eventId' | 'startedAt' | 'endedAt'>,
  eventName: string | undefined
): ServantEventBonus => {
  const damage = maxOf(prev?.damage, bonus.damage)
  const bond = maxOf(prev?.bond, bonus.bond)
  return {
    eventId,
    ...(eventName ? { eventName } : {}),
    // 同じイベントでも条件ごとに期間が違うことがある（80507 など）。和の期間にする。
    startedAt: Math.min(prev?.startedAt ?? startedAt, startedAt),
    endedAt: Math.max(prev?.endedAt ?? endedAt, endedAt),
    ...(damage ? { damage } : {}),
    ...(bond ? { bond } : {}),
  }
}

/**
 * 期間限定イベントの特攻・絆ボーナスを、イベントごとに最大値でまとめる。終了済み・恒常のものは捨てる。
 * 開始前のものも捨てる。Atlas には告知前のイベントが先に入ることがあり、公開カタログへ出すと未公開情報になる。
 */
export const extractEventBonuses = (
  skills: NiceExtraPassiveSkill[] = [],
  nowSec: number,
  eventNames: ReadonlyMap<number, string> = new Map()
): ServantEventBonus[] => {
  const byEvent = new Map<number, ServantEventBonus>()
  for (const skill of skills) {
    const bonus = bonusOf(skill)
    if (!bonus.damage && !bonus.bond) continue
    for (const { eventId, startedAt, endedAt } of skill.extraPassive) {
      if (!eventId || endedAt >= PERMANENT_SENTINEL || endedAt <= nowSec || startedAt > nowSec) continue
      byEvent.set(eventId, mergeBonus(byEvent.get(eventId), bonus, { eventId, startedAt, endedAt }, eventNames.get(eventId)))
    }
  }
  return [...byEvent.values()]
}

export type EventBonusGroup = { key: string; damage: number; bond: number; servantIds: Set<number> }
export type ActiveEventBonuses = {
  eventId: number
  eventName?: string
  servantIds: Set<number>
  /** (特攻%, 絆%) の組。強い順。 */
  groups: EventBonusGroup[]
}

const isBonus = (b: unknown): b is ServantEventBonus =>
  !!b && typeof b === 'object' && typeof (b as ServantEventBonus).eventId === 'number'

const bonusesOf = (servant: { eventBonuses?: unknown }): ServantEventBonus[] =>
  Array.isArray(servant.eventBonuses) ? servant.eventBonuses.filter(isBonus) : []

type EventAccumulator = ActiveEventBonuses & { startedAt: number; byKey: Map<string, EventBonusGroup> }

const addBonus = (events: Map<number, EventAccumulator>, servantId: number, b: ServantEventBonus) => {
  const event = events.get(b.eventId) ?? {
    eventId: b.eventId,
    ...(b.eventName ? { eventName: b.eventName } : {}),
    startedAt: b.startedAt,
    servantIds: new Set<number>(),
    groups: [],
    byKey: new Map<string, EventBonusGroup>(),
  }
  const damage = b.damage ?? 0
  const bond = b.bond ?? 0
  const key = `${b.eventId}:${damage}:${bond}`
  const group = event.byKey.get(key) ?? { key, damage, bond, servantIds: new Set<number>() }
  group.servantIds.add(servantId)
  event.byKey.set(key, group)
  event.servantIds.add(servantId)
  events.set(b.eventId, event)
}

/** 開催中のボーナスをイベントごとに分け、その中を (特攻%, 絆%) の組で束ねる。イベントは開始の早い順。 */
export const groupActiveEventBonuses = (
  servants: { id: number; eventBonuses?: ServantEventBonus[] }[],
  nowSec: number
): ActiveEventBonuses[] => {
  const events = new Map<number, EventAccumulator>()
  for (const servant of servants) {
    for (const b of bonusesOf(servant)) {
      if (b.startedAt <= nowSec && b.endedAt > nowSec) addBonus(events, servant.id, b)
    }
  }
  return [...events.values()]
    .sort((a, b) => a.startedAt - b.startedAt || a.eventId - b.eventId)
    .map(({ eventId, eventName, servantIds, byKey }) => ({
      eventId,
      ...(eventName ? { eventName } : {}),
      servantIds,
      groups: [...byKey.values()].sort((a, b) => b.damage - a.damage || b.bond - a.bond),
    }))
}

/** 次にボーナスが始まる・終わる時刻。無ければ undefined。開いたままの画面で選択肢を作り直すのに使う。 */
export const nextEventBonusBoundary = (
  servants: { eventBonuses?: ServantEventBonus[] }[],
  nowSec: number
): number | undefined => {
  const upcoming = servants
    .flatMap(s => bonusesOf(s).flatMap(b => [b.startedAt, b.endedAt]))
    .filter(t => t > nowSec)
  return upcoming.length > 0 ? Math.min(...upcoming) : undefined
}

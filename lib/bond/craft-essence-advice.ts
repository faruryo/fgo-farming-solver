import type { MaterialCatalogBondUpCraftEssence } from '../material-catalog'

type Essence = MaterialCatalogBondUpCraftEssence

/** 霊基再臨の段階(第1再臨・第2再臨・第3再臨・最終再臨)の数。 */
const ASCENSION_STAGE_COUNT = 4

export type CraftEssenceAdviceServant = {
  id: number
  cost?: number
  /** 基本の特性 ID。ないサーヴァントは全員に効く礼装だけを受ける。 */
  traits?: readonly number[]
  /** 段階ごとの特性 ID。ないサーヴァントはどの段階も traits を持つ。 */
  ascensionTraits?: readonly (readonly number[])[]
}

/** 礼装を数えたサーヴァントのうち、段階で効くかが変わるサーヴァントと、その礼装が効く段階(0 始まり)。 */
type CraftEssenceStageNote = { servantId: number; stages: number[] }

export type CraftEssenceAssignment = {
  servantId: number
  essence: Essence | null
  /** 同じ対象・増加率・固定・コストで、選んだサーヴァントのどの段階に効くかも同じで、組み合わせに入っていない礼装。 */
  alternatives: Essence[]
  points: number
  /** 段階で効くかが変わる礼装を数えたときの、獲得絆を数えた段階(0 始まり)。それ以外は null。 */
  countedStage: number | null
  /** essence を数えたサーヴァントのうち、段階で効くかが変わるサーヴァントごとの効く段階。 */
  stageNotes: CraftEssenceStageNote[]
}

export type CraftEssenceAdvice =
  | { kind: 'unknownCost'; servantIds: number[] }
  | { kind: 'overCost'; servantCost: number; maxCost: number }
  | {
      kind: 'ok'
      assignments: CraftEssenceAssignment[]
      total: number
      baseTotal: number
      usedCost: number
      maxCost: number
    }

type EffectType = {
  target: Essence['target']
  rate: number
  add: number
  cost: number
  /** [選んだサーヴァント][段階] で条件に合うか。 */
  applies: boolean[][]
  essences: Essence[]
}

const stageTraitsOf = (servant: CraftEssenceAdviceServant): ReadonlySet<number>[] => {
  const stages =
    servant.ascensionTraits?.length === ASCENSION_STAGE_COUNT
      ? servant.ascensionTraits
      : Array.from({ length: ASCENSION_STAGE_COUNT }, () => servant.traits ?? [])
  return stages.map(stage => new Set(stage))
}

const matches = (appliesTo: readonly (readonly number[])[], traits: ReadonlySet<number>): boolean =>
  appliesTo.length === 0 || appliesTo.some(group => group.every(trait => traits.has(trait)))

const appliesKey = (applies: readonly (readonly boolean[])[]): string =>
  applies.map(row => row.map(Number).join('')).join(',')

// 同じ効果とコストで、選んだサーヴァントのどの段階に効くかも同じ礼装は入れ替えても結果が同じなので、種類ごとの枚数だけを探索する。
const effectTypes = (essences: readonly Essence[], servantStages: readonly ReadonlySet<number>[][]): EffectType[] => {
  const byKey = new Map<string, EffectType>()
  const sorted = [...essences].sort((a, b) => a.collectionNo - b.collectionNo || a.id - b.id)
  for (const essence of sorted) {
    const { appliesTo } = essence
    // 効く相手の条件を持たない礼装(条件を足す前のカタログ)は誰に効くか分からないので使わない。
    if (!appliesTo) continue
    const applies = servantStages.map(stages => stages.map(traits => matches(appliesTo, traits)))
    if (!applies.some(row => row.includes(true))) continue
    const key = `${essence.target}|${essence.rate}|${essence.add}|${essence.cost}|${appliesKey(applies)}`
    const type = byKey.get(key)
    if (type) type.essences.push(essence)
    else byKey.set(key, { target: essence.target, rate: essence.rate, add: essence.add, cost: essence.cost, applies, essences: [essence] })
  }
  return [...byKey.values()]
}

/** パーティ全体の増加率は合計してから掛けて切り捨てる。 */
const boostedPoints = (basePoints: number, partyRate: number): number =>
  Math.floor((basePoints * (1000 + partyRate)) / 1000)

const isStageDependent = (row: readonly boolean[] | undefined): boolean => !!row && row.includes(false)

// shortcut: 自身に効く礼装は条件なしの1件だけなので、複数の自身に効く種類が同じ相手を取り合う場合の割り当ての判定はせず、
// 効く相手の先頭から付ける。条件付きの自身に効く礼装が増えたら割り当ての判定を足す。
const assignSelf = (types: readonly EffectType[], counts: readonly number[]): number[][] | null => {
  const holding = new Set<number>()
  let assignable = true
  const holders = types.map((type, t) => {
    const count = type.target === 'self' ? counts.at(t) ?? 0 : 0
    return Array.from({ length: count }, () => {
      const holder = type.applies.findIndex((row, i) => !holding.has(i) && row.includes(true))
      if (holder < 0) assignable = false
      holding.add(holder)
      return holder
    })
  })
  return assignable ? holders : null
}

type Active = { type: EffectType; count: number; holders: readonly number[] }

/** 1体のサーヴァントは1つの段階でしか編成できないので、段階ごとの値の最大を数える。数えた段階は最大になる最も早い段階。 */
const servantPoints = (active: readonly Active[], basePoints: number, servant: number): { points: number; stage: number } => {
  const values = Array.from({ length: ASCENSION_STAGE_COUNT }, (_, stage) => {
    let rate = 0
    let add = 0
    for (const { type, count, holders } of active) {
      if (!type.applies.at(servant)?.at(stage)) continue
      if (type.target === 'party') {
        rate += type.rate * count
        add += type.add * count
      } else if (holders.includes(servant)) {
        // shortcut: 自身に効く増加率はイベント限定を除くと存在しないため数えない。
        add += type.add
      }
    }
    return boostedPoints(basePoints, rate) + add
  })
  const points = Math.max(...values)
  return { points, stage: values.indexOf(points) }
}

type Combo = {
  counts: number[]
  holders: number[][]
  points: number[]
  stages: number[]
  total: number
  cost: number
  cards: number
  /** 組み合わせの礼装の図鑑番号(小さい順)。 */
  collectionNos: number[]
}

const evaluate = (types: readonly EffectType[], counts: readonly number[], basePoints: number, servantCount: number): Combo | null => {
  const holders = assignSelf(types, counts)
  if (!holders) return null
  const active = types.flatMap((type, t) => {
    const count = counts.at(t) ?? 0
    return count ? [{ type, count, holders: holders.at(t) ?? [] }] : []
  })
  const servants = Array.from({ length: servantCount }, (_, i) => servantPoints(active, basePoints, i))
  return {
    counts: [...counts],
    holders,
    points: servants.map(s => s.points),
    stages: servants.map(s => s.stage),
    total: servants.reduce((sum, s) => sum + s.points, 0),
    cost: active.reduce((sum, { type, count }) => sum + type.cost * count, 0),
    cards: active.reduce((sum, { count }) => sum + count, 0),
    collectionNos: active
      .flatMap(({ type, count }) => type.essences.slice(0, count).map(e => e.collectionNo))
      .sort((a, b) => a - b),
  }
}

const compareCollectionNos = (a: readonly number[], b: readonly number[]): number => {
  for (const [i, no] of a.entries()) {
    const other = b.at(i)
    if (other === undefined) return 1
    if (no !== other) return no - other
  }
  return a.length - b.length
}

/** 合計が大きい → 使うコストが小さい → 枚数が少ない → 図鑑番号の列が小さい の順。 */
const isBetter = (a: Combo, b: Combo): boolean => {
  if (a.total !== b.total) return a.total > b.total
  if (a.cost !== b.cost) return a.cost < b.cost
  if (a.cards !== b.cards) return a.cards < b.cards
  return compareCollectionNos(a.collectionNos, b.collectionNos) < 0
}

const typeLimit = (type: EffectType, slots: number, remaining: number): number => {
  const limit = Math.min(type.essences.length, slots, Math.floor(remaining / type.cost))
  // 自身に効く礼装は、どれかの段階で効くサーヴァントの人数を超えて付けない。
  return type.target === 'self' ? Math.min(limit, type.applies.filter(row => row.includes(true)).length) : limit
}

const bestCombo = (types: readonly EffectType[], basePoints: number, servantCount: number, budget: number): Combo => {
  const counts = types.map(() => 0)
  let best = evaluate(types, counts, basePoints, servantCount) as Combo
  const visit = (index: number, slots: number, remaining: number) => {
    const type = types.at(index)
    if (!type) {
      const combo = evaluate(types, counts, basePoints, servantCount)
      if (combo && isBetter(combo, best)) best = combo
      return
    }
    const limit = typeLimit(type, slots, remaining)
    for (let count = 0; count <= limit; count++) {
      counts.splice(index, 1, count)
      visit(index + 1, slots - count, remaining - count * type.cost)
    }
    counts.splice(index, 1, 0)
  }
  visit(0, servantCount, budget)
  return best
}

type Pick = { essence: Essence; alternatives: Essence[]; type: EffectType }

/** 自身に効く礼装は探索で決めた相手へ、パーティ全体に効く礼装は合計に影響しないので表示を安定させる順で残りへ付ける。 */
const picksByServant = (types: readonly EffectType[], best: Combo, servantCount: number): (Pick | undefined)[] => {
  const picks = types.map((type, t) => {
    const count = best.counts.at(t) ?? 0
    return type.essences.slice(0, count).map(essence => ({ essence, alternatives: type.essences.slice(count), type }))
  })
  const self = new Map(
    picks.flatMap((typePicks, t) => typePicks.flatMap((pick, n) => {
      const holder = best.holders.at(t)?.at(n)
      return holder === undefined ? [] : [[holder, pick] as const]
    })),
  )
  const party = picks
    .flat()
    .filter(pick => pick.type.target === 'party')
    .sort((a, b) => b.essence.cost - a.essence.cost || a.essence.collectionNo - b.essence.collectionNo)
  return Array.from({ length: servantCount }, (_, i) => self.get(i) ?? party.shift())
}

const stageNotesFor = (
  pick: Pick | undefined,
  holder: number,
  servants: readonly CraftEssenceAdviceServant[],
  best: Combo,
): CraftEssenceStageNote[] => {
  if (!pick) return []
  const counted = pick.type.target === 'party' ? servants.map((_, i) => i) : [holder]
  return counted.flatMap(i => {
    const row = pick.type.applies.at(i)
    const stage = best.stages.at(i) ?? 0
    if (!row?.at(stage) || !isStageDependent(row)) return []
    return [{ servantId: servants.at(i)?.id ?? 0, stages: row.flatMap((ok, s) => (ok ? [s] : [])) }]
  })
}

/** 段階で効くかが変わる礼装をそのサーヴァントに数えたときだけ、数えた段階を返す。 */
const countedStageFor = (picks: readonly (Pick | undefined)[], servant: number, best: Combo): number | null => {
  const stage = best.stages.at(servant) ?? 0
  const counted = picks.some((pick, holder) => {
    if (!pick || (pick.type.target === 'self' && holder !== servant)) return false
    const row = pick.type.applies.at(servant)
    return !!row?.at(stage) && isStageDependent(row)
  })
  return counted ? stage : null
}

/**
 * 選んだサーヴァント全員の1周の獲得絆の合計が最大になる絆アップ礼装の組み合わせを返す。
 * 各サーヴァントに1枚まで、同じ礼装は1枚まで、サーヴァントと礼装のコストの合計は maxCost 以下。
 * 礼装は霊基再臨の段階ごとの特性で条件に合うサーヴァントにだけ数え、各サーヴァントは段階ごとの値の最大を数える。
 */
export const adviseBondCraftEssences = ({
  servants,
  basePoints,
  maxCost,
  essences,
}: {
  servants: readonly CraftEssenceAdviceServant[]
  basePoints: number
  maxCost: number
  essences: readonly Essence[]
}): CraftEssenceAdvice => {
  const unknown = servants.filter(servant => servant.cost === undefined).map(servant => servant.id)
  if (unknown.length) return { kind: 'unknownCost', servantIds: unknown }
  const servantCost = servants.reduce((sum, servant) => sum + (servant.cost as number), 0)
  if (servantCost > maxCost) return { kind: 'overCost', servantCost, maxCost }

  const types = effectTypes(essences, servants.map(stageTraitsOf))
  const best = bestCombo(types, basePoints, servants.length, maxCost - servantCost)
  const picks = picksByServant(types, best, servants.length)
  const assignments = servants.map((servant, i): CraftEssenceAssignment => {
    const pick = picks.at(i)
    return {
      servantId: servant.id,
      essence: pick?.essence ?? null,
      alternatives: pick?.alternatives ?? [],
      points: best.points.at(i) ?? basePoints,
      countedStage: countedStageFor(picks, i, best),
      stageNotes: stageNotesFor(pick, i, servants, best),
    }
  })
  return {
    kind: 'ok',
    assignments,
    total: best.total,
    baseTotal: basePoints * servants.length,
    usedCost: servantCost + best.cost,
    maxCost,
  }
}

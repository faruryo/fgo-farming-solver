import type { MaterialCatalogBondUpCraftEssence } from '../material-catalog'

type Essence = MaterialCatalogBondUpCraftEssence

export type CraftEssenceAdviceServant = { id: number; cost?: number }

export type CraftEssenceAssignment = {
  servantId: number
  essence: Essence | null
  /** 同じ対象・増加率・固定・コストで、組み合わせに入っていない礼装。 */
  alternatives: Essence[]
  points: number
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

type EffectType = { target: Essence['target']; rate: number; add: number; cost: number; essences: Essence[] }

// 同じ効果とコストの礼装は入れ替えても結果が同じなので、種類ごとの枚数だけを探索する。
const effectTypes = (essences: readonly Essence[]): EffectType[] => {
  const byKey = new Map<string, EffectType>()
  const sorted = [...essences].sort((a, b) => a.collectionNo - b.collectionNo || a.id - b.id)
  for (const essence of sorted) {
    const key = `${essence.target}|${essence.rate}|${essence.add}|${essence.cost}`
    const type = byKey.get(key)
    if (type) type.essences.push(essence)
    else byKey.set(key, { target: essence.target, rate: essence.rate, add: essence.add, cost: essence.cost, essences: [essence] })
  }
  return [...byKey.values()]
}

/** パーティ全体の増加率は合計してから掛けて切り捨てる。 */
const boostedPoints = (basePoints: number, partyRate: number): number =>
  Math.floor((basePoints * (1000 + partyRate)) / 1000)

type Combo = { counts: number[]; total: number; cost: number; cards: number }

const evaluate = (types: readonly EffectType[], counts: readonly number[], basePoints: number, servantCount: number): Combo => {
  let rate = 0
  let partyAdd = 0
  let selfAdd = 0
  let cost = 0
  let cards = 0
  counts.forEach((count, i) => {
    const type = types[i]
    if (type.target === 'party') {
      rate += type.rate * count
      partyAdd += type.add * count
    } else {
      selfAdd += type.add * count
    }
    cost += type.cost * count
    cards += count
  })
  const total = servantCount * (boostedPoints(basePoints, rate) + partyAdd) + selfAdd
  return { counts: [...counts], total, cost, cards }
}

/** 合計が大きい → 使うコストが小さい → 枚数が少ない の順。 */
const isBetter = (a: Combo, b: Combo): boolean => {
  if (a.total !== b.total) return a.total > b.total
  if (a.cost !== b.cost) return a.cost < b.cost
  return a.cards < b.cards
}

const bestCombo = (types: readonly EffectType[], basePoints: number, servantCount: number, budget: number): Combo => {
  const counts = types.map(() => 0)
  let best = evaluate(types, counts, basePoints, servantCount)
  const visit = (index: number, slots: number, remaining: number) => {
    if (index === types.length) {
      const combo = evaluate(types, counts, basePoints, servantCount)
      if (isBetter(combo, best)) best = combo
      return
    }
    const type = types[index]
    const limit = Math.min(type.essences.length, slots, Math.floor(remaining / type.cost))
    for (let count = 0; count <= limit; count++) {
      counts[index] = count
      visit(index + 1, slots - count, remaining - count * type.cost)
    }
    counts[index] = 0
  }
  visit(0, servantCount, budget)
  return best
}

/**
 * 選んだサーヴァント全員の1周の獲得絆の合計が最大になる絆アップ礼装の組み合わせを返す。
 * 各サーヴァントに1枚まで、同じ礼装は1枚まで、サーヴァントと礼装のコストの合計は maxCost 以下。
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

  const types = effectTypes(essences)
  const best = bestCombo(types, basePoints, servants.length, maxCost - servantCost)
  const chosen = types
    .flatMap((type, i) =>
      type.essences.slice(0, best.counts[i]).map(essence => ({ essence, alternatives: type.essences.slice(best.counts[i]) })))
    // 誰に付けても合計は同じなので、表示を安定させるため自身に効く礼装 → コストの大きい礼装の順に先頭から付ける。
    .sort((a, b) =>
      Number(b.essence.target === 'self') - Number(a.essence.target === 'self') ||
      b.essence.cost - a.essence.cost ||
      a.essence.collectionNo - b.essence.collectionNo)

  const partyRate = chosen.reduce((sum, { essence }) => sum + (essence.target === 'party' ? essence.rate : 0), 0)
  const partyAdd = chosen.reduce((sum, { essence }) => sum + (essence.target === 'party' ? essence.add : 0), 0)
  const shared = boostedPoints(basePoints, partyRate) + partyAdd
  const assignments = servants.map((servant, i): CraftEssenceAssignment => {
    const pick = chosen.at(i)
    const selfAdd = pick?.essence.target === 'self' ? pick.essence.add : 0
    return {
      servantId: servant.id,
      essence: pick?.essence ?? null,
      alternatives: pick?.alternatives ?? [],
      points: shared + selfAdd,
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

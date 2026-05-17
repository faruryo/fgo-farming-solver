import type { Drops } from '../get-drops'
import type { MaterialsForServants } from '../get-materials'
import type { Item as AtlasItem, NiceServant } from '../../interfaces/atlas-academy'
import { createServantState } from '../../hooks/create-chaldea-state'
import { sumMaterials } from '../sum-materials'
import { solve } from '../solver'
import { toApiItemId } from '../to-api-item-id'

export type Rarity = 1 | 2 | 3 | 4 | 5
export const RARITIES: Rarity[] = [1, 2, 3, 4, 5]

export type SampleResult = {
  servantId: string
  rarity: Rarity
  totalAp: number
  feasible: boolean
}

export const SAMPLES_PER_RARITY = 5

// Deterministic sampling: pick the first N servants per rarity by ID order.
// Caller can shuffle in advance for variety.
export const sampleServantsByRarity = (
  servants: NiceServant[],
  perRarity: number = SAMPLES_PER_RARITY
): Record<Rarity, NiceServant[]> => {
  const result = { 1: [], 2: [], 3: [], 4: [], 5: [] } as Record<Rarity, NiceServant[]>
  for (const s of servants) {
    const r = s.rarity as Rarity
    if (!RARITIES.includes(r)) continue
    if (result[r].length < perRarity) result[r].push(s)
  }
  return result
}

// Map Atlas Academy numeric item IDs to fgodrop string IDs used by the solver.
export const buildAtlasIdToFgodropId = (
  atlasItems: AtlasItem[]
): Map<number, string> => {
  const map = new Map<number, string>()
  for (const item of atlasItems) {
    const fgodropId = toApiItemId(item, atlasItems)
    if (fgodropId) map.set(item.id, fgodropId)
  }
  return map
}

const convertAtlasSumToFgodropItems = (
  atlasSum: Record<string, number>,
  atlasIdToFgodropId: Map<number, string>
): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const [atlasIdStr, amount] of Object.entries(atlasSum)) {
    if (amount <= 0) continue
    const atlasId = Number(atlasIdStr)
    const fgodropId = atlasIdToFgodropId.get(atlasId)
    if (!fgodropId) continue
    out[fgodropId] = (out[fgodropId] ?? 0) + amount
  }
  return out
}

export const computeServantAp = (
  servantId: string,
  materials: MaterialsForServants,
  drops: Drops,
  atlasIdToFgodropId: Map<number, string>,
  allowedQuestIds: string[]
): { totalAp: number; feasible: boolean } => {
  const state = { [servantId]: { ...createServantState(), disabled: false } }
  const atlasSum = sumMaterials(state, materials)
  const items = convertAtlasSumToFgodropItems(atlasSum, atlasIdToFgodropId)

  if (Object.keys(items).length === 0) {
    return { totalAp: 0, feasible: false }
  }

  const result = solve(drops, {
    objective: 'ap',
    items,
    quests: allowedQuestIds,
  })
  // total_ap === 0 with non-empty quests means LP was infeasible (solver returns empty).
  const feasible = result.quests.length > 0
  return { totalAp: result.total_ap, feasible }
}

export const median = (values: number[]): number => {
  const filtered = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (filtered.length === 0) return 0
  const mid = Math.floor(filtered.length / 2)
  return filtered.length % 2 === 0
    ? (filtered[mid - 1] + filtered[mid]) / 2
    : filtered[mid]
}

export const aggregateApSamples = (samples: SampleResult[]): number => {
  const valid = samples.filter((s) => s.feasible && s.totalAp > 0)
  return median(valid.map((s) => s.totalAp))
}

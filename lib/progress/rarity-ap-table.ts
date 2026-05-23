import { getDrops, Drops } from '../get-drops'
import { getItems } from '../get-items'
import { getMaterialsForServants } from '../get-materials'
import { getNiceServants } from '../get-nice-servants'
import { collectHighDifficultyQuestIds } from './quest-access'
import { fetchData } from '../data-source'
import {
  aggregateApSamples,
  buildAtlasIdToFgodropId,
  computeServantAp,
  RARITIES,
  Rarity,
  sampleServantsByRarity,
  SampleResult,
} from './rarity-ap-sample'

export type RarityApTable = Record<Rarity, number>

export type RarityApTables = {
  basic: RarityApTable
  withHighDifficulty: RarityApTable
}

const emptyTable = (): RarityApTable => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })

export const buildRarityApTables = async (existingDrops?: any): Promise<RarityApTables> => {
  const [servants, materials, atlasItems] = await Promise.all([
    getNiceServants(),
    getMaterialsForServants(),
    getItems(),
  ])

  const drops = (existingDrops || (await getDrops())) as Drops

  const atlasIdToFgodropId = buildAtlasIdToFgodropId(atlasItems)
  const samplesByRarity = sampleServantsByRarity(servants)
  const highDifficultySet = new Set(collectHighDifficultyQuestIds(drops.quests))
  const basicQuestIds = drops.quests
    .filter((q) => !highDifficultySet.has(q.id))
    .map((q) => q.id)
  const allQuestIds = drops.quests.map((q) => q.id)

  const compute = (allowedQuestIds: string[]): RarityApTable => {
    const table = emptyTable()
    for (const r of RARITIES) {
      const samples: SampleResult[] = samplesByRarity[r].map((s) => {
        const { totalAp, feasible } = computeServantAp(
          s.id.toString(),
          materials,
          drops,
          atlasIdToFgodropId,
          allowedQuestIds
        )
        return { servantId: s.id.toString(), rarity: r, totalAp, feasible }
      })
      table[r] = aggregateApSamples(samples)
    }
    return table
  }

  return {
    basic: compute(basicQuestIds),
    withHighDifficulty: compute(allQuestIds),
  }
}

// Read precomputed rarity AP tables from KV (production) or local mock file (dev).
// If both fail, fall back to the statically bundled JSON as an ultimate safeguard.
export const getRarityApTables = async (): Promise<RarityApTables> => {
  const tables = await fetchData<RarityApTables>('rarity_ap_tables', 'mocks/rarity-ap-tables.json')
  if (!tables) {
    const fallback = await import('../../mocks/rarity-ap-tables.json')
    return fallback.default as RarityApTables
  }
  return tables
}

export const pickRarityApTable = (
  tables: RarityApTables,
  hasHighDifficultyAccess: boolean
): RarityApTable =>
  hasHighDifficultyAccess ? tables.withHighDifficulty : tables.basic

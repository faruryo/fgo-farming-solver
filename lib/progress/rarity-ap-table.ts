import { getDrops } from '../get-drops'
import { getItems } from '../get-items'
import { getMaterialsForServants } from '../get-materials'
import { getNiceServants } from '../get-nice-servants'
import { collectHighDifficultyQuestIds } from './quest-access'
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

export const buildRarityApTables = async (): Promise<RarityApTables> => {
  const [servants, materials, drops, atlasItems] = await Promise.all([
    getNiceServants(),
    getMaterialsForServants(),
    getDrops(),
    getItems(),
  ])

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

let cached: Promise<RarityApTables> | null = null

// Lazy, in-memory cache. Re-computed when the Worker instance cold-starts.
// Master-data updates trigger a re-compute on the next cold start; for now an
// in-memory reset is acceptable per design notes.
export const getRarityApTables = (): Promise<RarityApTables> => {
  if (cached == null) {
    cached = buildRarityApTables().catch((e) => {
      cached = null
      throw e
    })
  }
  return cached
}

export const pickRarityApTable = (
  tables: RarityApTables,
  hasHighDifficultyAccess: boolean
): RarityApTable =>
  hasHighDifficultyAccess ? tables.withHighDifficulty : tables.basic

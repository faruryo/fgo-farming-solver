import { getDrops, Drops } from '../get-drops'
import { getItems } from '../get-items'
import { getMaterialsForServantIds } from '../get-materials'
import { getServantsList } from '../get-nice-servants'
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

// existingDrops は MasterData / Drops どちらも受ける(両者は items の型だけ
// 異なるが、ソルバが参照する quests / drop_rates は共通)。
export const buildRarityApTables = async (existingDrops?: any): Promise<RarityApTables> => {
  // 軽量 servants_list(id/name/rarity のみ・約 19KB)でサンプリングする。
  // 旧実装は nice_servant.json(60MB 超)を parse していたため、Workers の
  // 128MB メモリ上限で GC が暴走し exceededCpu を引き起こしていた。
  const [servantsList, atlasItems] = await Promise.all([
    getServantsList(),
    getItems(),
  ])

  const drops = (existingDrops || (await getDrops())) as Drops

  const atlasIdToFgodropId = buildAtlasIdToFgodropId(atlasItems)
  const samplesByRarity = sampleServantsByRarity(servantsList)

  // サンプリングで選ばれた少数(5 × 5 レア = 最大 25 体)だけ per-servant で
  // 素材を取得する。これで 60MB 超の一括 parse を完全に回避する。
  const sampledIds = RARITIES.flatMap((r) => samplesByRarity[r].map((s) => s.id))
  const materials = await getMaterialsForServantIds(sampledIds)

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

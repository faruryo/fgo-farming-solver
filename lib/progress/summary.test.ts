import { describe, it, expect } from 'vitest'
import { buildPeriodSummary, type BuildContext } from './summary'
import type { Snapshot } from './snapshot'
import type { Rarity } from './rarity-ap-sample'

const apTable: Record<Rarity, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

const makeCtx = (
  itemCounts: Record<string, number> | null,
  totalAp: number | null
): BuildContext => ({
  current: {
    chaldea: null,
    itemCounts,
    checkedQuests: [],
    totalAp,
    generatedAtIso: '2026-06-03T00:00:00.000Z',
  },
  highDifficultyQuestIds: [],
  rarityById: new Map(),
  nameById: new Map(),
  apTableBasic: apTable,
  apTableHighDifficulty: apTable,
  generatedAtIso: '2026-06-03T00:00:00.000Z',
})

const makeSnapshot = (items: Record<string, number>): Snapshot => ({
  id: 's1',
  userId: 'u1',
  data: { items },
  createdAt: '2026-06-02T00:00:00.000Z',
})

describe('buildPeriodSummary targetApIncrease', () => {
  it('目標(アイテム個数)が変わっていなければ、ソルバーの実AP総量に関係なく増加は0', () => {
    // 過去・現在ともに目標個数 100。current.totalAp は大きな実AP総量(回帰: 単位取り違えで誤って巨大化していた)
    const summary = buildPeriodSummary(
      'previous',
      makeSnapshot({ '6503': 100 }),
      makeCtx({ '6503': 100 }, 414211),
      true
    )
    expect(summary?.deltaApRaw).toBe(0)
    expect(summary?.targetApIncrease).toBe(0)
  })

  it('目標(アイテム個数)を増やした分だけ targetApIncrease が増える', () => {
    const summary = buildPeriodSummary(
      'previous',
      makeSnapshot({ '6503': 100 }),
      makeCtx({ '6503': 300 }, 414211),
      true
    )
    // current 300 - past 100 = 200 増加
    expect(summary?.targetApIncrease).toBe(200)
  })

  it('目標を減らした(周回で消費)場合は増加0', () => {
    const summary = buildPeriodSummary(
      'previous',
      makeSnapshot({ '6503': 300 }),
      makeCtx({ '6503': 100 }, 414211),
      true
    )
    expect(summary?.targetApIncrease).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CRAFT_DATA_GAP_LIMIT,
  formatCraftDataGapLog,
  parseCraftDataGaps,
  readCraftDataGapRequest,
} from './event-craft-data-gap-log'

const valid = (count: number) => ({
  userId: 'google-sub',
  possession: { 6518: 3 },
  gaps: Array.from({ length: count }, (_, i) => ({
    atlasId: 6518 + i,
    reason: i % 2 === 0 ? 'absent' : 'unrated',
    owned: 9,
  })),
})

describe('parseCraftDataGaps', () => {
  it('所持数や識別子を捨て、ログ行は count / absent / unrated だけ', () => {
    const gaps = parseCraftDataGaps(valid(2))
    expect(gaps).toEqual([
      { atlasId: 6518, reason: 'absent' },
      { atlasId: 6519, reason: 'unrated' },
    ])
    const log = formatCraftDataGapLog(gaps ?? [])
    expect(Object.keys(log)).toEqual(['event', 'count', 'absent', 'unrated'])
    expect(JSON.stringify(log)).toBe(
      '{"event":"craft_data_gap","count":2,"absent":[6518],"unrated":[6519]}',
    )
    expect(JSON.stringify(log)).not.toContain('userId')
    expect(JSON.stringify(log)).not.toContain('possession')
    expect(JSON.stringify(log)).not.toContain('owned')
  })

  it('40件は受け、41件と不正 reason は拒む', () => {
    expect(parseCraftDataGaps(valid(CRAFT_DATA_GAP_LIMIT))).toHaveLength(CRAFT_DATA_GAP_LIMIT)
    expect(parseCraftDataGaps(valid(CRAFT_DATA_GAP_LIMIT + 1))).toBeNull()
    expect(parseCraftDataGaps({ gaps: [{ atlasId: 6518, reason: 'missing' }] })).toBeNull()
    expect(parseCraftDataGaps({ gaps: [{ atlasId: 1.5, reason: 'absent' }] })).toBeNull()
    expect(parseCraftDataGaps({ gaps: [] })).toBeNull()
  })

  it('4KB 超のボディはログを作らない', () => {
    const text = JSON.stringify({ gaps: [{ atlasId: 6518, reason: 'absent', note: 'x'.repeat(5000) }] })
    expect(new TextEncoder().encode(text).byteLength).toBeGreaterThan(4096)
    expect(readCraftDataGapRequest(text)).toEqual({ ok: false })
    const small = JSON.stringify({ gaps: [{ atlasId: 6518, reason: 'absent', userId: 'abc' }] })
    expect(readCraftDataGapRequest(small)).toEqual({
      ok: true,
      log: { event: 'craft_data_gap', count: 1, absent: [6518], unrated: [] },
    })
  })
})

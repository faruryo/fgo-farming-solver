import { describe, expect, it } from 'vitest'
import {
  CRAFT_DATA_GAP_BODY_LIMIT,
  CRAFT_DATA_GAP_LIMIT,
  craftDataGapBatches,
  formatCraftDataGapLog,
  parseCraftDataGaps,
  readCraftDataGapRequest,
  readLimitedUtf8,
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

  it('41件は40件と1件に分ける', () => {
    const gaps = Array.from({ length: CRAFT_DATA_GAP_LIMIT + 1 }, (_, i) => ({
      atlasId: i + 1,
      reason: 'absent' as const,
    }))
    const batches = craftDataGapBatches(gaps)
    expect(batches.map((batch) => batch.length)).toEqual([CRAFT_DATA_GAP_LIMIT, 1])
    expect(batches.flat()).toEqual(gaps)
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

  it('4KB を超えたチャンク以降は読まない', async () => {
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = new Uint8Array(1024)
        pulled += chunk.byteLength
        controller.enqueue(chunk)
        if (pulled >= CRAFT_DATA_GAP_BODY_LIMIT * 2) controller.close()
      },
    })
    await expect(readLimitedUtf8(stream, CRAFT_DATA_GAP_BODY_LIMIT)).resolves.toBeNull()
    expect(pulled).toBe(CRAFT_DATA_GAP_BODY_LIMIT + 1024)
  })
})

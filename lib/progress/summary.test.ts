import { describe, it, expect } from 'vitest'
import { buildPeriodSummary, type BuildContext } from './summary'
import type { Snapshot } from './snapshot'
import type { ChaldeaState } from '../../hooks/create-chaldea-state'

const makeCtx = (chaldea: ChaldeaState | null = null): BuildContext => ({
  current: {
    chaldea,
    itemCounts: null,
    checkedQuests: [],
    totalAp: null,
    generatedAtIso: '2026-06-03T00:00:00.000Z',
  },
  rarityById: new Map(),
  nameById: new Map(),
  generatedAtIso: '2026-06-03T00:00:00.000Z',
})

const makeSnapshot = (data: unknown): Snapshot => ({
  id: 's1',
  userId: 'u1',
  data,
  createdAt: '2026-06-02T00:00:00.000Z',
})

// 単一サーヴァントの再臨レンジだけを持つ最小 ChaldeaState。
const chaldeaWithAscension = (start: number, end: number): ChaldeaState =>
  ({
    '100100': {
      disabled: false,
      targets: { ascension: { disabled: false, ranges: [{ start, end }] } },
    },
  }) as unknown as ChaldeaState

describe('buildPeriodSummary (実プレイ基準の指標)', () => {
  it('過去所持(posession)を pastPosession として返す', () => {
    const summary = buildPeriodSummary(
      'previous',
      makeSnapshot({ posession: { '6503': 3, '6512': 10 } }),
      makeCtx(),
      true
    )
    expect(summary?.pastPosession).toEqual({ '6503': 3, '6512': 10 })
    // サーバ側 tier は暫定 none(クライアントが reducedAp 確定後に上書き)
    expect(summary?.tier).toBe('none')
    // reduced* はサーバでは未確定
    expect(summary?.reducedAp).toBeUndefined()
  })

  it('育成で目標レンジが縮んだ分を growthTotal に集計する', () => {
    // 過去: 再臨 0→4(残り4)、現在: 2→4(残り2) → 2 育成した
    const summary = buildPeriodSummary(
      'previous',
      makeSnapshot({ material: chaldeaWithAscension(0, 4) }),
      makeCtx(chaldeaWithAscension(2, 4)),
      true
    )
    expect(summary?.growthTotal).toBe(2)
    expect(summary?.servantGrowth.length).toBe(1)
  })

  it('スナップショットが無ければ first_time/no_snapshot フォールバック', () => {
    const first = buildPeriodSummary('previous', null, makeCtx(), false)
    expect(first?.fallback).toBe('first_time')
    expect(first?.growthTotal).toBe(0)

    const none = buildPeriodSummary('week', null, makeCtx(), true)
    expect(none?.fallback).toBe('no_snapshot_for_period')
  })

  it('posession が無いスナップショットでは pastPosession は undefined', () => {
    const summary = buildPeriodSummary('previous', makeSnapshot({ items: {} }), makeCtx(), true)
    expect(summary?.pastPosession).toBeUndefined()
  })

  it('material も posession も無い degenerate スナップショットは比較不能(fallback)扱い', () => {
    // 旧 /api/solve が書いた `{items,quests}` のみの残骸を模した snapshot。
    const summary = buildPeriodSummary(
      'week',
      makeSnapshot({ items: '10:617,11:5', quests: '101,103' }),
      makeCtx(),
      true
    )
    expect(summary?.fallback).toBe('no_snapshot_for_period')
    expect(summary?.growthTotal).toBe(0)
    expect(summary?.servantGrowth).toEqual([])
    expect(summary?.pastPosession).toBeUndefined()
    // 経過時間や snapshotCreatedAt を持たせず、有効な比較基準として振る舞わせない。
    expect(summary?.snapshotCreatedAt).toBeNull()
  })

  it('material だけ持つ(posession 欠落)スナップショットは degenerate にしない', () => {
    const summary = buildPeriodSummary(
      'previous',
      makeSnapshot({ material: chaldeaWithAscension(0, 4) }),
      makeCtx(chaldeaWithAscension(2, 4)),
      true
    )
    expect(summary?.fallback).toBeNull()
    expect(summary?.growthTotal).toBe(2)
  })
})

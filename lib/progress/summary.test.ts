import { describe, it, expect } from 'vitest'
import { buildPeriodSummary, buildProgressResponse, type BuildContext } from './summary'
import type { Snapshot } from './snapshot'
import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import type { D1Database } from '@cloudflare/workers-types'

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
      'd30',
      makeSnapshot({ posession: { '6503': 3, '6512': 10 } }),
      makeCtx(),
      true
    )
    expect(summary?.pastPosession).toEqual({ '6503': 3, '6512': 10 })
    // サーバ側 tier は暫定 none(クライアントが forwardLaps 確定後に上書き)
    expect(summary?.tier).toBe('none')
    // forward* はサーバでは未確定
    expect(summary?.forwardLaps).toBeUndefined()
  })

  it('育成で目標レンジが縮んだ分を growthTotal に集計する', () => {
    // 過去: 再臨 0→4(残り4)、現在: 2→4(残り2) → 2 育成した
    const summary = buildPeriodSummary(
      'd30',
      makeSnapshot({ material: chaldeaWithAscension(0, 4) }),
      makeCtx(chaldeaWithAscension(2, 4)),
      true
    )
    expect(summary?.growthTotal).toBe(2)
    expect(summary?.servantGrowth.length).toBe(1)
  })

  it('スナップショットが無ければ first_time/no_snapshot フォールバック', () => {
    const first = buildPeriodSummary('d30', null, makeCtx(), false)
    expect(first?.fallback).toBe('first_time')
    expect(first?.growthTotal).toBe(0)

    const none = buildPeriodSummary('d60', null, makeCtx(), true)
    expect(none?.fallback).toBe('no_snapshot_for_period')
  })

  it('posession が無いスナップショットでは pastPosession は undefined', () => {
    const summary = buildPeriodSummary('d30', makeSnapshot({ items: {} }), makeCtx(), true)
    expect(summary?.pastPosession).toBeUndefined()
  })

  it('material も posession も無い degenerate スナップショットは比較不能(fallback)扱い', () => {
    // 旧 /api/solve が書いた `{items,quests}` のみの残骸を模した snapshot。
    const summary = buildPeriodSummary(
      'd60',
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

  it('新規入手サーヴァントを名前付き(newServants)で返す', () => {
    // 過去: 100100 が未所持(disabled:true)、現在: 所持(disabled:false) → 新規 1 騎。
    const pastMaterial = {
      '100100': { disabled: true, targets: {} },
    } as unknown as ChaldeaState
    const currentMaterial = {
      '100100': { disabled: false, targets: {} },
    } as unknown as ChaldeaState
    const ctx: BuildContext = {
      ...makeCtx(currentMaterial),
      nameById: new Map([['100100', 'アルトリア・ペンドラゴン']]),
    }
    const summary = buildPeriodSummary(
      'd30',
      makeSnapshot({ material: pastMaterial }),
      ctx,
      true
    )
    expect(summary?.newServantCount).toBe(1)
    expect(summary?.newServants).toEqual([
      { servantId: '100100', servantName: 'アルトリア・ペンドラゴン' },
    ])
  })

  it('material だけ持つ(posession 欠落)スナップショットは degenerate にしない', () => {
    const summary = buildPeriodSummary(
      'd30',
      makeSnapshot({ material: chaldeaWithAscension(0, 4) }),
      makeCtx(chaldeaWithAscension(2, 4)),
      true
    )
    expect(summary?.fallback).toBeNull()
    expect(summary?.growthTotal).toBe(2)
  })
})

// D1Database の最小モック: prepare().bind().all() チェーンのみ提供する。
const makeMockDb = (
  rows: { id: string; user_id: string; data: string; created_at: string }[]
): D1Database =>
  ({
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: rows }),
      }),
    }),
  }) as unknown as D1Database

describe('buildProgressResponse (d30/d60/d90 の3窓を返す)', () => {
  it('periods が d30/d60/d90 キーで PeriodSummary を返す', async () => {
    const db = makeMockDb([
      {
        id: 'u1:2026-06-02',
        user_id: 'u1',
        data: JSON.stringify({ posession: { '6503': 3 } }),
        created_at: '2026-06-02T00:00:00.000Z',
      },
    ])

    const response = await buildProgressResponse({
      db,
      userId: 'u1',
      current: {
        chaldea: null,
        itemCounts: null,
        checkedQuests: null,
        totalAp: 1000,
        generatedAtIso: '2026-07-01T00:00:00.000Z',
      },
      servants: [],
    })

    expect(Object.keys(response.periods).sort()).toEqual(['d30', 'd60', 'd90'])
    expect(response.periods.d30?.period).toBe('d30')
    expect(response.periods.d60?.period).toBe('d60')
    expect(response.periods.d90?.period).toBe('d90')
    // 唯一のスナップショットが全ターゲットの最近傍として選ばれる。
    expect(response.periods.d30?.fallback).toBeNull()
    expect(response.periods.d60?.fallback).toBeNull()
    expect(response.periods.d90?.fallback).toBeNull()
  })

  it('スナップショットが無ければ全期間 first_time フォールバック', async () => {
    const db = makeMockDb([])

    const response = await buildProgressResponse({
      db,
      userId: 'u1',
      current: {
        chaldea: null,
        itemCounts: null,
        checkedQuests: null,
        totalAp: 1000,
        generatedAtIso: '2026-07-01T00:00:00.000Z',
      },
      servants: [],
    })

    expect(response.periods.d30?.fallback).toBe('first_time')
    expect(response.periods.d60?.fallback).toBe('first_time')
    expect(response.periods.d90?.fallback).toBe('first_time')
  })
})

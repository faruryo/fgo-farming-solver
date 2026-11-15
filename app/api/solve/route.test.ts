import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('../../../lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}))

vi.mock('../../../lib/fgo-drop', () => ({
  getDrops: vi.fn(),
}))

vi.mock('../../../lib/get-drops', () => ({
  getDrops: vi.fn(),
}))

import { GET, resolveSolveVisibility } from './route'
import { auth } from '../../../lib/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDrops } from '../../../lib/get-drops'
import type { BothResult } from '../../../interfaces/api'

describe('resolveSolveVisibility', () => {
  it('returns error for anonymous users requesting private visibility (fail-closed)', () => {
    expect(resolveSolveVisibility('anonymous', 'false')).toEqual({
      ok: false,
      error: 'Unauthorized: Private results require authentication',
    })
    expect(resolveSolveVisibility('anonymous', '0')).toEqual({
      ok: false,
      error: 'Unauthorized: Private results require authentication',
    })
  })

  it('allows public results for anonymous users', () => {
    expect(resolveSolveVisibility('anonymous', 'true')).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('anonymous', null)).toEqual({ ok: true, isPublic: 1 })
  })

  it('respects private setting for logged-in users', () => {
    expect(resolveSolveVisibility('user-123', 'false')).toEqual({ ok: true, isPublic: 0 })
    expect(resolveSolveVisibility('user-123', '0')).toEqual({ ok: true, isPublic: 0 })
  })

  it('defaults to 1 (public) for logged-in users when parameter is not false/0', () => {
    expect(resolveSolveVisibility('user-123', 'true')).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('user-123', '1')).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('user-123', null)).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('user-123', '')).toEqual({ ok: true, isPublic: 1 })
  })
})

describe('GET /api/solve', () => {
  const run = vi.fn()
  const bind = vi.fn()
  const prepare = vi.fn()
  const batch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    run.mockResolvedValue({ success: true })
    bind.mockReturnValue({ run })
    prepare.mockReturnValue({ bind })
    batch.mockResolvedValue([])
    vi.mocked(getCloudflareContext).mockResolvedValue({
      env: { DB: { prepare, batch } },
    } as never)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(getDrops).mockResolvedValue({
      items: [],
      quests: [{ id: 'q1', area: 'A', name: 'Q1', ap: 40 }],
      drop_rates: [{ quest_id: 'q1', item_id: 'i1', drop_rate: 0.5 }],
      campaigns: [],
    } as never)
  })

  const callGet = (query: string) =>
    GET(new NextRequest(`http://localhost/api/solve?${query}`))

  /** 保存した 1 件の result_data(7 番目の bind 引数)を取り出す。 */
  const savedResultData = (): BothResult => {
    expect(bind).toHaveBeenCalledTimes(1)
    return JSON.parse(bind.mock.calls[0][6] as string) as BothResult
  }

  it('stockIncluded=true なら保存した結果に印が付く', async () => {
    const res = await callGet('items=i1:10&quests=q1&stockIncluded=true')
    expect(res.status).toBe(200)
    const saved = savedResultData()
    expect(saved.ap.params.stockIncluded).toBe(true)
    expect(saved.lap.params.stockIncluded).toBe(true)
  })

  it.each([
    ['引数なし', 'items=i1:10&quests=q1'],
    ['1', 'items=i1:10&quests=q1&stockIncluded=1'],
    ['false', 'items=i1:10&quests=q1&stockIncluded=false'],
    ['空文字', 'items=i1:10&quests=q1&stockIncluded='],
  ])('stockIncluded が %s なら印が付かない', async (_label, query) => {
    const res = await callGet(query)
    expect(res.status).toBe(200)
    const saved = savedResultData()
    expect(saved.ap.params.stockIncluded).toBeUndefined()
    expect(saved.lap.params.stockIncluded).toBeUndefined()
  })

  it('itemsStock を送っても通常の目標で 1 件だけ保存し、応答に組の ID が無い', async () => {
    const res = await callGet('items=i1:10&itemsStock=i1:30&quests=q1')
    expect(res.status).toBe(200)
    expect(batch).not.toHaveBeenCalled()
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledTimes(1)
    expect(bind.mock.calls[0][3]).toBe(JSON.stringify({ i1: 10 }))
    const saved = savedResultData()
    expect(saved.ap.params.items).toEqual({ i1: 10 })
    expect(saved.ap.params.stockIncluded).toBeUndefined()
    const body: Record<string, unknown> = await res.json()
    expect(typeof body.id).toBe('string')
    expect(body).not.toHaveProperty('batchId')
  })
})

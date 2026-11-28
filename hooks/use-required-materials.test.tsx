// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaterialsForServants } from '../lib/get-materials'
import type { MaterialCatalogV1 } from '../lib/material-catalog'
import { loadMaterialCatalog } from './use-material-catalog'
import { createChaldeaState, type ChaldeaState } from './create-chaldea-state'
import { useRequiredMaterials } from './use-required-materials'
import { sumClassScoreMaterials } from '../lib/class-score/sum'
import { getClassBoardData } from '../lib/class-score/board-loader'
import { getPlayableSquareIds } from '../lib/class-score/route-actions'
import { isCloudSyncKey } from '../lib/constants/storage-keys'
import { DEFAULT_CLASS_SCORE_STATE, type ClassScoreState } from '../lib/class-score/types'

vi.mock('./use-material-catalog', () => ({ loadMaterialCatalog: vi.fn() }))
const fetchMock = vi.mocked(loadMaterialCatalog)
const catalogOf = (materials: MaterialsForServants) =>
  ({ schemaVersion: 1, updatedAt: 0, sources: {}, servants: [], items: [], materials }) as unknown as MaterialCatalogV1

const SERVANT_KEY = 'material/servant-result'
const LEGACY_KEY = 'material/result'

// 再臨 0→1 で素材 6001 ×5 と QP 1000。
const servantMaterials = (): MaterialsForServants[string] => ({
  ascensionMaterials: { '0': { items: [{ item: { id: 6001 }, amount: 5 }], qp: 1000 } },
  skillMaterials: {},
  appendSkillMaterials: {},
})

const rosterOf = (ids: string[], end = 1): ChaldeaState => {
  const state = createChaldeaState(ids)
  for (const id of ids) {
    const s: ChaldeaState[string] = Reflect.get(state, id)
    s.disabled = false
    s.targets.ascension.ranges = [{ start: 0, end }]
    s.targets.skill.disabled = true
    s.targets.appendSkill.disabled = true
  }
  return state
}

const saberTarget: ClassScoreState = {
  classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'target' },
}
const SABER_QP = 317_000_000

const set = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))
const read = (key: string): unknown => {
  const raw = localStorage.getItem(key)
  return raw === null ? null : JSON.parse(raw)
}
/** 別の部品やクラウド復元が書いたときと同じく、保存してから ls-sync を出す。 */
const externalWrite = (key: string, value: unknown) => {
  act(() => {
    set(key, value)
    window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key } }))
  })
}

const deferred = <T,>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const lsSyncKeys = () => {
  const keys: string[] = []
  const listener = (e: Event) => keys.push(((e as CustomEvent).detail as { key: string }).key)
  window.addEventListener('ls-sync', listener)
  return { keys, stop: () => window.removeEventListener('ls-sync', listener) }
}

describe('useRequiredMaterials', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.restoreAllMocks()
  })

  it('育成ぶんがあれば育成ぶんとクラススコアぶんを足し、旧値は使わない', async () => {
    set(SERVANT_KEY, { '6001': 5, '1': 1000 })
    set(LEGACY_KEY, { '6001': 999 })
    set('classScore', saberTarget)
    fetchMock.mockReturnValue(new Promise(() => {}))
    set('material', rosterOf(['1']))
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.total['6001']).toBe(5)
    expect(result.current.total['1']).toBe(SABER_QP + 1000)
    expect(result.current.classScore['1']).toBe(SABER_QP)
    expect(result.current.stale).toBe(false)
  })

  it('キーが無い端末では、素材データの取得後にサーヴァントの状態から求めた育成ぶんを保存し、同期の対象のキーには知らせない', async () => {
    set('material', rosterOf(['1']))
    set(LEGACY_KEY, { '6001': 999 })
    set('classScore', saberTarget)
    const pending = deferred<MaterialCatalogV1>()
    fetchMock.mockReturnValue(pending.promise)
    const events = lsSyncKeys()
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    // 取得中は旧値を合算済みとして読み、キーを作らない
    expect(result.current.source).toBe('legacy')
    expect(result.current.total).toEqual({ '6001': 999 })
    expect(localStorage.getItem(SERVANT_KEY)).toBeNull()

    await act(async () => pending.resolve(catalogOf({ '1': servantMaterials() })))
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({ '6001': 5, '1': 1000 }))
    expect(result.current.source).toBe('servant')
    expect(result.current.total['6001']).toBe(5)
    expect(result.current.total['1']).toBe(SABER_QP + 1000)
    // 旧値は書き換えない。出した通知は同期の対象外のキーだけ（同期が dirty にならない）
    expect(read(LEGACY_KEY)).toEqual({ '6001': 999 })
    expect(events.keys.length).toBeGreaterThan(0)
    expect(events.keys.every((k) => !isCloudSyncKey(k))).toBe(true)
    events.stop()
  })

  it('取得に失敗したら旧値を合算済みとして読み、キーを作らず、古い可能性を出す', async () => {
    set('material', rosterOf(['1']))
    set(LEGACY_KEY, { '6001': 999 })
    set('classScore', saberTarget)
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.total).toEqual({ '6001': 999 })
    expect(localStorage.getItem(SERVANT_KEY)).toBeNull()
  })

  it('サーヴァントの目標が無ければ取得せずに {} で保存し、旧値を使わない', async () => {
    set('material', createChaldeaState(['1', '2']))
    set(LEGACY_KEY, { '6001': 999 })
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({}))
    expect(fetchMock).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.total).toEqual({}))
    expect(result.current.source).toBe('servant')
  })

  it('サーヴァントの状態の保存値を読む前は目標なしと判定せず、初期値も保存しない', async () => {
    set('material', rosterOf(['1']))
    set(LEGACY_KEY, { '6001': 999 })
    fetchMock.mockReturnValue(new Promise(() => {}))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem(SERVANT_KEY)).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('キーがあっても material の変更（復元の ls-sync を含む）で求め直して書く', async () => {
    set('material', rosterOf(['1']))
    set(SERVANT_KEY, { '6001': 5, '1': 1000 })
    fetchMock.mockResolvedValue(catalogOf({ '1': servantMaterials(), '2': servantMaterials() }))
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(result.current.total['6001']).toBe(5))

    externalWrite('material', rosterOf(['1', '2']))
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({ '6001': 10, '1': 2000 }))
    await waitFor(() => expect(result.current.total['6001']).toBe(10))
  })

  it('育成ぶん・旧値・クラススコアの変更（ls-sync）で値が更新される', async () => {
    set('material', createChaldeaState(['1']))
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({}))
    await waitFor(() => expect(result.current.total).toEqual({}))

    externalWrite('classScore', saberTarget)
    await waitFor(() => expect(result.current.total['1']).toBe(SABER_QP))

    externalWrite(SERVANT_KEY, { '6001': 3 })
    await waitFor(() => expect(result.current.total['6001']).toBe(3))

    // 育成ぶんがあるので、旧値が変わっても使わない
    externalWrite(LEGACY_KEY, { '6001': 999 })
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.total['6001']).toBe(3)
  })

  it('旧値の変更は、育成ぶんが無い間の表示に反映される', async () => {
    set('material', rosterOf(['1']))
    fetchMock.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    externalWrite(LEGACY_KEY, { '6001': 42 })
    await waitFor(() => expect(result.current.total).toEqual({ '6001': 42 }))
  })

  it('読む画面で先に {} を作ったあと、移行前のクラウドデータを復元すると求め直す', async () => {
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({}))
    fetchMock.mockResolvedValue(catalogOf({ '1': servantMaterials() }))

    // 復元は旧値とサーヴァントの状態を書いて、それぞれ ls-sync を出す
    externalWrite(LEGACY_KEY, { '6001': 999 })
    externalWrite('material', rosterOf(['1']))
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({ '6001': 5, '1': 1000 }))
    await waitFor(() => expect(result.current.total).toEqual({ '6001': 5, '1': 1000 }))
    expect(result.current.source).toBe('servant')
  })

  it('空の値を作ったあとの復元で取得に失敗すると、旧値を読み古い可能性を出す', async () => {
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({}))
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    externalWrite(LEGACY_KEY, { '6001': 999 })
    externalWrite('material', rosterOf(['1']))
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.total).toEqual({ '6001': 999 })
    expect(read(SERVANT_KEY)).toEqual({})
  })

  it('取得中に material が変わったら、古い状態で求めた結果を書かない', async () => {
    set('material', rosterOf(['1']))
    const first = deferred<MaterialCatalogV1>()
    const second = deferred<MaterialCatalogV1>()
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    externalWrite('material', rosterOf(['1'], 2))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await act(async () => first.resolve(catalogOf({ '1': servantMaterials() })))
    expect(setItem.mock.calls.some(([k]) => k === SERVANT_KEY)).toBe(false)

    // 再臨 0→2 は 0→1 の素材に 1→2 の素材を足す
    const twoSteps = {
      ...servantMaterials(),
      ascensionMaterials: {
        '0': { items: [{ item: { id: 6001 }, amount: 5 }], qp: 1000 },
        '1': { items: [{ item: { id: 6002 }, amount: 2 }], qp: 2000 },
      },
    } as unknown as MaterialsForServants[string]
    await act(async () => second.resolve(catalogOf({ '1': twoSteps })))
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({ '6001': 5, '6002': 2, '1': 3000 }))
    expect(result.current.total['6002']).toBe(2)
  })

  it('素材データに無いサーヴァントを飛ばして求める', async () => {
    set('material', rosterOf(['1', '999']))
    fetchMock.mockResolvedValue(catalogOf({ '1': servantMaterials() }))
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(read(SERVANT_KEY)).toEqual({ '6001': 5, '1': 1000 }))
    expect(result.current.stale).toBe(false)
  })

  it('クラススコアが部分目標の盤面なら、その盤面ぶんを足す', async () => {
    const [first, second] = getPlayableSquareIds(getClassBoardData('saber'))
    const partial: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes },
      boards: { saber: { unlockedSquareIds: [], targetSquareIds: [first, second] } },
    }
    set('classScore', partial)
    set(SERVANT_KEY, {})
    const { result } = renderHook(() => useRequiredMaterials())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    const cs = sumClassScoreMaterials(partial)
    expect(Object.keys(cs).length).toBeGreaterThan(0)
    expect(result.current.total).toEqual(cs)
  })
})

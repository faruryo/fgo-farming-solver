// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countsOrEmpty, itemCountsOrEmpty, recordOrEmpty, useLocalStorage } from './use-local-storage'
import { mergeChaldeaState } from './use-chaldea-state-merger'
import { ChaldeaState, ServantState, createChaldeaState } from './create-chaldea-state'

describe('useLocalStorage change notifications', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not report the initial default write as a user change, but reports later edits', async () => {
    const onSync = vi.fn()
    window.addEventListener('ls-sync', onSync)

    const { result } = renderHook(() =>
      useLocalStorage('test/default-write', { count: 0 }),
    )

    await waitFor(() => {
      expect(localStorage.getItem('test/default-write')).toBe('{"count":0}')
    })
    expect(onSync).not.toHaveBeenCalled()

    act(() => {
      result.current[1]({ count: 1 })
    })

    await waitFor(() => {
      expect(localStorage.getItem('test/default-write')).toBe('{"count":1}')
    })
    expect(onSync).toHaveBeenCalledTimes(1)
    expect(onSync.mock.calls[0][0]).toBeInstanceOf(CustomEvent)
    expect((onSync.mock.calls[0][0] as CustomEvent).detail).toEqual({
      key: 'test/default-write',
    })

    window.removeEventListener('ls-sync', onSync)
  })

  it('ignores a corrupted value synced from another tab instead of throwing', async () => {
    const { result } = renderHook(() =>
      useLocalStorage('test/corrupted-sync', { count: 0 }),
    )

    await waitFor(() => {
      expect(localStorage.getItem('test/corrupted-sync')).toBe('{"count":0}')
    })

    localStorage.setItem('test/corrupted-sync', '{not valid json')
    act(() => {
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'test/corrupted-sync' } }))
    })

    expect(result.current[0]).toEqual({ count: 0 })
  })
})

describe('useLocalStorage + mergeChaldeaState integration (material state)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Only the full persist -> ls-sync -> onGet -> persist loop reproduces the
  // bug; a direct mergeChaldeaState call skips it.
  const readMaterial = () =>
    JSON.parse(localStorage.getItem('material') ?? '{}') as ChaldeaState

  it('does not clobber a disabled servant\'s start via the persist -> ls-sync -> onGet -> persist loop', async () => {
    const initialState = createChaldeaState(['1'])
    const editedTargets: ServantState['targets'] = {
      ascension: { disabled: false, ranges: [{ start: 3, end: 4 }] },
      skill: {
        disabled: false,
        ranges: [
          { start: 7, end: 10 },
          { start: 7, end: 10 },
          { start: 7, end: 10 },
        ],
      },
      appendSkill: {
        disabled: false,
        ranges: [
          { start: 1, end: 10 },
          { start: 1, end: 10 },
          { start: 1, end: 10 },
          { start: 1, end: 10 },
          { start: 1, end: 10 },
        ],
      },
    }

    // Pre-seed localStorage as if servant "1" was already owned with an
    // edited start, saved by a prior session.
    const owned: ChaldeaState = { '1': { disabled: false, targets: editedTargets } }
    localStorage.setItem('material', JSON.stringify(owned))

    const onGet = (state: ChaldeaState) => mergeChaldeaState(initialState, state)
    const { result } = renderHook(() =>
      useLocalStorage<ChaldeaState>('material', initialState, { onGet })
    )

    // Initial mount reads localStorage through onGet and picks up the
    // pre-seeded, edited start.
    await waitFor(() => {
      expect(result.current[0]['1'].targets.ascension.ranges[0].start).toBe(3)
    })

    // User toggles the servant to unowned. This is the raw setState the
    // component calls -- it does not go through onGet itself.
    act(() => {
      result.current[1]({ '1': { disabled: true, targets: editedTargets } })
    })

    // The persist effect writes the new (disabled) state to localStorage.
    await waitFor(() => {
      expect(readMaterial()['1'].disabled).toBe(true)
    })

    // Simulate another hook instance (other component/tab) handling the
    // resync this persist just fired: re-read, re-run onGet, persist again.
    act(() => {
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'material' } }))
    })

    await waitFor(() => {
      expect(readMaterial()['1'].targets.ascension.ranges[0].start).toBe(3)
    })

    const finalStored = readMaterial()
    expect(finalStored['1'].targets.skill.ranges.every((r) => r.start === 7)).toBe(true)
    expect(finalStored['1'].targets.appendSkill.ranges.every((r) => r.start === 1)).toBe(true)
  })

  it('does not clobber a newly-owned servant with no prior individual entry via the persist -> ls-sync -> onGet -> persist loop', async () => {
    const initialState = createChaldeaState(['all', '1'])

    // Pre-seed localStorage with only the global "all" template (skill target
    // 9), as if the user applied a global goal but servant "1" (newly added
    // to the catalog) has never been individually saved before.
    const allOnly: ChaldeaState = {
      all: {
        disabled: true,
        targets: {
          ascension: { disabled: false, ranges: [{ start: 0, end: 4 }] },
          skill: {
            disabled: false,
            ranges: [
              { start: 1, end: 9 },
              { start: 1, end: 9 },
              { start: 1, end: 9 },
            ],
          },
          appendSkill: {
            disabled: false,
            ranges: [
              { start: 0, end: 10 },
              { start: 0, end: 10 },
              { start: 0, end: 10 },
              { start: 0, end: 10 },
              { start: 0, end: 10 },
            ],
          },
        },
      },
    }
    localStorage.setItem('material', JSON.stringify(allOnly))

    const onGet = (state: ChaldeaState) => mergeChaldeaState(initialState, state)
    const { result } = renderHook(() =>
      useLocalStorage<ChaldeaState>('material', initialState, { onGet })
    )

    // Initial mount synthesizes servant "1" from the "all" template: unowned,
    // target inherited (end 9), current level at default (start 1).
    await waitFor(() => {
      expect(result.current[0]['1'].disabled).toBe(true)
      expect(result.current[0]['1'].targets.skill.ranges[0].end).toBe(9)
    })

    // User marks servant "1" as owned and sets skill current levels (as the
    // "所持" toggle + skill-level clicks do, via functional setState).
    const ownedTargets: ServantState['targets'] = {
      ascension: { disabled: false, ranges: [{ start: 4, end: 4 }] },
      skill: {
        disabled: false,
        ranges: [
          { start: 9, end: 9 },
          { start: 10, end: 9 },
          { start: 9, end: 9 },
        ],
      },
      appendSkill: {
        disabled: true,
        ranges: [
          { start: 1, end: 0 },
          { start: 1, end: 0 },
          { start: 1, end: 0 },
          { start: 1, end: 0 },
          { start: 1, end: 0 },
        ],
      },
    }
    act(() => {
      result.current[1]((prev) => ({
        ...prev,
        '1': { disabled: false, targets: ownedTargets },
      }))
    })

    await waitFor(() => {
      expect(readMaterial()['1'].disabled).toBe(false)
    })

    // Simulate another hook instance (other component/tab) handling the
    // resync this persist just fired: re-read, re-run onGet, persist again.
    act(() => {
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'material' } }))
    })

    await waitFor(() => {
      expect(readMaterial()['1'].disabled).toBe(false)
    })

    const finalStored = readMaterial()
    expect(finalStored['1'].targets.skill.ranges.map((r) => r.start)).toEqual([9, 10, 9])
  })
})

describe('recordOrEmpty', () => {
  it.each([null, undefined, [1, 2], 'text', 3, true])('object でない保存値（%j）は空の object にする', (stored) => {
    expect(recordOrEmpty(stored)).toEqual({})
  })

  it('object はそのまま返す', () => {
    const stored = { 1: 2 }
    expect(recordOrEmpty(stored)).toBe(stored)
  })

  it('保存値が null でも onGet で初期値の形に読み、保存値は書き換えない', async () => {
    localStorage.setItem('test/null-record', 'null')
    const { result } = renderHook(() =>
      useLocalStorage<Record<string, number>>('test/null-record', {}, { lazyWrite: true, onGet: recordOrEmpty })
    )
    await waitFor(() => expect(result.current[0]).toEqual({}))
    expect(localStorage.getItem('test/null-record')).toBe('null')
  })
})

describe('useLocalStorage lazyWrite', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('does not persist the default on mount, but persists and syncs user edits', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const onSync = vi.fn()
    window.addEventListener('ls-sync', onSync)

    const { result } = renderHook(() =>
      useLocalStorage('test/lazy', { count: 0 }, { lazyWrite: true }),
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(setItem).not.toHaveBeenCalled()

    const setter = result.current[1]
    act(() => {
      result.current[1]({ count: 1 })
    })
    await waitFor(() => {
      expect(localStorage.getItem('test/lazy')).toBe('{"count":1}')
    })
    expect(onSync).toHaveBeenCalledTimes(1)
    expect(result.current[1]).toBe(setter)

    window.removeEventListener('ls-sync', onSync)
  })

  it('does not write values synced from another instance, even via onGet', async () => {
    const onGet = (v: { count: number; migrated?: boolean }) => ({ ...v, migrated: true })
    const { result } = renderHook(() =>
      useLocalStorage<{ count: number; migrated?: boolean }>(
        'test/lazy-sync',
        { count: 0 },
        { lazyWrite: true, onGet },
      ),
    )
    await new Promise((r) => setTimeout(r, 0))

    localStorage.setItem('test/lazy-sync', '{"count":5}')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() => {
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'test/lazy-sync' } }))
    })

    await waitFor(() => expect(result.current[0]).toEqual({ count: 5, migrated: true }))
    await new Promise((r) => setTimeout(r, 0))
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem('test/lazy-sync')).toBe('{"count":5}')
  })
})

describe('countsOrEmpty / itemCountsOrEmpty', () => {
  it('所持数は有限の数でない値の品目だけを外す', () => {
    expect(countsOrEmpty({ 6516: 'abc', 6517: 3, 6518: null, 6519: Infinity })).toEqual({ 6517: 3 })
    expect(countsOrEmpty([1, 2])).toEqual({})
  })

  it('周回目標は入力欄の文字列を残し、数として読めない値の品目だけを外す', () => {
    expect(itemCountsOrEmpty({ a: '', b: '5', c: 7, d: 'abc', e: null, f: {} })).toEqual({ a: '', b: '5', c: 7 })
    expect(itemCountsOrEmpty(null)).toEqual({})
  })
})

describe('useLocalStorage repairOnGet', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it.each([
    ['null', '{}'],
    ['[1,2]', '{}'],
    ['{"6516":"abc","6517":3}', '{"6517":3}'],
  ])('壊れた保存値 %s を読むと補正値 %s を書き戻し、同期の dirty にしない通知だけを出す', async (stored, repaired) => {
    localStorage.setItem('test/repair', stored)
    const onSync = vi.fn()
    window.addEventListener('ls-sync', onSync)

    const { result } = renderHook(() =>
      useLocalStorage<Record<string, number>>('test/repair', {}, { onGet: countsOrEmpty, repairOnGet: true })
    )

    await waitFor(() => expect(result.current[0]).toEqual(JSON.parse(repaired)))
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem('test/repair')).toBe(repaired)
    expect(onSync).toHaveBeenCalledTimes(1)
    expect((onSync.mock.calls[0][0] as CustomEvent).detail).toEqual({ key: 'test/repair', derived: true })

    window.removeEventListener('ls-sync', onSync)
  })

  it('lazyWrite でも壊れた保存値は書き戻す', async () => {
    localStorage.setItem('test/repair-lazy', 'null')
    const { result } = renderHook(() =>
      useLocalStorage<Record<string, number>>('test/repair-lazy', {}, { lazyWrite: true, onGet: countsOrEmpty, repairOnGet: true })
    )
    await waitFor(() => expect(result.current[0]).toEqual({}))
    expect(localStorage.getItem('test/repair-lazy')).toBe('{}')
  })

  it('正しい保存値は書き換えず、通知も出さない', async () => {
    localStorage.setItem('test/repair-ok', '{"6517":3}')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const onSync = vi.fn()
    window.addEventListener('ls-sync', onSync)

    const { result } = renderHook(() =>
      useLocalStorage<Record<string, number>>('test/repair-ok', {}, { onGet: countsOrEmpty, repairOnGet: true })
    )

    await waitFor(() => expect(result.current[0]).toEqual({ 6517: 3 }))
    await new Promise((r) => setTimeout(r, 0))
    expect(setItem).not.toHaveBeenCalled()
    expect(onSync).not.toHaveBeenCalled()

    window.removeEventListener('ls-sync', onSync)
  })

  it('他のタブから届いた壊れた値も補正して書き戻す', async () => {
    const { result } = renderHook(() =>
      useLocalStorage<Record<string, number>>('test/repair-sync', {}, { onGet: countsOrEmpty, repairOnGet: true })
    )
    await waitFor(() => expect(localStorage.getItem('test/repair-sync')).toBe('{}'))

    localStorage.setItem('test/repair-sync', '{"1":"x","2":4}')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'test/repair-sync' }))
    })

    await waitFor(() => expect(result.current[0]).toEqual({ 2: 4 }))
    expect(localStorage.getItem('test/repair-sync')).toBe('{"2":4}')
  })
})

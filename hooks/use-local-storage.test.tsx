// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from './use-local-storage'
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

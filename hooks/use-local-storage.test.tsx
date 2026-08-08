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

  // Regression: a unit-level call to mergeChaldeaState can't reproduce the
  // actual reported bug, because the bug only manifests through
  // useLocalStorage's full loop: the persist effect writes to localStorage
  // and fires `ls-sync`, and the `ls-sync` listener (used by every consumer
  // of this hook, including other components/tabs) re-reads localStorage,
  // re-applies `onGet` (mergeChaldeaState), and calls setState again -- which
  // re-triggers the persist effect. With the old resetDisabledServantStarts
  // correction pass, this loop was destructive: it forced a disabled
  // servant's `start` down to the floor value, persisted that, and
  // broadcast it via `ls-sync` on every resync -- including to other
  // devices via cloud sync. This test exercises that full loop end-to-end.
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
      const stored = JSON.parse(localStorage.getItem('material')!) as ChaldeaState
      expect(stored['1'].disabled).toBe(true)
    })

    // Simulate the resync this persist just fired being handled (by this
    // hook instance or another component's instance of the same hook):
    // re-read localStorage, re-run onGet, and persist again.
    act(() => {
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'material' } }))
    })

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('material')!) as ChaldeaState
      expect(stored['1'].targets.ascension.ranges[0].start).toBe(3)
    })

    const finalStored = JSON.parse(localStorage.getItem('material')!) as ChaldeaState
    expect(finalStored['1'].targets.skill.ranges.every((r) => r.start === 7)).toBe(true)
    expect(finalStored['1'].targets.appendSkill.ranges.every((r) => r.start === 1)).toBe(true)
  })
})

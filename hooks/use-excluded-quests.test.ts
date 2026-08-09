// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExcludedQuests } from './use-excluded-quests'

const QUEST_IDS = ['Q1', 'Q2', 'Q3']

const readStringArray = (key: string): string[] => {
  const json = localStorage.getItem(key)
  if (json == null) return []
  const parsed = JSON.parse(json) as unknown
  return Array.isArray(parsed) ? (parsed as string[]) : []
}

const sortedStrings = (values: string[]): string[] =>
  [...values].sort((a, b) => a.localeCompare(b))

const lsSyncKey = (event: Event): string | undefined =>
  (event as CustomEvent<{ key?: string }>).detail?.key

describe('useExcludedQuests', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates a legacy quests(checked) key into excludedQuests and preserves the selection', async () => {
    localStorage.setItem('quests', JSON.stringify(['Q1', 'Q3']))

    const { result } = renderHook(() => useExcludedQuests(QUEST_IDS))

    await waitFor(() => {
      expect(sortedStrings(result.current[0])).toEqual(['Q1', 'Q3'])
    })
    await waitFor(() => {
      expect(readStringArray('excludedQuests')).toEqual(['Q2'])
    })
  })

  it('does not re-run migration or overwrite excludedQuests when it already exists', async () => {
    localStorage.setItem('excludedQuests', JSON.stringify(['Q2']))
    // A differently-shaped legacy 'quests' key should be ignored entirely.
    localStorage.setItem('quests', JSON.stringify(['Q1']))

    const { result } = renderHook(() => useExcludedQuests(QUEST_IDS))

    await waitFor(() => {
      expect(sortedStrings(result.current[0])).toEqual(['Q1', 'Q3'])
    })
    expect(readStringArray('excludedQuests')).toEqual(['Q2'])
  })

  it('updates both excludedQuests and the legacy quests key (dual write) on a checked-state change', async () => {
    const onSync = vi.fn()
    window.addEventListener('ls-sync', onSync)

    const { result } = renderHook(() => useExcludedQuests(QUEST_IDS))

    await waitFor(() => {
      expect(sortedStrings(result.current[0])).toEqual(['Q1', 'Q2', 'Q3'])
    })

    act(() => {
      result.current[1](['Q1', 'Q3'])
    })

    await waitFor(() => {
      expect(readStringArray('excludedQuests')).toEqual(['Q2'])
    })
    await waitFor(() => {
      expect(sortedStrings(readStringArray('quests'))).toEqual(['Q1', 'Q3'])
    })

    const questsSyncCalls = onSync.mock.calls.filter(
      ([event]) => lsSyncKey(event as Event) === 'quests'
    )
    expect(questsSyncCalls.length).toBeGreaterThan(0)

    window.removeEventListener('ls-sync', onSync)
  })

  // Regression for invariant (b): on first mount, excludedQuests has not yet
  // been read back from localStorage, so checkedQuests is transiently "all
  // selected". The dual-write effect's initial flush must be skipped, or a
  // partially-checked, previously saved 'quests' key would be clobbered with
  // "all quests" the instant the hook mounts, and that clobber would
  // propagate via 'ls-sync' to any other component/cloud-sync listener.
  it('does not clobber a previously saved, partially-checked quests key on first mount', async () => {
    localStorage.setItem('excludedQuests', JSON.stringify(['Q2']))
    localStorage.setItem('quests', JSON.stringify(['Q1', 'Q3']))

    const onSync = vi.fn()
    window.addEventListener('ls-sync', onSync)

    renderHook(() => useExcludedQuests(QUEST_IDS))

    // Give any effects a chance to run before asserting nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sortedStrings(readStringArray('quests'))).toEqual(['Q1', 'Q3'])
    const questsSyncCalls = onSync.mock.calls.filter(
      ([event]) => lsSyncKey(event as Event) === 'quests'
    )
    expect(questsSyncCalls).toHaveLength(0)

    window.removeEventListener('ls-sync', onSync)
  })
})

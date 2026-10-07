// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFarmingPurpose } from './use-farming-purpose'

describe('useFarmingPurpose', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it.each([
    [{ 'quests/efficiency/shortageOnly': 'false' }, 'all'],
    [{ 'efficiency/stockEnabled': 'true' }, 'reserve'],
    [{}, 'training'],
  ])('旧キー %o から %s を書き込まずに解決する', async (legacy, expected) => {
    for (const [k, v] of Object.entries(legacy)) localStorage.setItem(k, v)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() => useFarmingPurpose())
    await waitFor(() => expect(result.current.purpose).toBe(expected))
    await new Promise((r) => setTimeout(r, 0))

    expect(setItem).not.toHaveBeenCalled()
  })

  it('明示選択時だけ保存し、同一画面の他インスタンスへ伝える', async () => {
    const a = renderHook(() => useFarmingPurpose())
    const b = renderHook(() => useFarmingPurpose())
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem('efficiency/farmingPurpose')).toBeNull()

    act(() => a.result.current.setPurpose('reserve'))
    await waitFor(() => expect(b.result.current.purpose).toBe('reserve'))
    expect(localStorage.getItem('efficiency/farmingPurpose')).toBe('"reserve"')
  })
})

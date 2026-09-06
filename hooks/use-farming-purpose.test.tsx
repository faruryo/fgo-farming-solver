// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useFarmingPurpose } from './use-farming-purpose'

describe('useFarmingPurpose', () => {
  beforeEach(() => localStorage.clear())

  it('旧全部設定をallへ移行し、変更をls-syncで共有する', async () => {
    localStorage.setItem('quests/efficiency/shortageOnly', 'false')
    const { result } = renderHook(() => useFarmingPurpose())
    await waitFor(() => expect(result.current.purpose).toBe('all'))

    act(() => result.current.setPurpose('reserve'))
    await waitFor(() =>
      expect(localStorage.getItem('efficiency/farmingPurpose')).toBe(
        '"reserve"',
      ),
    )
  })
})

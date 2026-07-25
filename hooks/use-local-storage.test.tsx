// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from './use-local-storage'

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

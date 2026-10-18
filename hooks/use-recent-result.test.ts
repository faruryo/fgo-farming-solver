// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'

const mockSession = vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' })
vi.mock('next-auth/react', () => ({
  useSession: () => mockSession(),
}))

import { useRecentResult } from './use-recent-result'

const localResult = { id: 'local-1', total_ap: 100 }
const historyResult = { id: 'history-1', total_ap: 200 }

const stubFetch = () => {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/farming/history') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 'history-1' }, { id: 'history-2' }]),
      })
    }
    const id = url.split('/api/farming/results/')[1]
    const body = id === 'local-1' ? localResult : historyResult
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const calledUrls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.map(([url]) => url)

beforeEach(() => {
  localStorage.clear()
  mockSession.mockReturnValue({ data: null, status: 'unauthenticated' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useRecentResult', () => {
  it('fetches nothing and stays loading while the session is being checked', async () => {
    localStorage.setItem(STORAGE_KEYS.FARMING_RESULTS, '/farming/results/local-1')
    mockSession.mockReturnValue({ data: null, status: 'loading' })
    const fetchMock = stubFetch()

    const { result } = renderHook(() => useRecentResult())

    await new Promise((r) => setTimeout(r, 0))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.historyCount).toBe(0)
    expect(result.current.result).toBeNull()
  })

  it('reads only the stored result URL when unauthenticated, without fetching history', async () => {
    localStorage.setItem(STORAGE_KEYS.FARMING_RESULTS, '/farming/results/local-1')
    const fetchMock = stubFetch()

    const { result } = renderHook(() => useRecentResult())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calledUrls(fetchMock)).toEqual(['/api/farming/results/local-1'])
    expect(result.current.result).toEqual(localResult)
    expect(result.current.historyCount).toBe(0)
  })

  it('fetches history when authenticated', async () => {
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' })
    const fetchMock = stubFetch()

    const { result } = renderHook(() => useRecentResult())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calledUrls(fetchMock)).toEqual([
      '/api/farming/history',
      '/api/farming/results/history-1',
    ])
    expect(result.current.result).toEqual(historyResult)
    expect(result.current.historyCount).toBe(2)
  })

  it('starts fetching once the session check resolves to authenticated', async () => {
    mockSession.mockReturnValue({ data: null, status: 'loading' })
    const fetchMock = stubFetch()

    const { result, rerender } = renderHook(() => useRecentResult())
    expect(fetchMock).not.toHaveBeenCalled()

    mockSession.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' })
    rerender()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calledUrls(fetchMock)).toEqual([
      '/api/farming/history',
      '/api/farming/results/history-1',
    ])
  })

  it('drops history-derived result and count and re-reads only the stored URL after signing out', async () => {
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' })
    const fetchMock = stubFetch()

    const { result, rerender } = renderHook(() => useRecentResult())
    await waitFor(() => expect(result.current.historyCount).toBe(2))
    expect(result.current.result).toEqual(historyResult)

    // サインアウト後: 端末の結果 URL が無ければ履歴由来の結果は残らない
    fetchMock.mockClear()
    mockSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    rerender()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.result).toBeNull()
    expect(result.current.historyCount).toBe(0)
  })

  it('re-reads from the stored result URL after signing out', async () => {
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' })
    localStorage.setItem(STORAGE_KEYS.FARMING_RESULTS, '/farming/results/local-1')
    const fetchMock = stubFetch()

    const { result, rerender } = renderHook(() => useRecentResult())
    await waitFor(() => expect(result.current.historyCount).toBe(2))

    fetchMock.mockClear()
    mockSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    rerender()

    await waitFor(() => expect(result.current.historyCount).toBe(0))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calledUrls(fetchMock)).toEqual(['/api/farming/results/local-1'])
    expect(result.current.result).toEqual(localResult)
  })
})

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSelectedQuests, hasSubmittableItems, submitSolve } from './submit-solve'

vi.mock('../progress/snapshot-client', () => ({
  saveProgressSnapshot: vi.fn().mockResolvedValue(undefined),
}))

describe('hasSubmittableItems', () => {
  it('is false for an empty string', () => {
    expect(hasSubmittableItems('')).toBe(false)
  })

  it('is false for a whitespace-only string', () => {
    expect(hasSubmittableItems('   ')).toBe(false)
  })

  it('is true for a non-empty items query', () => {
    expect(hasSubmittableItems('1a:3')).toBe(true)
  })
})

describe('hasSelectedQuests', () => {
  it('is false for zero quests', () => {
    expect(hasSelectedQuests([])).toBe(false)
  })

  it('is true for one or more quests', () => {
    expect(hasSelectedQuests(['1A01'])).toBe(true)
  })
})

describe('submitSolve', () => {
  const push = vi.fn()
  const router = { push }

  beforeEach(() => {
    localStorage.clear()
    push.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('on success, writes farming/results, fires ls-sync, saves a progress snapshot, and navigates to the result page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: 'abc-123' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onSync = vi.fn()
    window.addEventListener('ls-sync', onSync)

    const params = new URLSearchParams({ items: '1a:3', fields: 'id' })
    await submitSolve(params, router)

    expect(fetchMock).toHaveBeenCalledWith('/api/solve?items=1a%3A3&fields=id')
    expect(localStorage.getItem('farming/results')).toBe('/farming/results/abc-123')
    expect(onSync).toHaveBeenCalledTimes(1)
    const event = onSync.mock.calls[0][0] as CustomEvent<{ key?: string }>
    expect(event.detail?.key).toBe('farming/results')
    expect(push).toHaveBeenCalledWith('/farming/results/abc-123')

    window.removeEventListener('ls-sync', onSync)
  })

  it('navigates to /500 when the response has no id (hasId guard fails)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: 'boom' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const params = new URLSearchParams({ items: '1a:3', fields: 'id' })
    await submitSolve(params, router)

    expect(localStorage.getItem('farming/results')).toBeNull()
    expect(push).toHaveBeenCalledWith('/500')
  })

  it('navigates to /500 when id is present but not a string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: 123 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const params = new URLSearchParams({ items: '1a:3', fields: 'id' })
    await submitSolve(params, router)

    expect(push).toHaveBeenCalledWith('/500')
  })
})

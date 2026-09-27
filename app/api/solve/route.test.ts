import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}))

vi.mock('../../../lib/fgo-drop', () => ({
  getDrops: vi.fn(),
}))

import { resolveSolveVisibility } from './route'

describe('resolveSolveVisibility', () => {
  it('returns error for anonymous users requesting private visibility (fail-closed)', () => {
    expect(resolveSolveVisibility('anonymous', 'false')).toEqual({
      ok: false,
      error: 'Unauthorized: Private results require authentication',
    })
    expect(resolveSolveVisibility('anonymous', '0')).toEqual({
      ok: false,
      error: 'Unauthorized: Private results require authentication',
    })
  })

  it('allows public results for anonymous users', () => {
    expect(resolveSolveVisibility('anonymous', 'true')).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('anonymous', null)).toEqual({ ok: true, isPublic: 1 })
  })

  it('respects private setting for logged-in users', () => {
    expect(resolveSolveVisibility('user-123', 'false')).toEqual({ ok: true, isPublic: 0 })
    expect(resolveSolveVisibility('user-123', '0')).toEqual({ ok: true, isPublic: 0 })
  })

  it('defaults to 1 (public) for logged-in users when parameter is not false/0', () => {
    expect(resolveSolveVisibility('user-123', 'true')).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('user-123', '1')).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('user-123', null)).toEqual({ ok: true, isPublic: 1 })
    expect(resolveSolveVisibility('user-123', '')).toEqual({ ok: true, isPublic: 1 })
  })
})

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
  it('always returns 1 (public) for anonymous users regardless of parameter', () => {
    expect(resolveSolveVisibility('anonymous', 'false')).toBe(1)
    expect(resolveSolveVisibility('anonymous', '0')).toBe(1)
    expect(resolveSolveVisibility('anonymous', 'true')).toBe(1)
    expect(resolveSolveVisibility('anonymous', null)).toBe(1)
  })

  it('respects private setting for logged-in users', () => {
    expect(resolveSolveVisibility('user-123', 'false')).toBe(0)
    expect(resolveSolveVisibility('user-123', '0')).toBe(0)
  })

  it('defaults to 1 (public) for logged-in users when parameter is not false/0', () => {
    expect(resolveSolveVisibility('user-123', 'true')).toBe(1)
    expect(resolveSolveVisibility('user-123', '1')).toBe(1)
    expect(resolveSolveVisibility('user-123', null)).toBe(1)
    expect(resolveSolveVisibility('user-123', '')).toBe(1)
  })
})

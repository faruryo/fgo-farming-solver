import { describe, it, expect, afterEach, vi } from 'vitest'
import { isPushSupported, isIosFamily, PushSubscribeError } from './push'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isPushSupported', () => {
  it('returns false when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined)
    expect(isPushSupported()).toBe(false)
  })

  it('returns false when serviceWorker is missing from navigator', () => {
    vi.stubGlobal('window', { PushManager: {}, Notification: {} })
    vi.stubGlobal('navigator', {})
    expect(isPushSupported()).toBe(false)
  })

  it('returns false when PushManager is missing from window', () => {
    vi.stubGlobal('window', { Notification: {} })
    vi.stubGlobal('navigator', { serviceWorker: {} })
    expect(isPushSupported()).toBe(false)
  })

  it('returns false when Notification is missing from window', () => {
    vi.stubGlobal('window', { PushManager: {} })
    vi.stubGlobal('navigator', { serviceWorker: {} })
    expect(isPushSupported()).toBe(false)
  })

  it('returns true when serviceWorker/PushManager/Notification are all present', () => {
    vi.stubGlobal('window', { PushManager: {}, Notification: {} })
    vi.stubGlobal('navigator', { serviceWorker: {} })
    expect(isPushSupported()).toBe(true)
  })
})

describe('isIosFamily', () => {
  it('returns false when navigator is undefined (SSR)', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isIosFamily()).toBe(false)
  })

  it('returns true for an iPhone user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    })
    expect(isIosFamily()).toBe(true)
  })

  it('returns true for an iPad user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
      platform: 'iPad',
      maxTouchPoints: 5,
    })
    expect(isIosFamily()).toBe(true)
  })

  it('returns true for iPadOS masquerading as MacIntel with touch support', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })
    expect(isIosFamily()).toBe(true)
  })

  it('returns false for a real desktop Mac (MacIntel without touch support)', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    })
    expect(isIosFamily()).toBe(false)
  })

  it('returns false for a desktop Windows Chrome user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      platform: 'Win32',
      maxTouchPoints: 0,
    })
    expect(isIosFamily()).toBe(false)
  })
})

describe('PushSubscribeError', () => {
  it('carries the given reason and defaults the message to the reason', () => {
    const error = new PushSubscribeError('permission-denied')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('PushSubscribeError')
    expect(error.reason).toBe('permission-denied')
    expect(error.message).toBe('permission-denied')
  })

  it('uses the given message when provided', () => {
    const error = new PushSubscribeError('server-error', 'Failed to register subscription')
    expect(error.reason).toBe('server-error')
    expect(error.message).toBe('Failed to register subscription')
  })
})

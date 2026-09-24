import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signHandoffJwt } from './crypto'
import { HANDOFF_TTL_SECONDS, NONCE_COOKIE, SESSION_COOKIE } from './policy'

const SECRET = 'handoff-secret'
const PRODUCTION_ORIGIN = 'https://fgo-farming-solver.faru.jp'

const consumeJti = vi.hoisted(() => vi.fn(async () => true))

vi.mock('./runtime', () => ({
  readRuntimeBindings: async () => ({
    env: {
      PREVIEW_AUTH_HANDOFF: '1',
      PREVIEW_HANDOFF_SECRET: 'handoff-secret',
      AUTH_SECRET: 'auth-secret',
      PREVIEW_WORKERS_DEV_SUBDOMAIN: 'faruryo',
      PREVIEW_LOGIN_ALLOWED_IDS: '12345',
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
    },
    consumeJti,
  }),
}))

import { POST } from '../../app/api/auth/preview/complete/route'

describe('POST /api/auth/preview/complete', () => {
  beforeEach(() => {
    consumeJti.mockClear()
  })

  it('returns 400 and writes no session when the request origin is not a preview host', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await signHandoffJwt(
      {
        sub: '12345',
        name: 'Master',
        email: 'master@example.com',
        nonce: 'nonce-1',
        jti: 'jti-production',
        aud: PRODUCTION_ORIGIN,
        iat: now,
        exp: now + HANDOFF_TTL_SECONDS,
        path: '/material',
      },
      SECRET,
    )
    const request = new NextRequest(
      `${PRODUCTION_ORIGIN}/api/auth/preview/complete`,
      {
        method: 'POST',
        headers: {
          origin: PRODUCTION_ORIGIN,
          cookie: `${NONCE_COOKIE}=nonce-1`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ handoff: token }),
      },
    )

    const response = await POST(request)
    const setCookies = response.headers.getSetCookie().join('\n')

    expect(response.status).toBe(400)
    expect(setCookies).not.toContain(SESSION_COOKIE)
    expect(consumeJti).not.toHaveBeenCalled()
  })
})

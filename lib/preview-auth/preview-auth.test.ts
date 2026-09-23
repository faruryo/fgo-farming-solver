import { describe, expect, it } from 'vitest'
import { decode } from 'next-auth/jwt'
import {
  decryptState,
  encryptState,
  signHandoffJwt,
  verifyHandoffJwt,
} from './crypto'
import { dispatchAuthGet } from './dispatch'
import { completeHandoff, handleHandoffCallback, type FetchLike } from './flow'
import {
  HANDOFF_TTL_SECONDS,
  PRODUCTION_REDIRECT_URI,
  isAllowedAccount,
  isAllowedReturnOrigin,
  isPreviewAuthHost,
  previewStartPlan,
  readHandoffConfig,
  shouldHandlePreviewHandoff,
  type HandoffConfig,
} from './policy'
import { encodeSessionToken } from './session'
import { beginGoogleSignIn } from './sign-in'
import { startPreviewAuth } from './start'

const SECRET = 'handoff-secret'
const AUTH_SECRET = 'auth-secret'
const SUBDOMAIN = 'faruryo'
const ORIGIN = 'https://831b41cb-fgo-farming-solver.faruryo.workers.dev'
const NOW = 1_700_000_000

const config = (allowedIds: string[] = ['12345']): HandoffConfig => ({
  secret: SECRET,
  subdomain: SUBDOMAIN,
  allowedIds: new Set(allowedIds),
  clientId: 'client-id',
  clientSecret: 'client-secret',
  authSecret: AUTH_SECRET,
})

const env = (overrides: Record<string, string | undefined> = {}) => ({
  PREVIEW_AUTH_HANDOFF: '1',
  PREVIEW_HANDOFF_SECRET: SECRET,
  AUTH_SECRET,
  PREVIEW_WORKERS_DEV_SUBDOMAIN: SUBDOMAIN,
  PREVIEW_LOGIN_ALLOWED_IDS: '12345',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  ...overrides,
})

const stateFor = (origin = ORIGIN, path = '/material') =>
  encryptState(
    { origin, path, exp: NOW + 600, nonce: 'nonce-1', verifier: 'verifier-1' },
    SECRET,
  )

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const googleFetch = (sub = '12345'): { fetch: FetchLike; calls: string[] } => {
  const calls: string[] = []
  const fetchImpl: FetchLike = (input) => {
    calls.push(input)
    if (input.includes('oauth2.googleapis.com/token')) {
      return json({
        access_token: 'ya29.SECRET-ACCESS',
        refresh_token: '1//refresh-token',
      })
    }
    return json({
      sub,
      name: 'Master',
      email: 'master@example.com',
      picture: 'https://img.example/a',
    })
  }
  return { fetch: fetchImpl, calls }
}

describe('preview auth policy', () => {
  it('passes a normal Auth.js state through and keeps a disabled branch on Auth.js', () => {
    expect(shouldHandlePreviewHandoff('random-authjs-state', env())).toBe(false)
    expect(
      shouldHandlePreviewHandoff(
        'pv1.payload',
        env({ PREVIEW_AUTH_HANDOFF: undefined }),
      ),
    ).toBe(false)
    expect(shouldHandlePreviewHandoff('pv1.payload', env())).toBe(true)
  })

  it('refuses a handoff secret that matches AUTH_SECRET or an empty account list', () => {
    expect(
      readHandoffConfig(env({ PREVIEW_HANDOFF_SECRET: AUTH_SECRET })),
    ).toBeNull()
    expect(readHandoffConfig(env({ PREVIEW_HANDOFF_SECRET: '' }))).toBeNull()
    expect(isAllowedAccount('12345', new Set())).toBe(false)
    expect(
      isAllowedAccount('master@example.com', new Set(['master@example.com'])),
    ).toBe(true)
    expect(isAllowedAccount('12345', new Set(['master@example.com']))).toBe(
      false,
    )
  })

  it('allows only this account’s fgo-farming-solver preview hosts', () => {
    expect(isAllowedReturnOrigin(ORIGIN, SUBDOMAIN)).toBe(true)
    expect(
      isAllowedReturnOrigin(
        'https://branch-alias-fgo-farming-solver.faruryo.workers.dev',
        SUBDOMAIN,
      ),
    ).toBe(true)
    const rejected = [
      'https://831b41cb-fgo-farming-solver.other.workers.dev',
      'https://831b41cb-other-worker.faruryo.workers.dev',
      'https://evil.example/?next=https://831b41cb-fgo-farming-solver.faruryo.workers.dev',
      'https://user:pass@831b41cb-fgo-farming-solver.faruryo.workers.dev',
      ['http', '://831b41cb-fgo-farming-solver.faruryo.workers.dev'].join(''),
      'https://831b41cb-fgo-farming-solver.faruryo.workers.dev:8443',
      'https://831b41cb-fgo-farming-solver.faruryo.workers.dev.evil.com',
      'https://831b41cb-fgo-farming-solver.faruryo.pages.dev',
      `${ORIGIN}/material`,
      'https://fgo-farming-solver.faruryo.workers.dev',
    ]
    for (const candidate of rejected)
      expect(isAllowedReturnOrigin(candidate, SUBDOMAIN)).toBe(false)
  })

  it('takes the return origin from the request, not callbackUrl', () => {
    const plan = previewStartPlan(
      `${ORIGIN}/api/auth/preview/start?callbackUrl=https://evil.example`,
      `${ORIGIN}/material`,
      SUBDOMAIN,
    )
    expect(plan).toEqual({ origin: ORIGIN, path: '/material' })
    const localOrigin = [
      'http',
      '://localhost:3000/api/auth/preview/start',
    ].join('')
    expect(previewStartPlan(localOrigin, null, SUBDOMAIN)).toBeNull()
  })

  it('starts preview sign-in only on a preview host', () => {
    const calls: string[] = []
    beginGoogleSignIn('831b41cb-fgo-farming-solver.faruryo.workers.dev', {
      navigate: (url) => calls.push(url),
      signInGoogle: () => calls.push('google'),
    })
    beginGoogleSignIn('fgo-farming-solver.faru.jp', {
      navigate: (url) => calls.push(url),
      signInGoogle: () => calls.push('google'),
    })
    beginGoogleSignIn('localhost', {
      navigate: (url) => calls.push(url),
      signInGoogle: () => calls.push('google'),
    })
    expect(calls).toEqual(['/api/auth/preview/start', 'google', 'google'])
    expect(
      isPreviewAuthHost('831b41cb-fgo-farming-solver.faruryo.pages.dev'),
    ).toBe(false)
  })
})

describe('preview auth callback dispatch', () => {
  const request = (state: string) =>
    new Request(
      `https://fgo-farming-solver.faru.jp/api/auth/callback/google?state=${state}&code=abc`,
    )

  it('forwards a normal state to Auth.js unchanged', async () => {
    const incoming = request('authjs-state')
    let forwarded: Request | null = null
    const response = await dispatchAuthGet(incoming, env(), {
      nextAuthGet: (value) => {
        forwarded = value
        return Promise.resolve(new Response('authjs'))
      },
      handleHandoff: () => Promise.resolve(new Response('handoff')),
    })
    expect(forwarded).toBe(incoming)
    expect(await response.text()).toBe('authjs')
  })

  it('forwards pv1 state to Auth.js when the branch is disabled', async () => {
    let forwarded = false
    await dispatchAuthGet(
      request('pv1.payload'),
      env({ PREVIEW_AUTH_HANDOFF: undefined }),
      {
        nextAuthGet: () => {
          forwarded = true
          return Promise.resolve(new Response(null, { status: 200 }))
        },
        handleHandoff: () => Promise.reject(new Error('handoff must not run')),
      },
    )
    expect(forwarded).toBe(true)
  })

  it('does not pass a pv1 state to Auth.js when the branch is enabled', async () => {
    let handed = false
    const response = await dispatchAuthGet(request('pv1.payload'), env(), {
      nextAuthGet: () => Promise.reject(new Error('authjs must not run')),
      handleHandoff: () => {
        handed = true
        return Promise.resolve(new Response('handoff', { status: 200 }))
      },
    })
    expect(handed).toBe(true)
    expect(await response.text()).toBe('handoff')
  })
})

describe('preview auth handoff', () => {
  it('rejects a state that cannot be decrypted without calling Google', async () => {
    const { fetch: fetchImpl, calls } = googleFetch()
    const response = await handleHandoffCallback({
      state: 'pv1.not-valid',
      code: 'code',
      config: config(),
      nowSec: NOW,
      fetch: fetchImpl,
      randomId: () => 'jti-1',
    })
    expect(response.status).toBe(400)
    expect(response.headers.get('Location')).toBeNull()
    expect(calls).toEqual([])
  })

  it('rejects a bad return origin before code exchange', async () => {
    const { fetch: fetchImpl, calls } = googleFetch()
    const response = await handleHandoffCallback({
      state: await stateFor('https://evil.example'),
      code: 'code',
      config: config(),
      nowSec: NOW,
      fetch: fetchImpl,
      randomId: () => 'jti-1',
    })
    expect(response.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('does not issue a jwt when the account list is empty or only has an email', async () => {
    for (const allowed of [[], ['master@example.com']]) {
      const { fetch: fetchImpl, calls } = googleFetch()
      const response = await handleHandoffCallback({
        state: await stateFor(),
        code: 'code',
        config: config(allowed),
        nowSec: NOW,
        fetch: fetchImpl,
        randomId: () => 'jti-1',
      })
      expect(response.status).toBe(403)
      expect(response.headers.get('Location')).toBeNull()
      expect(calls).toHaveLength(2)
    }
  })

  it('returns a 60 second fragment jwt without Google tokens', async () => {
    const { fetch: fetchImpl } = googleFetch()
    const response = await handleHandoffCallback({
      state: await stateFor(),
      code: 'code',
      config: config(),
      nowSec: NOW,
      fetch: fetchImpl,
      randomId: () => 'jti-1',
    })
    const location = response.headers.get('Location') ?? ''
    expect(response.status).toBe(302)
    expect(
      location.startsWith(`${ORIGIN}/auth/preview-complete#handoff=`),
    ).toBe(true)
    expect(location).not.toContain('ya29.SECRET-ACCESS')
    expect(location).not.toContain('1//refresh-token')
    const jwt = new URL(location).hash.slice('#handoff='.length)
    const claims = await verifyHandoffJwt(jwt, SECRET, NOW, ORIGIN)
    expect(claims).toMatchObject({
      sub: '12345',
      aud: ORIGIN,
      exp: NOW + HANDOFF_TTL_SECONDS,
      nonce: 'nonce-1',
      jti: 'jti-1',
      path: '/material',
      email: 'master@example.com',
    })
  })

  it('builds a Google URL whose redirect_uri is production and ignores callbackUrl', async () => {
    const started = await startPreviewAuth({
      requestUrl: `${ORIGIN}/api/auth/preview/start?callbackUrl=https://evil.example`,
      referer: `${ORIGIN}/quests`,
      config: config(),
      nowSec: NOW,
    })
    expect('location' in started).toBe(true)
    if (!('location' in started)) return
    const url = new URL(started.location)
    expect(url.searchParams.get('redirect_uri')).toBe(PRODUCTION_REDIRECT_URI)
    expect(url.searchParams.get('state')?.startsWith('pv1.')).toBe(true)
    const state = await decryptState(
      url.searchParams.get('state') ?? '',
      SECRET,
      NOW,
    )
    expect(state?.origin).toBe(ORIGIN)
    expect(state?.path).toBe('/quests')
    expect(state?.nonce).toBe(started.nonce)
  })

  it('writes no session when the audience, nonce, account, or jti check fails', async () => {
    const claims = {
      sub: '12345',
      name: 'Master',
      email: 'master@example.com',
      nonce: 'nonce-1',
      jti: 'jti-1',
      aud: ORIGIN,
      iat: NOW,
      exp: NOW + HANDOFF_TTL_SECONDS,
      path: '/material',
    }
    const token = await signHandoffJwt(claims, SECRET)
    const seen = new Set<string>()
    const consumeJti = async (jti: string) => {
      if (seen.has(jti)) return false
      seen.add(jti)
      return true
    }
    const base = {
      token,
      requestOrigin: ORIGIN,
      nonceCookie: 'nonce-1',
      config: config(),
      nowSec: NOW,
      consumeJti,
    }
    expect(await completeHandoff(base)).toMatchObject({
      sub: '12345',
      nextPath: '/material',
    })
    expect(await completeHandoff(base)).toBeNull()
    seen.clear()
    expect(await completeHandoff({ ...base, nonceCookie: 'other' })).toBeNull()
    expect(seen.size).toBe(0)
    expect(
      await completeHandoff({ ...base, requestOrigin: 'https://evil.example' }),
    ).toBeNull()
    expect(
      await completeHandoff({ ...base, nowSec: NOW + HANDOFF_TTL_SECONDS }),
    ).toBeNull()
    expect(
      await completeHandoff({ ...base, config: config(['999']) }),
    ).toBeNull()
  })

  it('keeps providerAccountId as the session subject', async () => {
    const encoded = await encodeSessionToken(
      {
        sub: '12345',
        name: 'Master',
        email: 'master@example.com',
        picture: 'https://img',
        nextPath: '/',
      },
      AUTH_SECRET,
    )
    const token = await decode({
      token: encoded,
      secret: AUTH_SECRET,
      salt: '__Secure-authjs.session-token',
    })
    expect(token?.sub).toBe('12345')
    expect(token?.email).toBe('master@example.com')
  })
})

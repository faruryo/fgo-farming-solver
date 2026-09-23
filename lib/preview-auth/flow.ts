import { asBytes, bytesToBase64Url, utf8 } from './codec'
import {
  decryptState,
  signHandoffJwt,
  verifyHandoffJwt,
  type HandoffClaims,
} from './crypto'
import {
  HANDOFF_TTL_SECONDS,
  PRODUCTION_REDIRECT_URI,
  isAllowedAccount,
  isAllowedReturnOrigin,
  safeReturnPath,
  type HandoffConfig,
} from './policy'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type GoogleProfile = {
  providerAccountId: string
  name?: string
  email?: string
  image?: string
}

export type CallbackInput = {
  state: string | null
  code: string | null
  config: HandoffConfig | null
  nowSec: number
  fetch: FetchLike
  randomId: () => string
}

const empty = (status: number): Response => new Response(null, { status })

const pkceChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', utf8(verifier))
  return bytesToBase64Url(asBytes(new Uint8Array(digest)))
}

export const buildGoogleAuthUrl = async (
  clientId: string,
  state: string,
  verifier: string,
): Promise<string> => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', PRODUCTION_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', await pkceChallenge(verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const readProfile = (value: unknown): GoogleProfile | null => {
  if (
    !isRecord(value) ||
    typeof value.sub !== 'string' ||
    value.sub.length === 0
  )
    return null
  return {
    providerAccountId: value.sub,
    name: optionalString(value.name),
    email: optionalString(value.email),
    image: optionalString(value.picture),
  }
}

const exchangeCode = async (
  code: string,
  verifier: string,
  config: HandoffConfig,
  fetchImpl: FetchLike,
): Promise<GoogleProfile | null> => {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: PRODUCTION_REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  })
  const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tokenRes.ok) return null
  const tokenJson: unknown = await tokenRes.json()
  if (!isRecord(tokenJson) || typeof tokenJson.access_token !== 'string')
    return null
  const infoRes = await fetchImpl(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    },
  )
  if (!infoRes.ok) return null
  return readProfile(await infoRes.json())
}

const handoffLocation = async (input: {
  profile: GoogleProfile
  origin: string
  path: string
  nonce: string
  config: HandoffConfig
  nowSec: number
  randomId: () => string
}): Promise<string> => {
  const claims: HandoffClaims = {
    sub: input.profile.providerAccountId,
    name: input.profile.name,
    email: input.profile.email,
    picture: input.profile.image,
    nonce: input.nonce,
    jti: input.randomId(),
    aud: input.origin,
    iat: input.nowSec,
    exp: input.nowSec + HANDOFF_TTL_SECONDS,
    path: safeReturnPath(input.path),
  }
  const jwt = await signHandoffJwt(claims, input.config.secret)
  return `${input.origin}/auth/preview-complete#handoff=${jwt}`
}

export const handleHandoffCallback = async (
  input: CallbackInput,
): Promise<Response> => {
  if (!input.config || !input.state || !input.code) return empty(400)
  if (!input.config.clientId || !input.config.clientSecret) return empty(400)
  const state = await decryptState(
    input.state,
    input.config.secret,
    input.nowSec,
  )
  if (!state || !isAllowedReturnOrigin(state.origin, input.config.subdomain))
    return empty(400)
  const profile = await exchangeCode(
    input.code,
    state.verifier,
    input.config,
    input.fetch,
  )
  if (!profile) return empty(400)
  if (!isAllowedAccount(profile.providerAccountId, input.config.allowedIds))
    return empty(403)
  const location = await handoffLocation({
    profile,
    origin: state.origin,
    path: state.path,
    nonce: state.nonce,
    config: input.config,
    nowSec: input.nowSec,
    randomId: input.randomId,
  })
  return new Response(null, { status: 302, headers: { Location: location } })
}

export type CompleteResult = {
  sub: string
  name?: string
  email?: string
  picture?: string
  nextPath: string
}

export const completeHandoff = async (input: {
  token: string
  requestOrigin: string
  nonceCookie: string | null
  config: HandoffConfig
  nowSec: number
  consumeJti: (jti: string) => Promise<boolean>
}): Promise<CompleteResult | null> => {
  const claims = await verifyHandoffJwt(
    input.token,
    input.config.secret,
    input.nowSec,
    input.requestOrigin,
  )
  if (!claims || !input.nonceCookie || input.nonceCookie !== claims.nonce)
    return null
  if (!isAllowedAccount(claims.sub, input.config.allowedIds)) return null
  if (!(await input.consumeJti(claims.jti))) return null
  return {
    sub: claims.sub,
    name: claims.name,
    email: claims.email,
    picture: claims.picture,
    nextPath: safeReturnPath(claims.path),
  }
}

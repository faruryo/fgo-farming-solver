import { asBytes, base64UrlToBytes, bytesToBase64Url, utf8 } from './codec'
import { HANDOFF_PREFIX } from './policy'

export type HandoffState = {
  origin: string
  path: string
  exp: number
  nonce: string
  verifier: string
}

export type HandoffClaims = {
  sub: string
  name?: string
  email?: string
  picture?: string
  nonce: string
  jti: string
  aud: string
  exp: number
  iat: number
  path: string
}

const aesKey = async (secret: string): Promise<CryptoKey> => {
  const digest = await crypto.subtle.digest('SHA-256', utf8(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

const hmacKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )

const isState = (
  value: Partial<HandoffState>,
  nowSec: number,
): value is HandoffState =>
  typeof value.origin === 'string' &&
  typeof value.nonce === 'string' &&
  typeof value.verifier === 'string' &&
  typeof value.exp === 'number' &&
  value.exp > nowSec

export const encryptState = async (
  state: HandoffState,
  secret: string,
): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await aesKey(secret),
      utf8(JSON.stringify(state)),
    ),
  )
  const packed = new Uint8Array(iv.length + cipher.length)
  packed.set(asBytes(iv), 0)
  packed.set(asBytes(cipher), iv.length)
  return `${HANDOFF_PREFIX}${bytesToBase64Url(asBytes(packed))}`
}

export const decryptState = async (
  token: string,
  secret: string,
  nowSec: number,
): Promise<HandoffState | null> => {
  if (!token.startsWith(HANDOFF_PREFIX)) return null
  try {
    const packed = base64UrlToBytes(token.slice(HANDOFF_PREFIX.length))
    if (packed.length < 12 + 16) return null
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBytes(packed.slice(0, 12)) },
      await aesKey(secret),
      asBytes(packed.slice(12)),
    )
    const parsed = JSON.parse(
      new TextDecoder().decode(plain),
    ) as Partial<HandoffState>
    if (!isState(parsed, nowSec)) return null
    return {
      ...parsed,
      path: typeof parsed.path === 'string' ? parsed.path : '/',
    }
  } catch {
    return null
  }
}

const isClaims = (
  value: Partial<HandoffClaims>,
  nowSec: number,
  audience: string,
): boolean =>
  value.aud === audience &&
  typeof value.exp === 'number' &&
  value.exp > nowSec &&
  typeof value.sub === 'string' &&
  value.sub.length > 0 &&
  typeof value.nonce === 'string' &&
  typeof value.jti === 'string'

export const signHandoffJwt = async (
  claims: HandoffClaims,
  secret: string,
): Promise<string> => {
  const header = bytesToBase64Url(
    utf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  )
  const payload = bytesToBase64Url(utf8(JSON.stringify(claims)))
  const data = `${header}.${payload}`
  const signature = asBytes(
    new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), utf8(data))),
  )
  return `${data}.${bytesToBase64Url(signature)}`
}

export const verifyHandoffJwt = async (
  token: string,
  secret: string,
  nowSec: number,
  audience: string,
): Promise<HandoffClaims | null> => {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null
  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64UrlToBytes(parts[2]),
      utf8(`${parts[0]}.${parts[1]}`),
    )
    if (!ok) return null
    const claims = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(parts[1])),
    ) as Partial<HandoffClaims>
    if (!isClaims(claims, nowSec, audience)) return null
    return {
      ...claims,
      path: typeof claims.path === 'string' ? claims.path : '/',
    } as HandoffClaims
  } catch {
    return null
  }
}

export const HANDOFF_PREFIX = 'pv1.'
export const PRODUCTION_REDIRECT_URI =
  'https://fgo-farming-solver.faru.jp/api/auth/callback/google'
export const WORKER_NAME = 'fgo-farming-solver'
export const STATE_TTL_SECONDS = 10 * 60
export const HANDOFF_TTL_SECONDS = 60
export const JTI_TTL_SECONDS = 120
export const NONCE_COOKIE = '__Host-preview-auth-nonce'
export const SESSION_COOKIE = '__Secure-authjs.session-token'
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const JTI_KEY_PREFIX = 'preview-auth-jti:'

const isLabelChar = (char: string): boolean => {
  const code = char.charCodeAt(0)
  return (
    (code >= 48 && code <= 57) || (code >= 97 && code <= 122) || char === '-'
  )
}

export type EnvSource = Record<string, string | undefined>

export type HandoffConfig = {
  secret: string
  subdomain: string
  allowedIds: ReadonlySet<string>
  clientId: string
  clientSecret: string
  authSecret: string
}

export const isDnsLabel = (value: string, max = 63): boolean => {
  if (value.length < 1 || value.length > max) return false
  if (value.startsWith('-') || value.endsWith('-')) return false
  for (const char of value) if (!isLabelChar(char)) return false
  return true
}

export const parseAllowlist = (
  raw: string | undefined,
): ReadonlySet<string> => {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
}

export const isAllowedAccount = (
  providerAccountId: string,
  allowedIds: ReadonlySet<string>,
): boolean => {
  if (!providerAccountId || allowedIds.size === 0) return false
  return allowedIds.has(providerAccountId)
}

const authSecretOf = (env: EnvSource): string =>
  env.AUTH_SECRET || env.NEXTAUTH_SECRET || ''

export const readHandoffConfig = (env: EnvSource): HandoffConfig | null => {
  if (env.PREVIEW_AUTH_HANDOFF !== '1') return null
  const secret = env.PREVIEW_HANDOFF_SECRET ?? ''
  const authSecret = authSecretOf(env)
  const subdomain = (env.PREVIEW_WORKERS_DEV_SUBDOMAIN ?? '').toLowerCase()
  if (
    !secret ||
    !authSecret ||
    secret === authSecret ||
    !isDnsLabel(subdomain)
  ) {
    return null
  }
  return {
    secret,
    subdomain,
    allowedIds: parseAllowlist(env.PREVIEW_LOGIN_ALLOWED_IDS),
    clientId: env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    authSecret,
  }
}

export const isHandoffBranchEnabled = (env: EnvSource): boolean =>
  env.PREVIEW_AUTH_HANDOFF === '1'

export const shouldHandlePreviewHandoff = (
  state: string | null,
  env: EnvSource,
): boolean => isHandoffBranchEnabled(env) && !!state?.startsWith(HANDOFF_PREFIX)

const prefixOfWorkerLabel = (label: string): string | null => {
  const marker = `-${WORKER_NAME}`
  if (!label.endsWith(marker) || label.length > 63) return null
  const prefix = label.slice(0, -marker.length)
  return isDnsLabel(prefix, 43) ? prefix : null
}

export const isPreviewAuthHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/u, '')
  const parts = host.split('.')
  if (parts.length !== 4 || parts[2] !== 'workers' || parts[3] !== 'dev')
    return false
  if (!isDnsLabel(parts[1] ?? '')) return false
  return prefixOfWorkerLabel(parts[0] ?? '') !== null
}

export const isAllowedReturnOrigin = (
  raw: string,
  subdomain: string,
): boolean => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    return false
  if (url.search || url.hash || (url.pathname !== '/' && url.pathname !== ''))
    return false
  if (url.hostname !== url.host) return false
  const parts = url.hostname.split('.')
  if (parts.length !== 4 || parts[1] !== subdomain.toLowerCase()) return false
  if (parts[2] !== 'workers' || parts[3] !== 'dev') return false
  return (
    prefixOfWorkerLabel(parts[0] ?? '') !== null &&
    url.origin === `https://${url.hostname}`
  )
}

export const safeReturnPath = (path: string | null | undefined): string => {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/'
  if (/[\\?#]|:\/\/|\0/u.test(path)) return '/'
  return path
}

export const returnPathFromReferer = (
  referer: string | null,
  origin: string,
): string => {
  if (!referer) return '/'
  try {
    const url = new URL(referer)
    if (url.origin !== origin) return '/'
    return safeReturnPath(url.pathname)
  } catch {
    return '/'
  }
}

export const previewStartPlan = (
  requestUrl: string,
  referer: string | null,
  subdomain: string,
): { origin: string; path: string } | null => {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (!isAllowedReturnOrigin(url.origin, subdomain)) return null
  return {
    origin: url.origin,
    path: returnPathFromReferer(referer, url.origin),
  }
}

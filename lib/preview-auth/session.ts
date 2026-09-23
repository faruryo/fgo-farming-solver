import { encode } from 'next-auth/jwt'
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './policy'
import type { CompleteResult } from './flow'

export const encodeSessionToken = (
  result: CompleteResult,
  authSecret: string,
): Promise<string> =>
  encode({
    token: {
      sub: result.sub,
      name: result.name,
      email: result.email,
      picture: result.picture,
    },
    secret: authSecret,
    salt: SESSION_COOKIE,
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

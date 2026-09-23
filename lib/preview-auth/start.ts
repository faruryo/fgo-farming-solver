import { randomToken } from './codec'
import { encryptState } from './crypto'
import { buildGoogleAuthUrl } from './flow'
import {
  STATE_TTL_SECONDS,
  previewStartPlan,
  type HandoffConfig,
} from './policy'

export const startPreviewAuth = async (input: {
  requestUrl: string
  referer: string | null
  config: HandoffConfig | null
  nowSec: number
}): Promise<{ location: string; nonce: string } | { error: 400 | 404 }> => {
  if (!input.config) return { error: 404 }
  if (!input.config.clientId) return { error: 400 }
  const plan = previewStartPlan(
    input.requestUrl,
    input.referer,
    input.config.subdomain,
  )
  if (!plan) return { error: 400 }
  const nonce = randomToken(16)
  const verifier = randomToken(32)
  const state = await encryptState(
    {
      origin: plan.origin,
      path: plan.path,
      exp: input.nowSec + STATE_TTL_SECONDS,
      nonce,
      verifier,
    },
    input.config.secret,
  )
  return {
    location: await buildGoogleAuthUrl(input.config.clientId, state, verifier),
    nonce,
  }
}

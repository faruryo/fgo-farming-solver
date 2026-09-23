export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { handlers } from '../../../../lib/auth'
import { dispatchAuthGet } from '../../../../lib/preview-auth/dispatch'
import { handleHandoffCallback } from '../../../../lib/preview-auth/flow'
import { readHandoffConfig } from '../../../../lib/preview-auth/policy'
import { randomToken } from '../../../../lib/preview-auth/codec'
import { readRuntimeBindings } from '../../../../lib/preview-auth/runtime'

const handoffFromRequest = (
  request: Request,
  env: Record<string, string | undefined>,
): Promise<Response> => {
  const url = new URL(request.url)
  return handleHandoffCallback({
    state: url.searchParams.get('state'),
    code: url.searchParams.get('code'),
    config: readHandoffConfig(env),
    nowSec: Math.floor(Date.now() / 1000),
    fetch,
    randomId: () => randomToken(16),
  })
}

export async function GET(request: NextRequest) {
  const { env } = await readRuntimeBindings()
  return dispatchAuthGet(request, env, {
    nextAuthGet: (incoming) => handlers.GET(incoming as NextRequest),
    handleHandoff: (incoming) => handoffFromRequest(incoming, env),
  })
}

export const POST = handlers.POST

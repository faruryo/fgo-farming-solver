export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  NONCE_COOKIE,
  STATE_TTL_SECONDS,
  readHandoffConfig,
} from '../../../../../lib/preview-auth/policy'
import { readRuntimeBindings } from '../../../../../lib/preview-auth/runtime'
import { startPreviewAuth } from '../../../../../lib/preview-auth/start'

export async function GET(request: NextRequest) {
  const { env } = await readRuntimeBindings()
  const started = await startPreviewAuth({
    requestUrl: request.url,
    referer: request.headers.get('referer'),
    config: readHandoffConfig(env),
    nowSec: Math.floor(Date.now() / 1000),
  })
  if ('error' in started)
    return new NextResponse(null, { status: started.error })
  const response = NextResponse.redirect(started.location, 302)
  response.cookies.set(NONCE_COOKIE, started.nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  })
  return response
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { completeHandoff } from '../../../../../lib/preview-auth/flow'
import {
  NONCE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  readHandoffConfig,
} from '../../../../../lib/preview-auth/policy'
import { readRuntimeBindings } from '../../../../../lib/preview-auth/runtime'
import { encodeSessionToken } from '../../../../../lib/preview-auth/session'

const MAX_HANDOFF_LENGTH = 8192

const readHandoff = async (request: NextRequest): Promise<string | null> => {
  const body = (await request.json().catch(() => null)) as {
    handoff?: unknown
  } | null
  if (
    !body ||
    typeof body.handoff !== 'string' ||
    body.handoff.length > MAX_HANDOFF_LENGTH
  )
    return null
  return body.handoff
}

export async function POST(request: NextRequest) {
  const requestOrigin = new URL(request.url).origin
  const originHeader = request.headers.get('origin')
  if (originHeader && originHeader !== requestOrigin)
    return new NextResponse(null, { status: 403 })
  const { env, consumeJti } = await readRuntimeBindings()
  const config = readHandoffConfig(env)
  const handoff = await readHandoff(request)
  if (!config || !handoff) return new NextResponse(null, { status: 400 })
  const result = await completeHandoff({
    token: handoff,
    requestOrigin,
    nonceCookie: request.cookies.get(NONCE_COOKIE)?.value ?? null,
    config,
    nowSec: Math.floor(Date.now() / 1000),
    consumeJti,
  })
  if (!result) return new NextResponse(null, { status: 400 })
  const response = NextResponse.json({ next: result.nextPath })
  response.cookies.set(
    SESSION_COOKIE,
    await encodeSessionToken(result, config.authSecret),
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  )
  response.cookies.set(NONCE_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}

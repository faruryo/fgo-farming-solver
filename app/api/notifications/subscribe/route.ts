import { auth } from '../../../../lib/auth'
import {
  upsertPushSubscription,
  deletePushSubscriptionByEndpoint,
} from '../../../../lib/db/push-subscriptions'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest } from 'next/server'
import type { CloudflareEnv } from '../../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

interface PushSubscriptionBody {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

const isValidSubscriptionBody = (body: unknown): body is PushSubscriptionBody => {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  if (typeof b.endpoint !== 'string' || b.endpoint.length === 0) return false
  if (typeof b.keys !== 'object' || b.keys === null) return false
  const keys = b.keys as Record<string, unknown>
  return typeof keys.p256dh === 'string' && typeof keys.auth === 'string'
}

// Public VAPID key, exposed for client-side PushManager.subscribe() calls. Not sensitive.
export async function GET() {
  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const publicKey =
    env?.VAPID_PUBLIC_KEY || (process.env as unknown as CloudflareEnv).VAPID_PUBLIC_KEY

  return Response.json({ publicKey })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    console.log('[api/notifications/subscribe POST] unauthorized')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await req.json().catch(() => null)
  if (!isValidSubscriptionBody(body)) {
    return Response.json({ error: 'Invalid subscription payload' }, { status: 400 })
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB

  await upsertPushSubscription(db, {
    id: crypto.randomUUID(),
    userId: session.user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  })

  return new Response(null, { status: 204 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    console.log('[api/notifications/subscribe DELETE] unauthorized')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await req.json().catch(() => null)
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).endpoint !== 'string'
  ) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { endpoint } = body as { endpoint: string }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB

  await deletePushSubscriptionByEndpoint(db, session.user.id, endpoint)

  return new Response(null, { status: 204 })
}

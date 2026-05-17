import { auth } from '../../../lib/auth'
import { saveSnapshot } from '../../../lib/progress/snapshot'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest } from 'next/server'
import type { CloudflareEnv } from '../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    console.log('[api/cloud GET] unauthorized')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = `cloud:${session.user.id}`
  console.log('[api/cloud GET] userId:', session.user.id, 'key:', key)

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const data = await env.CLOUD_SAVE.get(key)
  console.log('[api/cloud GET] data from KV:', data == null ? 'null' : `${data.length} chars`)

  if (data == null) {
    return Response.json({})
  }
  const parsed = JSON.parse(data) as Record<string, unknown>
  console.log('[api/cloud GET] keys returned:', Object.keys(parsed))
  return Response.json(parsed)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    console.log('[api/cloud POST] unauthorized')
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = `cloud:${session.user.id}`
  const body = await req.text()
  console.log('[api/cloud POST] userId:', session.user.id, 'key:', key, 'body length:', body.length)

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  await Promise.all([
    env.CLOUD_SAVE.put(key, body),
    env.DB
      ? saveSnapshot(env.DB, session.user.id, body).catch((e) =>
          console.error('[api/cloud POST] snapshot save failed:', e)
        )
      : Promise.resolve(),
  ])
  console.log('[api/cloud POST] put complete')

  return new Response(null, { status: 204 })
}

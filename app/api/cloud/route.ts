import { auth } from '../../../lib/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest } from 'next/server'
import type { CloudflareEnv } from '../../../types/cloudflare-env'


export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const data = await env.CLOUD_SAVE.get(`cloud:${session.user.id}`)
  if (data == null) {
    return Response.json({})
  }
  return Response.json(JSON.parse(data))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.text()
  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  await env.CLOUD_SAVE.put(`cloud:${session.user.id}`, body)
  return new Response(null, { status: 204 })
}


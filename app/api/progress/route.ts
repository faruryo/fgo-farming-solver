import { NextRequest } from 'next/server'
import { auth } from '../../../lib/auth'
import { getDrops } from '../../../lib/get-drops'
import { getNiceServants } from '../../../lib/get-nice-servants'
import { buildProgressResponse } from '../../../lib/progress/summary'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../../../types/cloudflare-env'
import type { ChaldeaState } from '../../../hooks/create-chaldea-state'

export const dynamic = 'force-dynamic'

type ProgressRequestBody = {
  current?: {
    chaldea?: ChaldeaState | null
    itemCounts?: Record<string, string | number> | null
    checkedQuests?: string[] | null
    totalAp?: number | null
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    // In development, serve rotating mock scenarios so the modal works without login.
    // Dynamic import keeps dev-mock.ts out of the production bundle entirely.
    if (process.env.NODE_ENV === 'development') {
      const { getDevMockResponse } = await import('./dev-mock')
      const mock = await getDevMockResponse()
      if (mock) return Response.json(mock)
    }
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  if (!env.DB) {
    return Response.json({ error: 'D1 unavailable' }, { status: 503 })
  }

  let body: ProgressRequestBody = {}
  try {
    body = (await req.json()) as ProgressRequestBody
  } catch {
    // empty body is fine
  }

  const [drops, servants] = await Promise.all([
    getDrops(),
    getNiceServants().catch(() => []),
  ])

  const response = await buildProgressResponse({
    db: env.DB,
    userId: session.user.id,
    current: {
      chaldea: body.current?.chaldea ?? null,
      itemCounts: body.current?.itemCounts ?? null,
      checkedQuests: body.current?.checkedQuests ?? null,
      totalAp: body.current?.totalAp ?? null,
    },
    quests: drops.quests,
    servants: servants.map((s) => ({ id: s.id, name: s.name, rarity: s.rarity })),
  })

  return Response.json(response)
}

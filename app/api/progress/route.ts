import { NextRequest } from 'next/server'
import { auth } from '../../../lib/auth'
import { getDrops } from '../../../lib/get-drops'
import { getServantsList } from '../../../lib/get-nice-servants'
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
  const start = performance.now()

  const authStart = performance.now()
  const session = await auth()
  const authDur = performance.now() - authStart

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

  const cfContextStart = performance.now()
  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB
  const cfContextDur = performance.now() - cfContextStart
  if (!db) {
    return Response.json({ error: 'D1 unavailable' }, { status: 503 })
  }

  let body: ProgressRequestBody = {}
  try {
    body = (await req.json()) as ProgressRequestBody
  } catch {
    // empty body is fine
  }

  const fetchStart = performance.now()
  const [drops, servants] = await Promise.all([
    getDrops(),
    getServantsList().catch(() => []),
  ])
  const fetchDur = performance.now() - fetchStart

  const buildStart = performance.now()
  const response = await buildProgressResponse({
    db,
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
  const buildDur = performance.now() - buildStart

  const totalDur = performance.now() - start

  // Construct standard Server-Timing header
  const serverTiming = [
    `auth;dur=${authDur.toFixed(1)};desc="NextAuth Session"`,
    `cfContext;dur=${cfContextDur.toFixed(1)};desc="CF Context Bind"`,
    `kvFetch;dur=${fetchDur.toFixed(1)};desc="KV Drops/Servants"`,
    `d1Query;dur=${parseFloat(response._timings?.d1Query || '0').toFixed(1)};desc="D1 SQL Query"`,
    `apLoad;dur=${parseFloat(response._timings?.apTableLoad || '0').toFixed(1)};desc="AP Table Load"`,
    `build;dur=${buildDur.toFixed(1)};desc="Progress Build"`,
    `total;dur=${totalDur.toFixed(1)};desc="API Total Execution"`
  ].join(', ')

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Server-Timing': serverTiming,
    },
  })
}

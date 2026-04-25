import { auth } from '../../../../lib/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }

  if (!env.DB) {
    return Response.json({ error: 'Database not available' }, { status: 500 })
  }

  try {
    const results = await env.DB.prepare(
      'SELECT id, objective, target_items, total_ap, total_lap, created_at FROM farming_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    )
      .bind(session.user.id)
      .all()

    return Response.json(results.results)
  } catch (e) {
    console.error('Failed to fetch history:', e)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

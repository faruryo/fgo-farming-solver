import { auth } from '../../../../lib/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.NODE_ENV === 'development') {
    const path = await import(/* webpackIgnore: true */ 'path')
    const { readJson } = await import('../../../../lib/read-json')
    const data = await readJson(path.default.resolve('mocks', 'history.json'))
    return Response.json(data)
  }

  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB

  if (!db) {
    return Response.json({ error: 'Database not available' }, { status: 500 })
  }

  try {
    const results = await db.prepare(
      // stock_included は result_data(常に BothResult)の params から抽出。マイグレーション不要。
      // 旧データ(stockIncluded 無し)は NULL=falsy として扱われる。
      "SELECT id, objective, target_items, total_ap, total_lap, quest_selection, created_at, json_extract(result_data, '$.ap.params.stockIncluded') AS stock_included FROM farming_results WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"
    )
      .bind(session.user.id)
      .all()

    return Response.json(results.results)
  } catch (e) {
    console.error('Failed to fetch history:', e)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

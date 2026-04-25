import { fetchAndTransformData } from '../lib/master-data/update'

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'

export default {
  // Cron Trigger から呼び出されるハンドラ
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Running scheduled data update...')
    ctx.waitUntil(updateMasterData(env))
  },

  // 手動で HTTP リクエストを送っても更新できるようにしておく
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (new URL(request.url).pathname === '/update') {
      await updateMasterData(env)
      return new Response('Updated successfully')
    }
    return new Response('Not Found', { status: 404 })
  }
}

async function updateMasterData(env: Env) {
  try {
    const data = await fetchAndTransformData()
    await env.MASTER_DATA.put(MASTER_DATA_KEY, JSON.stringify(data))
    console.log('Successfully updated MASTER_DATA KV')
  } catch (e) {
    console.error('Failed to update MASTER_DATA KV:', e)
  }
}

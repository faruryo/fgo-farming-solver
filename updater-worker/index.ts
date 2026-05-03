import { fetchAndTransformData, fetchDashboardMeta } from '../lib/master-data/update'

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'

const worker = {
  // Cron Trigger から呼び出されるハンドラ
  async scheduled(_: unknown, env: Env) {
    console.log('Running scheduled data update...')
    await updateMasterData(env)
  },

  // 手動で HTTP リクエストを送っても更新できるようにしておく
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === '/update') {
      await updateMasterData(env)
      return new Response('Updated successfully')
    }
    return new Response('Not Found', { status: 404 })
  }
}

export default worker

async function updateMasterData(env: Env) {
  try {
    console.log('Fetching and transforming master data (drops)...')
    const dropsData = await fetchAndTransformData()
    await env.MASTER_DATA.put(MASTER_DATA_KEY, JSON.stringify(dropsData))
    console.log('Successfully updated MASTER_DATA KV')

    console.log('Fetching dashboard metadata...')
    const dashboardMeta = await fetchDashboardMeta()
    await env.MASTER_DATA.put(DASHBOARD_META_KEY, JSON.stringify(dashboardMeta))
    console.log('Successfully updated DASHBOARD_META KV')
    
    console.log('All KV data updated successfully')
  } catch (e) {
    console.error('Failed to update KV data:', e)
  }
}

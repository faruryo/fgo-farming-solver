import { fetchAndTransformData, fetchDashboardMeta } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { validateDashboardMeta, validateMasterData } from '../lib/master-data/validation'

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'

const worker = {
  async scheduled(_event: unknown, env: Env) {
    console.log('Running scheduled data update...')
    const dropsData = await updateDrops(env)
    await updateDashboardMeta(env, dropsData)
  }
}

export default worker

async function updateDrops(env: Env): Promise<MasterData | null> {
  try {
    console.log('Fetching and transforming master data (drops)...')
    const dropsData = await fetchAndTransformData()
    const v = validateMasterData(dropsData)
    if (!v.ok) {
      console.warn(`Refusing to overwrite MASTER_DATA KV with degraded payload: ${v.reason}`)
      return dropsData
    }
    await env.MASTER_DATA.put(MASTER_DATA_KEY, JSON.stringify(dropsData))
    console.log('Successfully updated MASTER_DATA KV')
    return dropsData
  } catch (e) {
    console.error('Failed to update drops KV data:', e)
    return null
  }
}

async function updateDashboardMeta(env: Env, dropsData: MasterData | null) {
  try {
    console.log('Fetching dashboard metadata...')
    const dashboardMeta = await fetchDashboardMeta(dropsData?.quests)
    const v = validateDashboardMeta(dashboardMeta)
    if (!v.ok) {
      console.warn(`Refusing to overwrite DASHBOARD_META KV with degraded payload: ${v.reason}`)
      return
    }
    await env.MASTER_DATA.put(DASHBOARD_META_KEY, JSON.stringify(dashboardMeta))
    console.log('Successfully updated DASHBOARD_META KV')
  } catch (e) {
    console.error('Failed to update dashboard meta KV data:', e)
  }
}

import { fetchAndTransformData, fetchDashboardMeta } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { validateDashboardMeta, validateMasterData } from '../lib/master-data/validation'

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'
const RARITY_AP_TABLES_KEY = 'rarity_ap_tables'
const SERVANTS_LIST_KEY = 'servants_list'

const worker = {
  async scheduled(_event: unknown, env: Env) {
    console.log('Running scheduled data update...')
    const dropsData = await updateDrops(env)
    await Promise.all([
      updateDashboardMeta(env, dropsData),
      updateRarityApTables(env, dropsData),
      updateServantsList(env),
    ])
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

async function updateRarityApTables(env: Env, dropsData: MasterData | null) {
  try {
    console.log('Precomputing and updating rarity AP tables KV data...')
    const { buildRarityApTables } = await import('../lib/progress/rarity-ap-table')
    const rarityApTables = await buildRarityApTables(dropsData || undefined)
    await env.MASTER_DATA.put(RARITY_AP_TABLES_KEY, JSON.stringify(rarityApTables))
    console.log('Successfully updated RARITY_AP_TABLES KV')
  } catch (e) {
    console.error('Failed to update rarity AP tables KV data:', e)
  }
}

async function updateServantsList(env: Env) {
  try {
    console.log('Fetching basic servant list from Atlas Academy...')
    const { origin, region } = await import('../constants/atlasacademy')
    const res = await fetch(`${origin}/export/${region}/basic_servant.json`)
    const allServants = (await res.json()) as Array<{
      id: number
      name: string
      rarity: number
      type: string
      collectionNo: number
    }>
    const filtered = allServants
      .filter((s) => (s.type === 'normal' || s.type === 'heroine') && s.collectionNo > 0)
      .map((s) => ({ id: s.id, name: s.name, rarity: s.rarity }))
    await env.MASTER_DATA.put(SERVANTS_LIST_KEY, JSON.stringify(filtered))
    console.log('Successfully updated SERVANTS_LIST KV')
  } catch (e) {
    console.error('Failed to update servants list KV data:', e)
  }
}

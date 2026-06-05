import { buildRarityApTables } from '../lib/progress/rarity-ap-table'
import type { MasterData } from '../lib/master-data/types'

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'
const RARITY_AP_TABLES_KEY = 'rarity_ap_tables'

const worker = {
  async scheduled(_event: unknown, env: Env) {
    console.log('Running scheduled rarity AP tables update...')
    try {
      // drops は本体 updater (fgo-data-updater) が書く all_drops_json を直接読む。
      // lib の getDrops() は plain worker から KV を解決できずモック(古い)に
      // フォールバックしてしまうため、ここで env.MASTER_DATA から明示的に渡す。
      const raw = await env.MASTER_DATA.get(MASTER_DATA_KEY)
      if (!raw) {
        console.warn('all_drops_json not found in KV; skipping rarity AP tables update')
        return
      }
      const drops = JSON.parse(raw) as MasterData

      // buildRarityApTables は内部で軽量なサンプリング(servants_list / バンドル mock)と
      // サンプル対象だけの per-servant 素材取得を行う(60MB の一括 parse は無し)。
      const rarityApTables = await buildRarityApTables(drops)
      await env.MASTER_DATA.put(RARITY_AP_TABLES_KEY, JSON.stringify(rarityApTables))
      console.log('Successfully updated RARITY_AP_TABLES KV')
    } catch (e) {
      console.error('Failed to update rarity AP tables KV data:', e)
    }
  },
}

export default worker

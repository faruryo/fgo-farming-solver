import {
  buildRarityApTables,
  computeRaritySourceFingerprint,
} from '../lib/progress/rarity-ap-table'
import type { MasterData } from '../lib/master-data/types'

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'
const RARITY_AP_TABLES_KEY = 'rarity_ap_tables'
// 前回計算時の入力指紋。drops が実質不変なら重い再計算をスキップするためのゲート。
const RARITY_FP_KEY = 'rarity_ap_tables_fp'

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

      // all_drops_json は waveCount のインクリメンタル埋め等で毎時書き換わるが、
      // rarity AP に効く quests(ap)/drop_rates が不変なら結果も不変。指紋が一致し
      // 既存テーブルがあれば最大 50 回の LP ソルブをスキップし、exceededCpu を避ける。
      // drops が実際に変わったとき(イベント/AP キャンペーン更新)のみ再計算する。
      const fingerprint = computeRaritySourceFingerprint(drops)
      const [prevFp, existing] = await Promise.all([
        env.MASTER_DATA.get(RARITY_FP_KEY),
        env.MASTER_DATA.get(RARITY_AP_TABLES_KEY),
      ])
      if (prevFp === fingerprint && existing) {
        console.log('rarity source unchanged; skipping recompute')
        return
      }

      // buildRarityApTables は内部で軽量なサンプリング(servants_list / バンドル mock)と
      // サンプル対象だけの per-servant 素材取得を行う(60MB の一括 parse は無し)。
      const rarityApTables = await buildRarityApTables(drops)
      await env.MASTER_DATA.put(RARITY_AP_TABLES_KEY, JSON.stringify(rarityApTables))
      // 指紋は計算成功後に更新する。失敗時は据え置きで次回 cron が再試行する。
      await env.MASTER_DATA.put(RARITY_FP_KEY, fingerprint)
      console.log('Successfully updated RARITY_AP_TABLES KV')
    } catch (e) {
      console.error('Failed to update rarity AP tables KV data:', e)
    }
  },
}

export default worker

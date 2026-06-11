/**
 * rarity AP テーブル更新ジョブ(CI 版)。旧 fgo-rarity-updater worker の
 * scheduled() と同じ処理を GitHub Actions 上で実行する
 * (.github/workflows/update-rarity-tables.yml)。移管理由は run-updater.ts と同じ
 * (無料プランの確率的 CPU kill の回避)。
 *
 * ローカル検証: DRY_RUN=1 + /tmp/adj2.json(all_drops_json)。
 */
import { buildRarityApTables, computeRaritySourceFingerprint } from '../lib/progress/rarity-ap-table'
import type { MasterData } from '../lib/master-data/types'
import { kvGet, kvPut, dryRunLocalFiles } from './kv-rest'

const MASTER_DATA_KEY = 'all_drops_json'
const RARITY_AP_TABLES_KEY = 'rarity_ap_tables'
// 前回計算時の入力指紋。drops が実質不変なら重い再計算をスキップするためのゲート。
const RARITY_FP_KEY = 'rarity_ap_tables_fp'

dryRunLocalFiles[MASTER_DATA_KEY] = '/tmp/adj2.json'

async function main() {
  console.log('Running rarity AP tables update (CI)...')
  const raw = await kvGet(MASTER_DATA_KEY)
  if (!raw) {
    console.warn('all_drops_json not found in KV; skipping rarity AP tables update')
    return
  }
  const drops = JSON.parse(raw) as MasterData

  // all_drops_json は waveCount のインクリメンタル埋め等で頻繁に書き換わるが、
  // rarity AP に効く quests(ap)/drop_rates が不変なら結果も不変。指紋が一致し
  // 既存テーブルがあれば最大 50 回の LP ソルブをスキップする。
  const fingerprint = computeRaritySourceFingerprint(drops)
  const [prevFp, existing] = await Promise.all([
    kvGet(RARITY_FP_KEY),
    kvGet(RARITY_AP_TABLES_KEY),
  ])
  if (prevFp === fingerprint && existing) {
    console.log('rarity source unchanged; skipping recompute')
    return
  }

  const rarityApTables = await buildRarityApTables(drops)
  await kvPut(RARITY_AP_TABLES_KEY, JSON.stringify(rarityApTables))
  // 指紋は計算成功後に更新する。失敗時は据え置きで次回 run が再試行する。
  await kvPut(RARITY_FP_KEY, fingerprint)
  console.log('Successfully updated RARITY_AP_TABLES KV')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

/**
 * master-data 更新ジョブ(CI 版)。旧 fgo-data-updater worker の scheduled() と
 * 同じ処理を GitHub Actions 上で実行する(.github/workflows/update-master-data.yml)。
 *
 * 背景: Workers 無料プランの CPU enforcement は公称 10ms 超の invocation を
 * 確率的に kill する(超過頻度に応じて段階的に厳格化)。改善後でも定常 ~120ms
 * かかる本ジョブを worker で回す限り exceededCpu はゼロにならないため、
 * CPU 無制限の CI へ移管した。
 *
 * KV へは Cloudflare REST API でアクセスする(要 env: CLOUDFLARE_API_TOKEN /
 * CLOUDFLARE_ACCOUNT_ID)。トークンには Workers KV Storage:Edit 権限が必要。
 *
 * ローカル検証: DRY_RUN=1 で KV 書き込みをスキップし、読み込みは
 * /tmp/adj2.json(all_drops_json)・/tmp/nwaa.json(nice_war_aaquests)が
 * あればそれを使う。
 */
import { readFileSync, existsSync } from 'node:fs'

import {
  fetchAndTransformData,
  fetchDashboardMeta,
  fetchActiveEvents,
  fetchBasicServants,
} from '../lib/master-data/update'
import type { NiceWarCache, BasicServantEntry } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { validateDashboardMeta, validateMasterData } from '../lib/master-data/validation'
import { waveCountSeedFrom } from '../lib/master-data/wave-count'

const NAMESPACE_ID = '306bbe537e9d4907809f82468df500e4'
const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'
const SERVANTS_LIST_KEY = 'servants_list'
const NICE_WAR_CACHE_KEY = 'nice_war_aaquests'

const DRY_RUN = process.env.DRY_RUN === '1'

const kvUrl = (key: string) => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!account) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set')
  return `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${NAMESPACE_ID}/values/${key}`
}

const authHeaders = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set')
  return { Authorization: `Bearer ${token}` }
}

async function kvGet(key: string): Promise<string | null> {
  if (DRY_RUN) {
    const local: Record<string, string> = {
      [MASTER_DATA_KEY]: '/tmp/adj2.json',
      [NICE_WAR_CACHE_KEY]: '/tmp/nwaa.json',
    }
    const p = local[key]
    if (p && existsSync(p)) {
      console.log(`[dry-run] kvGet ${key} <- ${p}`)
      return readFileSync(p, 'utf8')
    }
    console.log(`[dry-run] kvGet ${key} -> null`)
    return null
  }
  const res = await fetch(kvUrl(key), { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`KV get ${key} failed: ${res.status} ${await res.text()}`)
  return await res.text()
}

async function kvPut(key: string, value: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[dry-run] kvPut ${key} (${(value.length / 1024).toFixed(1)} KB) skipped`)
    return
  }
  const res = await fetch(kvUrl(key), {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'text/plain' },
    body: value,
  })
  if (!res.ok) throw new Error(`KV put ${key} failed: ${res.status} ${await res.text()}`)
}

const niceWarCache: NiceWarCache = {
  async get() {
    const raw = await kvGet(NICE_WAR_CACHE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (e) {
      console.warn('Failed to parse nice_war cache; ignoring:', e)
      return null
    }
  },
  // 鮮度の維持は refresh-nice-war.yml の担当。本ジョブは cold フォールバック時のみ温める。
  async put(value) {
    await kvPut(NICE_WAR_CACHE_KEY, JSON.stringify(value))
  },
}

async function readPreviousMasterData(): Promise<MasterData | null> {
  try {
    const prior = await kvGet(MASTER_DATA_KEY)
    if (!prior) return null
    const parsed = JSON.parse(prior) as MasterData
    console.log(
      `Loaded previous master data: ${parsed.quests?.length ?? 0} quests, registry ${
        Object.keys(parsed.id_registry?.quests ?? {}).length
      } quest entries / ${Object.keys(parsed.id_registry?.items ?? {}).length} item entries`
    )
    return parsed
  } catch (e) {
    console.warn('Failed to read previous master data from KV:', e)
    return null
  }
}

async function main() {
  console.log(`Running master data update (CI)${DRY_RUN ? ' [dry-run]' : ''}...`)
  // アクティブイベントは drops 変換(AP キャンペーン)とダッシュボードの両方で必要。
  // 二重取得しないよう、ここで1回だけ取得して共有する。
  let events: Awaited<ReturnType<typeof fetchActiveEvents>> | undefined
  try {
    events = await fetchActiveEvents()
  } catch (e) {
    console.warn('Failed to prefetch active events; phases will fetch individually:', e)
  }

  const previous = await readPreviousMasterData()

  // drops (all_drops_json)
  let dropsData: MasterData | null = null
  let failed = false
  try {
    console.log('Fetching and transforming master data (drops)...')
    // CI には Workers の subrequest 上限が無いが、Atlas への礼儀として waveCount の
    // 新規 fetch は 50 件/run に抑える(seed 併用で数 run のうちに全件埋まる)。
    dropsData = await fetchAndTransformData({
      events,
      waveCountSeed: waveCountSeedFrom(previous),
      waveCountMaxFetch: 50,
      niceWarCache,
      previous: previous ?? undefined,
    })
    const v = validateMasterData(dropsData)
    if (!v.ok) {
      console.warn(`Refusing to overwrite MASTER_DATA KV with degraded payload: ${v.reason}`)
    } else {
      await kvPut(MASTER_DATA_KEY, JSON.stringify(dropsData))
      console.log('Successfully updated MASTER_DATA KV')
    }
  } catch (e) {
    console.error('Failed to update drops KV data:', e)
    failed = true
  }

  // basic_servant は dashboard と servants_list で共有(二重 fetch 回避)
  let servants: BasicServantEntry[] | undefined
  try {
    servants = await fetchBasicServants()
  } catch (e) {
    console.warn('Failed to prefetch basic servants; phases will fetch individually:', e)
  }

  // dashboard_meta
  try {
    console.log('Fetching dashboard metadata...')
    const dashboardMeta = await fetchDashboardMeta(dropsData?.quests, { events, servants })
    const v = validateDashboardMeta(dashboardMeta)
    if (!v.ok) {
      console.warn(`Refusing to overwrite DASHBOARD_META KV with degraded payload: ${v.reason}`)
    } else {
      await kvPut(DASHBOARD_META_KEY, JSON.stringify(dashboardMeta))
      console.log('Successfully updated DASHBOARD_META KV')
    }
  } catch (e) {
    console.error('Failed to update dashboard meta KV data:', e)
    failed = true
  }

  // servants_list
  try {
    console.log('Updating servants list...')
    const allServants = servants ?? (await fetchBasicServants())
    const filtered = allServants
      .filter(s => (s.type === 'normal' || s.type === 'heroine') && s.collectionNo > 0)
      .map(s => ({ id: s.id, name: s.name, rarity: s.rarity }))
    await kvPut(SERVANTS_LIST_KEY, JSON.stringify(filtered))
    console.log('Successfully updated SERVANTS_LIST KV')
  } catch (e) {
    console.error('Failed to update servants list KV data:', e)
    failed = true
  }

  // どこかのフェーズで失敗していたら run を赤にして気付けるようにする
  // (worker 時代は黙って次の cron 任せだった)
  if (failed) process.exit(1)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

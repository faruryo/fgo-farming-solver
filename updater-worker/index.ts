import { fetchAndTransformData, fetchDashboardMeta, fetchNiceEvents } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { validateDashboardMeta, validateMasterData } from '../lib/master-data/validation'

// nice_event.json は cron 1回で複数フェーズが必要とするため、先頭で1回だけ取得して共有する。
type NiceEvents = Awaited<ReturnType<typeof fetchNiceEvents>>

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'
const SERVANTS_LIST_KEY = 'servants_list'
// 注: rarity_ap_tables の更新は別 worker (rarity-worker/) に分離した。
// 無料プランの subrequest 上限内に収めるため、per-servant 取得を含む重い rarity 計算は
// 独立した cron worker(独自 subrequest 予算)で実行する。

const worker = {
  async scheduled(_event: unknown, env: Env) {
    console.log('Running scheduled data update...')
    // nice_event.json (約33MB) は drops 変換とダッシュボードの両方で必要。
    // cron 1回で二重に取得・parse しないよう、ここで1回だけ取得して共有する。
    let events: NiceEvents | undefined
    try {
      events = await fetchNiceEvents()
    } catch (e) {
      console.warn('Failed to prefetch nice_event.json; phases will fetch individually:', e)
    }
    // 前回 KV の all_drops_json から waveCount(aaQuestId→ターン数)を seed として読む。
    // これで populateWaveCounts の per-quest fetch(180件超 = subrequest 上限超過の
    // 主因)を新規クエスト分だけに削減する。
    const waveCountSeed = await readWaveCountSeed(env)
    const dropsData = await updateDrops(env, events, waveCountSeed)
    await Promise.all([
      updateDashboardMeta(env, dropsData, events),
      updateServantsList(env),
    ])
  }
}

export default worker

async function readWaveCountSeed(env: Env): Promise<Map<number, number> | undefined> {
  try {
    const prior = await env.MASTER_DATA.get(MASTER_DATA_KEY)
    if (!prior) return undefined
    const parsed = JSON.parse(prior) as MasterData
    const seed = new Map<number, number>()
    for (const q of parsed.quests ?? []) {
      if (typeof q.aaQuestId === 'number' && typeof q.waveCount === 'number') {
        seed.set(q.aaQuestId, q.waveCount)
      }
    }
    return seed.size > 0 ? seed : undefined
  } catch (e) {
    console.warn('Failed to read waveCount seed from prior KV:', e)
    return undefined
  }
}

async function updateDrops(
  env: Env,
  events?: NiceEvents,
  waveCountSeed?: Map<number, number>
): Promise<MasterData | null> {
  try {
    console.log('Fetching and transforming master data (drops)...')
    const dropsData = await fetchAndTransformData({ events, waveCountSeed })
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

async function updateDashboardMeta(env: Env, dropsData: MasterData | null, events?: NiceEvents) {
  try {
    console.log('Fetching dashboard metadata...')
    const dashboardMeta = await fetchDashboardMeta(dropsData?.quests, { events })
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

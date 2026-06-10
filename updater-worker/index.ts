import { fetchAndTransformData, fetchDashboardMeta, fetchActiveEvents } from '../lib/master-data/update'
import type { NiceWarCache, NiceWarQuest } from '../lib/master-data/update'
import type { MasterData } from '../lib/master-data/types'
import { validateDashboardMeta, validateMasterData } from '../lib/master-data/validation'
import { waveCountSeedFrom } from '../lib/master-data/wave-count'

// アクティブイベントは cron 1回で複数フェーズが必要とするため、先頭で1回だけ取得して共有する。
type NiceEvents = Awaited<ReturnType<typeof fetchActiveEvents>>

export interface Env {
  MASTER_DATA: KVNamespace
}

const MASTER_DATA_KEY = 'all_drops_json'
const DASHBOARD_META_KEY = 'dashboard_meta'
const SERVANTS_LIST_KEY = 'servants_list'
// nice_war(約23MB)の parse 済み compact マッピングのキャッシュ。ETag 条件付き
// GET の 304 時に再利用し、phase A の exceededCpu を回避する。
const NICE_WAR_CACHE_KEY = 'nice_war_aaquests'

function makeNiceWarCache(env: Env): NiceWarCache {
  return {
    async get() {
      const raw = await env.MASTER_DATA.get(NICE_WAR_CACHE_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw) as { etag: string; lastModified?: string; aaQuests: NiceWarQuest[] }
      } catch (e) {
        console.warn('Failed to parse nice_war cache; ignoring:', e)
        return null
      }
    },
    async put(value) {
      await env.MASTER_DATA.put(NICE_WAR_CACHE_KEY, JSON.stringify(value))
    },
  }
}
// 注: rarity_ap_tables の更新は別 worker (rarity-worker/) に分離した。
// 無料プランの subrequest 上限内に収めるため、per-servant 取得を含む重い rarity 計算は
// 独立した cron worker(独自 subrequest 予算)で実行する。

const worker = {
  async scheduled(_event: unknown, env: Env) {
    console.log('Running scheduled data update...')
    // アクティブイベントは drops 変換(AP キャンペーン)とダッシュボードの両方で必要。
    // cron 1回で二重取得しないよう、ここで1回だけ取得して共有する。
    // 旧実装は nice_event.json(約40MB)を毎回 parse して exceededCpu の主因だった。
    // 現在は basic_event(約316KB)+ アクティブ数件の per-event 取得に置き換え済み。
    let events: NiceEvents | undefined
    try {
      events = await fetchActiveEvents()
    } catch (e) {
      console.warn('Failed to prefetch active events; phases will fetch individually:', e)
    }
    // 前回 KV の all_drops_json を丸ごと読む(既存のKV read 1回のまま)。
    // - waveCount seed: populateWaveCounts の per-quest fetch(180件超 = subrequest
    //   上限超過の主因)を新規クエスト分だけに削減する。
    // - 短縮ID安定化: 前回の id_registry(無ければ公開済みID)を引き継ぎ、
    //   データ更新をまたいで同一クエスト/アイテムに同一IDを割り当て続ける。
    const previous = await readPreviousMasterData(env)
    const dropsData = await updateDrops(env, events, previous)
    await Promise.all([
      updateDashboardMeta(env, dropsData, events),
      updateServantsList(env),
    ])
  }
}

export default worker

async function readPreviousMasterData(env: Env): Promise<MasterData | null> {
  try {
    const prior = await env.MASTER_DATA.get(MASTER_DATA_KEY)
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

async function updateDrops(
  env: Env,
  events?: NiceEvents,
  previous?: MasterData | null
): Promise<MasterData | null> {
  try {
    console.log('Fetching and transforming master data (drops)...')
    // 無料プランの subrequest 上限(1 invocation ~50)内に収めるため、waveCount の
    // 新規 fetch は 1 回あたり 20 件までに制限。seed と併用で数回の cron で全件埋まり、
    // 以後は 0 件になる。これで dashboard/servants 更新が starve しない。
    // previous を渡すことで短縮IDが世代間で安定する(reused/new 件数は update 側でログ)。
    const dropsData = await fetchAndTransformData({
      events,
      waveCountSeed: waveCountSeedFrom(previous),
      waveCountMaxFetch: 20,
      niceWarCache: makeNiceWarCache(env),
      previous: previous ?? undefined,
    })
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

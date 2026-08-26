import { origin, region } from '../../constants/atlasacademy'

// nice_war(約23MB)の parse 済み compact マッピングを KV にキャッシュするための
// アクセサ。CI ジョブ(scripts/run-updater.ts)が KV REST 実装を差し込む。
// bench/test では未指定で従来どおり毎回 fetch する。
export interface NiceWarCache {
  get(): Promise<{ etag: string; lastModified?: string; aaQuests: NiceWarQuest[] } | null>
  put(value: { etag: string; lastModified?: string; aaQuests: NiceWarQuest[] }): Promise<void>
}

// Cloudflare の global_fetch_strictly_public は upstream の strong ETag を weak 化
// (先頭に W/ を付与)して返すことがある。Atlas は If-None-Match に weak etag を渡されると
// 304 を返さず(strong 比較のみ対応)毎回 23MB を再送する。これが phase A の
// exceededCpu の主因だった。比較を成立させるため W/ プレフィックスを剥がして strong に戻す。
export const normalizeEtag = (etag: string): string => etag.replace(/^W\//, '')

export interface NiceWarQuest {
  id: number
  name: string
  spotName: string
  afterClear?: string
  warLongName?: string
}

export interface AtlasRawWarQuest {
  id: number
  name: string
  spotName: string
  afterClear?: string
}

export interface AtlasRawWarSpot {
  quests?: AtlasRawWarQuest[]
}

export interface AtlasRawWar {
  spots?: AtlasRawWarSpot[]
  longName?: string
}

/**
 * nice_war の war 配列から後段で使う 5 項目だけの compact クエスト一覧を作る。
 * ⚠️ メモリ対策: `{...q}` で全フィールド(~30項目)を 15,000+ 件コピーすると
 * nice_war(23MB)の object graph が二重化しメモリを浪費する(Workers 時代は
 * 128MB 上限で GC 暴走 → exceededCpu の原因だった)。更新ジョブの cold
 * フォールバックと CI の refresh スクリプト(scripts/refresh-nice-war-cache.ts)
 * の両方で共有する。
 */
export const compactNiceWarQuests = (aaWars: AtlasRawWar[]): NiceWarQuest[] =>
  aaWars.flatMap(war =>
    (war.spots || []).flatMap(spot =>
      (spot.quests || []).map(q => ({
        id: q.id,
        name: q.name,
        spotName: q.spotName,
        afterClear: q.afterClear,
        warLongName: war.longName,
      }))
    )
  )

export interface LoadNiceWarQuestsOptions {
  niceWarCache?: NiceWarCache
}

const loadLocalWarsFile = async (): Promise<AtlasRawWar[] | null> => {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const filePath = path.resolve('/tmp', 'nice_war.json')
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(content)
    return parsed as AtlasRawWar[]
  } catch {
    return null
  }
}

const fetchRemoteWars = async (): Promise<{ aaWars: AtlasRawWar[]; warEtag: string; warLastModified: string } | null> => {
  const warRes = await fetch(`${origin}/export/${region}/nice_war.json`)
  if (!warRes.ok) return null
  const aaWars: AtlasRawWar[] = await warRes.json()
  const warEtag = normalizeEtag(warRes.headers?.get('etag') ?? '')
  const warLastModified = warRes.headers?.get('last-modified') ?? ''
  return { aaWars, warEtag, warLastModified }
}

const cacheCompactQuests = async (
  cache: NiceWarCache,
  etag: string,
  lastModified: string,
  aaQuests: NiceWarQuest[]
): Promise<void> => {
  if (!etag && !lastModified) return
  try {
    await cache.put({ etag, lastModified, aaQuests })
    console.log(`Cached nice_war mapping (etag ${etag}, ${aaQuests.length} quests).`)
  } catch (e) {
    console.warn('Failed to cache nice_war mapping:', e)
  }
}

export async function loadNiceWarQuests(
  opts: LoadNiceWarQuestsOptions = {}
): Promise<NiceWarQuest[]> {
  try {
    const aaWars = await loadLocalWarsFile()
    if (aaWars) {
      const aaQuests = compactNiceWarQuests(aaWars)
      console.log(`Extracted ${aaQuests.length} quests from Atlas Academy wars.`)
      return aaQuests
    }

    if (opts.niceWarCache) {
      const cached = await opts.niceWarCache.get()
      if (cached?.aaQuests && cached.aaQuests.length > 0) {
        console.log(`Using ${cached.aaQuests.length} cached nice_war quests (refreshed out-of-band).`)
        return cached.aaQuests
      }
      console.log('nice_war cache empty; fetching full metadata (~23MB) to warm it...')
    } else {
      console.log('Fetching war metadata from Atlas Academy (this might be slow)...')
    }

    const remote = await fetchRemoteWars()
    if (!remote) return []

    const aaQuests = compactNiceWarQuests(remote.aaWars)
    console.log(`Extracted ${aaQuests.length} quests from Atlas Academy wars.`)

    if (opts.niceWarCache) {
      await cacheCompactQuests(opts.niceWarCache, remote.warEtag, remote.warLastModified, aaQuests)
    }

    return aaQuests
  } catch (e) {
    console.log('Failed to load war quest metadata:', e)
    return []
  }
}

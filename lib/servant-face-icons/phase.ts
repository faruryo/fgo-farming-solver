/**
 * 更新ジョブの顔のアイコンの段。`nice_servant` を自分で取り、前回のデータに無いアイコンだけを取得して 16×16 に縮め、
 * KV に置く。通信と KV は引数で受け取る。
 */
import { downscaleIcon } from '../shop-screenshot-import/icon-match'
import type { FaceIconEntry } from '../servant-roster-import/types'
import {
  SERVANT_FACE_ICONS_KEY,
  buildFaceIconData,
  isSameFaceIconData,
  listFaceIconSources,
  needsUnconditionalFetch,
  parseFaceIconData,
  planFaceIconUpdate,
  type FaceIconSource,
  type FaceSourceServant,
} from './face-icons'
import { decodeFaceIconPng } from './png'

type Logger = Pick<Console, 'error' | 'log' | 'warn'>

type IconResult = { ok: true; entry: FaceIconEntry } | { ok: false; url: string; reason: string }

const fetchIcon = async (fetchSource: typeof fetch, source: FaceIconSource): Promise<IconResult> => {
  try {
    const response = await fetchSource(source.url)
    if (!response.ok) return { ok: false, url: source.url, reason: `HTTP ${response.status}` }
    const decoded = decodeFaceIconPng(new Uint8Array(await response.arrayBuffer()))
    if (!decoded.ok) return { ok: false, url: source.url, reason: decoded.reason }
    const pixels = Buffer.from(downscaleIcon(decoded.image).buffer).toString('base64')
    return { ok: true, entry: { servantId: source.servantId, url: source.url, pixels } }
  } catch (error) {
    return { ok: false, url: source.url, reason: error instanceof Error ? error.message : String(error) }
  }
}

/** `concurrency` 枚ずつまとめて取る（取得の順に結果を返す） */
const fetchIcons = async (
  fetchSource: typeof fetch,
  sources: readonly FaceIconSource[],
  concurrency: number,
): Promise<IconResult[]> => {
  const results: IconResult[] = []
  for (let start = 0; start < sources.length; start += concurrency) {
    const batch = sources.slice(start, start + concurrency)
    results.push(...(await Promise.all(batch.map(source => fetchIcon(fetchSource, source)))))
  }
  return results
}

const servantRequestHeaders = (etag: string | null | undefined): Headers => {
  const headers = new Headers()
  // Atlas は weak ETag を If-None-Match に渡すと 304 を返さないことがある
  if (etag) headers.set('If-None-Match', etag.replace(/^W\//, ''))
  return headers
}

export const runServantFaceIconsPhase = async ({
  get,
  put,
  fetchSource = fetch,
  servantUrl,
  now = Date.now,
  logger = console,
  concurrency = 8,
}: {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string) => Promise<void>
  fetchSource?: typeof fetch
  servantUrl: string
  now?: () => number
  logger?: Logger
  concurrency?: number
}): Promise<{ failed: boolean }> => {
  try {
    const previous = parseFaceIconData(await get(SERVANT_FACE_ICONS_KEY))
    const conditional = !needsUnconditionalFetch(previous)
    const response = await fetchSource(servantUrl, {
      headers: servantRequestHeaders(conditional ? previous?.etag : null),
    })
    if (response.status === 304) {
      logger.log('Servant face icons: nice_servant unchanged')
      return { failed: false }
    }
    if (!response.ok) throw new Error(`nice_servant fetch failed: ${response.status}`)
    const sources = listFaceIconSources(await response.json<FaceSourceServant[]>())
    if (sources.length === 0) throw new Error('nice_servant has no face icons')

    const plan = planFaceIconUpdate(previous, sources)
    const results = await fetchIcons(fetchSource, plan.fetch, concurrency)
    const failures = results.flatMap(r => (r.ok ? [] : [r]))
    for (const failure of failures) logger.warn(`Servant face icon skipped: ${failure.url} (${failure.reason})`)

    const data = buildFaceIconData({
      sources,
      keep: plan.keep,
      fetched: results.flatMap(r => (r.ok ? [r.entry] : [])),
      failedUrls: failures.map(f => f.url),
      etag: response.headers.get('etag'),
      updatedAt: new Date(now()).toISOString(),
    })
    if (data.icons.length === 0) throw new Error('no servant face icon could be fetched')
    if (isSameFaceIconData(previous, data)) {
      logger.log('Servant face icons: unchanged')
      return { failed: false }
    }
    await put(SERVANT_FACE_ICONS_KEY, JSON.stringify(data))
    logger.log(
      `Servant face icons: ${data.icons.length} icons (${plan.fetch.length - failures.length} fetched, ` +
      `${plan.keep.length} kept, ${failures.length} failed)`,
    )
    return { failed: false }
  } catch (error) {
    logger.error('Failed to update servant face icons:', error)
    return { failed: true }
  }
}

/**
 * 照合用の顔のアイコンのデータを作る判断の純粋関数。
 * 取得・縮小・KV への書き込みは呼び出し側（phase.ts）に置く。
 */
import type { FaceIconData, FaceIconEntry } from '../servant-roster-import/types'

/** `MASTER_DATA` の KV のキー */
export const SERVANT_FACE_ICONS_KEY = 'servant_face_icons'

/** KV の値が無い環境で読む、git に入れないローカルのファイル（repo の根からの相対パス） */
export const SERVANT_FACE_ICONS_LOCAL_PATH = 'cache/servant-face-icons.json'

/** 取得するアイコン1枚 */
export type FaceIconSource = { servantId: number; url: string }

/** `nice_servant` の1騎のうち、顔のアイコンを並べるのに使う欄 */
export type FaceSourceServant = {
  id: number
  type?: string
  extraAssets?: { faces?: { ascension?: Record<string, string>; costume?: Record<string, string> } }
}

const PLAYABLE_TYPES = new Set(['normal', 'heroine'])

const sortedValues = (record: Record<string, string> | undefined): string[] =>
  Object.entries(record ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, url]) => url)
    .filter(url => typeof url === 'string' && url.length > 0)

/** プレイアブルなサーヴァントの、再臨の段階ごとと霊衣の顔のアイコンを並べる（同じ URL は1つにする） */
export const listFaceIconSources = (servants: readonly FaceSourceServant[]): FaceIconSource[] => {
  const seen = new Set<string>()
  const sources: FaceIconSource[] = []
  for (const servant of servants) {
    if (!servant.type || !PLAYABLE_TYPES.has(servant.type)) continue
    const faces = servant.extraAssets?.faces
    for (const url of [...sortedValues(faces?.ascension), ...sortedValues(faces?.costume)]) {
      if (seen.has(url)) continue
      seen.add(url)
      sources.push({ servantId: servant.id, url })
    }
  }
  return sources
}

const isEntry = (value: unknown): value is FaceIconEntry => {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return typeof entry.servantId === 'number' && typeof entry.url === 'string' && typeof entry.pixels === 'string'
}

/** KV の値を読む。壊れていれば null（無いものとして作り直す） */
export const parseFaceIconData = (raw: string | null): FaceIconData | null => {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (!Array.isArray(value.icons) || !value.icons.every(isEntry)) return null
    const failedUrls = Array.isArray(value.failedUrls)
      ? value.failedUrls.filter((url): url is string => typeof url === 'string')
      : []
    const etag = typeof value.etag === 'string' ? value.etag : null
    return { icons: value.icons, failedUrls, etag, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined }
  } catch {
    return null
  }
}

/** データが無いときと、前回取得できなかったアイコンがあるときは `nice_servant` を無条件で取る */
export const needsUnconditionalFetch = (previous: FaceIconData | null): boolean =>
  previous === null || (previous.failedUrls?.length ?? 0) > 0

export type FaceIconPlan = {
  /** 取得して縮めるアイコン（前回のデータに無いもの。前回取得できなかったものを含む） */
  fetch: FaceIconSource[]
  /** 前回のデータから残すアイコン */
  keep: FaceIconEntry[]
}

/** 今のアイコンの一覧を、取り直すものと前回のデータから残すものに分ける（URL で見分ける） */
export const planFaceIconUpdate = (previous: FaceIconData | null, sources: readonly FaceIconSource[]): FaceIconPlan => {
  const previousByUrl = new Map((previous?.icons ?? []).map(icon => [icon.url, icon]))
  const plan: FaceIconPlan = { fetch: [], keep: [] }
  for (const source of sources) {
    const kept = previousByUrl.get(source.url)
    if (kept) plan.keep.push({ ...kept, servantId: source.servantId })
    else plan.fetch.push(source)
  }
  return plan
}

/** 残すアイコンと取得したアイコンを、今の一覧の順に並べたデータにする */
export const buildFaceIconData = ({
  sources,
  keep,
  fetched,
  failedUrls,
  etag,
  updatedAt,
}: {
  sources: readonly FaceIconSource[]
  keep: readonly FaceIconEntry[]
  fetched: readonly FaceIconEntry[]
  failedUrls: readonly string[]
  etag: string | null
  updatedAt: string
}): FaceIconData => {
  const byUrl = new Map([...keep, ...fetched].map(icon => [icon.url, icon]))
  const icons = sources.flatMap(source => byUrl.get(source.url) ?? [])
  return { icons, failedUrls: [...failedUrls], etag, updatedAt }
}

/** 前回のデータと中身が同じか（書き込みを省くため） */
export const isSameFaceIconData = (previous: FaceIconData | null, next: FaceIconData): boolean =>
  previous !== null &&
  previous.etag === next.etag &&
  (previous.failedUrls ?? []).join('\n') === (next.failedUrls ?? []).join('\n') &&
  previous.icons.length === next.icons.length &&
  previous.icons.every((icon, i) => {
    const other = next.icons.at(i)
    return icon.url === other?.url && icon.servantId === other.servantId
  })

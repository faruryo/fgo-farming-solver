import type { Item, NiceServant } from '../interfaces/atlas-academy'
import { reduceServantMaterials, type MaterialsForServants } from './get-materials'
import {
  buildMaterialCatalog,
  materialCatalogItemIds,
  materialCatalogFingerprint,
  validateMaterialCatalog,
  type MaterialCatalogV1,
  type SourceValidator,
} from './material-catalog'

export type ConditionalFetch = (url: string, validator: SourceValidator) => Promise<{
  status: 200 | 304
  value?: unknown
  validator: SourceValidator
}>

export const conditionalRequestHeaders = (validator: SourceValidator): Headers => {
  const headers = new Headers()
  // Atlas は weak ETag を If-None-Match に渡すと304を返さないことがある。
  if (validator.etag) headers.set('If-None-Match', validator.etag.replace(/^W\//, ''))
  if (validator.lastModified) headers.set('If-Modified-Since', validator.lastModified)
  return headers
}

const validatorFor = (response: Awaited<ReturnType<ConditionalFetch>>, previous: SourceValidator): SourceValidator =>
  response.status === 304 ? previous : response.validator

const parseServants = (value: unknown): NiceServant[] => {
  if (!Array.isArray(value)) throw new Error('Material Catalog servant response is not an array')
  return value.filter((servant): servant is NiceServant =>
    !!servant && typeof servant === 'object' &&
    ['normal', 'heroine'].includes((servant as NiceServant).type) &&
    (servant as NiceServant).collectionNo > 0
  )
}

const parseItems = (value: unknown): Item[] => {
  if (!Array.isArray(value)) throw new Error('Material Catalog item response is not an array')
  return value as Item[]
}

type BasicEventEntry = { id: number; name: string; type?: unknown; startedAt?: unknown }

const isNamedEvent = (e: unknown): e is BasicEventEntry => {
  if (!e || typeof e !== 'object') return false
  const { id, name } = e as { id?: unknown; name?: unknown }
  return typeof id === 'number' && typeof name === 'string'
}

// basic_event はイベント名と「ボーナスが始まったか」の判定にだけ使う。取れなくてもカタログ更新は止めない。
const fetchEvents = async (
  fetchSource: ConditionalFetch,
  eventUrl: string | undefined
): Promise<BasicEventEntry[] | undefined> => {
  if (!eventUrl) return undefined
  try {
    const { value } = await fetchSource(eventUrl, {})
    return Array.isArray(value) ? value.filter(isNamedEvent) : undefined
  } catch {
    return undefined
  }
}

const previousEventNames = (previous: MaterialCatalogV1 | null): Map<number, string> =>
  new Map(
    (previous?.servants ?? []).flatMap(servant =>
      (servant.eventBonuses ?? []).flatMap(b => (b.eventName ? [[b.eventId, b.eventName] as const] : [])))
  )

// 開始前のボーナスはカタログに載せないため、イベント開始では nice_servant が変わらず 304 のまま載らない。
// 前回の更新後に eventQuest（特攻・絆ボーナスを持つ型）が始まったら条件なしで取り直す。
// ponytail: ボーナスの無い eventQuest が始まるとカタログが変わらず updatedAt も進まないので、次に変わるまで毎回取り直す。CI なので許容。
const bonusEventStartedSince = (
  events: BasicEventEntry[] | undefined,
  previous: MaterialCatalogV1 | null,
  nowSec: number
): boolean => {
  if (!previous || !events) return false
  const builtAt = Math.floor(previous.updatedAt / 1000)
  return events.some(e =>
    e.type === 'eventQuest' && typeof e.startedAt === 'number' && e.startedAt > builtAt && e.startedAt <= nowSec)
}

const existingOrThrow = (previous: MaterialCatalogV1 | null): MaterialCatalogV1 => {
  if (!previous) throw new Error('Atlas returned 304 but no previous Material Catalog exists')
  return previous
}

const servantSection = (
  response: Awaited<ReturnType<ConditionalFetch>>,
  previous: MaterialCatalogV1 | null
): { servants: MaterialCatalogV1['servants'] | NiceServant[]; materials: MaterialsForServants } => {
  if (response.status === 304) {
    const catalog = existingOrThrow(previous)
    return { servants: catalog.servants, materials: catalog.materials }
  }
  const servants = parseServants(response.value)
  return { servants, materials: Object.fromEntries(servants.map(servant => [servant.id, reduceServantMaterials(servant)])) }
}

const itemSection = (
  response: Awaited<ReturnType<ConditionalFetch>>,
  previous: MaterialCatalogV1 | null,
  materials: MaterialsForServants
): MaterialCatalogV1['items'] | Item[] => {
  if (response.status === 304) return existingOrThrow(previous).items
  const materialItemIds = materialCatalogItemIds(materials)
  return parseItems(response.value).filter(item =>
    materialItemIds.has(item.id) || ['qp', 'skillLvUp', 'tdLvUp'].includes(item.type)
  )
}

const materialItemsAreKnown = (materials: MaterialsForServants, items: MaterialCatalogV1['items']): boolean => {
  const knownItemIds = new Set(items.map(item => item.id))
  return [...materialCatalogItemIds(materials)].every(itemId => knownItemIds.has(itemId))
}

// bondGrowth・eventBonuses を足した直後は Atlas が未変更で304を返し続け、項目のない一覧が固定される。
// 一部の欠落は Atlas 側の通常状態なので、全騎が持たないときだけ取り直す。
// eventBonuses は開催中のボーナスが無いと空配列になるため、値でなく項目の有無で見る。
const servantValidatorFor = (previous: MaterialCatalogV1 | null): SourceValidator =>
  previous?.servants.some(servant => servant.bondGrowth) &&
  previous.servants.some(servant => servant.eventBonuses !== undefined)
    ? previous.sources.niceServant
    : {}

export const updateMaterialCatalog = async ({
  previous,
  fetchSource,
  servantUrl,
  itemUrl,
  eventUrl,
  now,
}: {
  previous: MaterialCatalogV1 | null
  fetchSource: ConditionalFetch
  servantUrl: string
  itemUrl: string
  eventUrl?: string
  now: () => number
}): Promise<{ catalog: MaterialCatalogV1 | null; changed: boolean; reason: string }> => {
  const events = await fetchEvents(fetchSource, eventUrl)
  const servantValidator = bonusEventStartedSince(events, previous, Math.floor(now() / 1000)) ? {} : servantValidatorFor(previous)
  const [servantsResponse, initialItemsResponse] = await Promise.all([
    fetchSource(servantUrl, servantValidator),
    fetchSource(itemUrl, previous?.sources.niceItem ?? {}),
  ])
  if (servantsResponse.status === 304 && initialItemsResponse.status === 304) {
    return { catalog: existingOrThrow(previous), changed: false, reason: 'both sources not modified' }
  }
  const { servants, materials } = servantSection(servantsResponse, previous)
  const itemsResponse =
    servantsResponse.status === 200 &&
    initialItemsResponse.status === 304 &&
    !materialItemsAreKnown(materials, existingOrThrow(previous).items)
      ? await fetchSource(itemUrl, {})
      : initialItemsResponse
  const items = itemSection(itemsResponse, previous, materials)
  // 取れなかったときは前回の名前を引き継ぐ（空にすると、次に nice_servant が変わるまでイベント ID 表示に固定される）。
  const eventNames = events ? new Map(events.map(e => [e.id, e.name])) : previousEventNames(previous)
  const candidate = buildMaterialCatalog({
    servants,
    materials,
    items,
    sources: {
      niceServant: validatorFor(servantsResponse, previous?.sources.niceServant ?? {}),
      niceItem: validatorFor(itemsResponse, previous?.sources.niceItem ?? {}),
    },
    updatedAt: now(),
    eventNames,
  })
  const validation = validateMaterialCatalog(candidate, previous ?? undefined)
  if (!validation.ok) throw new Error(`Refusing Material Catalog update: ${validation.reason}`)
  if (previous && materialCatalogFingerprint(candidate) === materialCatalogFingerprint(previous)) {
    return { catalog: previous, changed: false, reason: 'semantic content unchanged' }
  }
  return { catalog: candidate, changed: true, reason: 'catalog updated' }
}

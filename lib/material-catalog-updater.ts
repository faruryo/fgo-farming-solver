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

const isNamedEvent = (e: unknown): e is { id: number; name: string } => {
  if (!e || typeof e !== 'object') return false
  const { id, name } = e as { id?: unknown; name?: unknown }
  return typeof id === 'number' && typeof name === 'string'
}

// イベント名はボーナスの見出しにだけ使う。取れなくてもカタログ更新は止めない（画面はイベント ID で出す）。
const fetchEventNames = async (
  fetchSource: ConditionalFetch,
  eventUrl: string | undefined
): Promise<Map<number, string>> => {
  if (!eventUrl) return new Map()
  try {
    const { value } = await fetchSource(eventUrl, {})
    if (!Array.isArray(value)) return new Map()
    return new Map(value.filter(isNamedEvent).map(e => [e.id, e.name]))
  } catch {
    return new Map()
  }
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
  const [servantsResponse, initialItemsResponse] = await Promise.all([
    fetchSource(servantUrl, servantValidatorFor(previous)),
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
  const eventNames = servantsResponse.status === 200 ? await fetchEventNames(fetchSource, eventUrl) : undefined
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

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

export const updateMaterialCatalog = async ({
  previous,
  fetchSource,
  servantUrl,
  itemUrl,
  now,
}: {
  previous: MaterialCatalogV1 | null
  fetchSource: ConditionalFetch
  servantUrl: string
  itemUrl: string
  now: () => number
}): Promise<{ catalog: MaterialCatalogV1 | null; changed: boolean; reason: string }> => {
  const [servantsResponse, itemsResponse] = await Promise.all([
    fetchSource(servantUrl, previous?.sources.niceServant ?? {}),
    fetchSource(itemUrl, previous?.sources.niceItem ?? {}),
  ])
  if (servantsResponse.status === 304 && itemsResponse.status === 304) {
    return { catalog: existingOrThrow(previous), changed: false, reason: 'both sources not modified' }
  }
  const { servants, materials } = servantSection(servantsResponse, previous)
  const items = itemSection(itemsResponse, previous, materials)
  const candidate = buildMaterialCatalog({
    servants,
    materials,
    items,
    sources: {
      niceServant: validatorFor(servantsResponse, previous?.sources.niceServant ?? {}),
      niceItem: validatorFor(itemsResponse, previous?.sources.niceItem ?? {}),
    },
    updatedAt: now(),
  })
  const validation = validateMaterialCatalog(candidate, previous ?? undefined)
  if (!validation.ok) throw new Error(`Refusing Material Catalog update: ${validation.reason}`)
  if (previous && materialCatalogFingerprint(candidate) === materialCatalogFingerprint(previous)) {
    return { catalog: previous, changed: false, reason: 'semantic content unchanged' }
  }
  return { catalog: candidate, changed: true, reason: 'catalog updated' }
}

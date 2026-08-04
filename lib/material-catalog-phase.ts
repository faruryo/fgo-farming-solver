import { MATERIAL_CATALOG_KEY, type MaterialCatalogV1 } from './material-catalog'
import { conditionalRequestHeaders, updateMaterialCatalog } from './material-catalog-updater'

type Logger = Pick<Console, 'error' | 'log'>

export const runMaterialCatalogPhase = async ({
  get,
  put,
  fetchSource = fetch,
  servantUrl,
  itemUrl,
  now = Date.now,
  logger = console,
}: {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string) => Promise<void>
  fetchSource?: typeof fetch
  servantUrl: string
  itemUrl: string
  now?: () => number
  logger?: Logger
}): Promise<{ failed: boolean }> => {
  try {
    const raw = await get(MATERIAL_CATALOG_KEY)
    const previous = raw ? (JSON.parse(raw) as MaterialCatalogV1) : null
    const catalog = await updateMaterialCatalog({
      previous,
      servantUrl,
      itemUrl,
      now,
      fetchSource: async (url, validator) => {
        const response = await fetchSource(url, { headers: conditionalRequestHeaders(validator) })
        if (response.status !== 200 && response.status !== 304) {
          throw new Error(`Material Catalog fetch failed: ${response.status}`)
        }
        return {
          status: response.status,
          value: response.status === 200 ? await response.json() : undefined,
          validator: {
            etag: response.headers.get('etag') ?? undefined,
            lastModified: response.headers.get('last-modified') ?? undefined,
          },
        }
      },
    })
    if (catalog.changed && catalog.catalog) {
      const serialized = JSON.stringify(catalog.catalog)
      logger.log(
        `Material Catalog candidate: ${catalog.catalog.servants.length} servants, ` +
        `${Object.keys(catalog.catalog.materials).length} material records, ` +
        `${catalog.catalog.items.length} items, ${new TextEncoder().encode(serialized).byteLength} bytes`
      )
      await put(MATERIAL_CATALOG_KEY, serialized)
    }
    logger.log(`Material Catalog: ${catalog.reason}`)
    return { failed: false }
  } catch (error) {
    logger.error('Failed to update Material Catalog:', error)
    return { failed: true }
  }
}

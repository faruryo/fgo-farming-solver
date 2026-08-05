import type { Item } from '../interfaces/atlas-academy'
import { fetchJsonWithCache } from './cache'
import { getUrl } from './get-url'
import { getMaterialsForServants } from './get-materials'
import { getNiceServants } from './get-nice-servants'
import { buildMaterialCatalog, materialCatalogItemIds, validateMaterialCatalog, type MaterialCatalogV1 } from './material-catalog'

// next dev only: Atlas の既存filesystem cacheを使い、production のKV欠落を
// upstream fetchで隠さない。route側がfilesystem可否を先に検査する。
export const loadLocalMaterialCatalog = async (now = Date.now()): Promise<MaterialCatalogV1> => {
  const [servants, materials, allItems] = await Promise.all([
    getNiceServants('ja', true),
    getMaterialsForServants(),
    fetchJsonWithCache<Item[]>(getUrl('nice_item', 'ja')),
  ])
  const materialItemIds = materialCatalogItemIds(materials)
  const catalog = buildMaterialCatalog({
    servants,
    materials,
    items: allItems.filter(item => materialItemIds.has(item.id) || ['qp', 'skillLvUp', 'tdLvUp'].includes(item.type)),
    sources: { niceServant: {}, niceItem: {} },
    updatedAt: now,
  })
  const validation = validateMaterialCatalog(catalog)
  if (!validation.ok) throw new Error(`Invalid local Material Catalog: ${validation.reason}`)
  return catalog
}

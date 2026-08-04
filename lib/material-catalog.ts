import type { ClassName, Item, NiceServant } from '../interfaces/atlas-academy'
import type { MaterialsForServants } from './get-materials'

export const MATERIAL_CATALOG_KEY = 'material_catalog_v1'
export const MATERIAL_CATALOG_SCHEMA_VERSION = 1 as const
export const MATERIAL_CATALOG_MAX_BYTES = 5 * 1024 * 1024

export type SourceValidator = { etag?: string; lastModified?: string }

export type MaterialCatalogServant = Pick<
  NiceServant,
  'id' | 'name' | 'className' | 'collectionNo' | 'rarity'
> & { face: string | null }

export type MaterialCatalogItem = Pick<Item, 'id' | 'name' | 'icon'>

export type MaterialCatalogV1 = {
  schemaVersion: typeof MATERIAL_CATALOG_SCHEMA_VERSION
  updatedAt: number
  sources: {
    niceServant: SourceValidator
    niceItem: SourceValidator
  }
  servants: MaterialCatalogServant[]
  materials: MaterialsForServants
  items: MaterialCatalogItem[]
}

export const materialCatalogFace = (servant: NiceServant): string | null => {
  const faces = servant.extraAssets?.faces
  return faces?.ascension?.['0'] ?? Object.values(faces?.ascension ?? {})[0] ?? null
}

export const buildMaterialCatalog = ({
  servants,
  materials,
  items,
  sources,
  updatedAt,
}: {
  servants: Array<NiceServant | MaterialCatalogServant>
  materials: MaterialsForServants
  items: Array<Item | MaterialCatalogItem>
  sources: MaterialCatalogV1['sources']
  updatedAt: number
}): MaterialCatalogV1 => ({
  schemaVersion: MATERIAL_CATALOG_SCHEMA_VERSION,
  updatedAt,
  sources,
  servants: servants.map((servant) => ({
    id: servant.id,
    name: servant.name,
    className: servant.className,
    collectionNo: servant.collectionNo,
    rarity: servant.rarity,
    face: 'extraAssets' in servant ? materialCatalogFace(servant) : servant.face,
  })),
  materials,
  items: items.map(({ id, name, icon }) => ({ id, name, icon })),
})

export const materialCatalogFingerprint = (catalog: MaterialCatalogV1): string =>
  JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    servants: catalog.servants,
    materials: catalog.materials,
    items: catalog.items,
  })

export const materialCatalogItemIds = (materials: MaterialsForServants): Set<number> => {
  const ids = new Set<number>()
  for (const records of Object.values(materials)) {
    for (const levels of Object.values(records)) {
      for (const level of Object.values(levels)) {
        for (const { item } of level.items) ids.add(item.id)
      }
    }
  }
  return ids
}

const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const validateMaterials = (catalog: MaterialCatalogV1, itemIds: Set<number>): string | null => {
  for (const servant of catalog.servants) {
    const records = catalog.materials[servant.id]
    if (!records) return `missing materials for servant ${servant.id}`
    const invalid = Object.values(records)
      .flatMap(levels => Object.values(levels))
      .flatMap(level => [
        isFiniteNonNegative(level.qp) ? null : 'invalid qp',
        ...level.items.map(({ item, amount }) => {
          if (!itemIds.has(item.id)) return `unknown material item ${item.id}`
          return isFiniteNonNegative(amount) ? null : 'invalid material amount'
        }),
      ])
      .find((reason): reason is string => reason !== null)
    if (invalid) return invalid
  }
  return null
}

export const validateMaterialCatalog = (
  catalog: MaterialCatalogV1,
  previous?: MaterialCatalogV1
): { ok: true } | { ok: false; reason: string } => {
  if (catalog.schemaVersion !== MATERIAL_CATALOG_SCHEMA_VERSION) return { ok: false, reason: 'unsupported schema version' }
  if (!catalog.servants.length || !catalog.items.length) return { ok: false, reason: 'servants or items is empty' }
  if (!isFiniteNonNegative(catalog.updatedAt)) return { ok: false, reason: 'updatedAt is invalid' }
  if (new Set(catalog.servants.map(servant => servant.id)).size !== catalog.servants.length) return { ok: false, reason: 'duplicate servant id' }
  if (new Set(catalog.items.map(item => item.id)).size !== catalog.items.length) return { ok: false, reason: 'duplicate item id' }
  if (previous && catalog.servants.length < previous.servants.length * 0.8) return { ok: false, reason: 'servant count dropped unexpectedly' }
  const itemIds = new Set(catalog.items.map(item => item.id))
  const materialError = validateMaterials(catalog, itemIds)
  if (materialError) return { ok: false, reason: materialError }
  if (new TextEncoder().encode(JSON.stringify(catalog)).byteLength > MATERIAL_CATALOG_MAX_BYTES) return { ok: false, reason: 'catalog exceeds size limit' }
  return { ok: true }
}

export const isMaterialClassName = (value: string): value is ClassName =>
  [
    'saber', 'archer', 'lancer', 'rider', 'caster', 'assassin', 'berserker',
    'shielder', 'ruler', 'avenger', 'alterEgo', 'moonCancer', 'foreigner',
    'pretender', 'beast', 'beastEresh', 'unBeastOlgaMarie',
  ].includes(value)

export const MATERIAL_CLASS_NAMES: ClassName[] = [
  'saber', 'archer', 'lancer', 'rider', 'caster', 'assassin', 'berserker',
  'shielder', 'ruler', 'avenger', 'alterEgo', 'moonCancer', 'foreigner',
  'pretender', 'beast', 'beastEresh', 'unBeastOlgaMarie',
]

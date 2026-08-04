import type { ClassName, Item, MaterialsKey, NiceServant } from '../interfaces/atlas-academy'
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

export const MATERIAL_CLASS_NAMES: ClassName[] = [
  'saber', 'archer', 'lancer', 'rider', 'caster', 'assassin', 'berserker',
  'shielder', 'ruler', 'avenger', 'alterEgo', 'moonCancer', 'foreigner',
  'pretender', 'beast', 'beastEresh', 'unBeastOlgaMarie',
]

export const isMaterialClassName = (value: string): value is ClassName =>
  MATERIAL_CLASS_NAMES.includes(value as ClassName)

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
  return faces?.ascension?.['1'] ?? faces?.ascension?.['0'] ?? Object.values(faces?.ascension ?? {})[0] ?? null
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

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isDisplayString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const servantDisplayError = (servant: unknown): string | null => {
  if (!isRecord(servant)) return 'invalid servant display fields'
  if (!isPositiveInteger(servant.id) || !isDisplayString(servant.name)) return 'invalid servant display fields'
  if (typeof servant.className !== 'string' || !isMaterialClassName(servant.className)) return 'invalid servant display fields'
  if (!isPositiveInteger(servant.collectionNo) || !isFiniteNonNegative(servant.rarity)) return 'invalid servant display fields'
  return servant.face === null || isDisplayString(servant.face) ? null : 'invalid servant display fields'
}

const itemDisplayError = (item: unknown): string | null => {
  if (!isRecord(item)) return 'invalid item display fields'
  if (!isPositiveInteger(item.id) || !isDisplayString(item.name) || !isDisplayString(item.icon)) {
    return 'invalid item display fields'
  }
  return null
}

const displayFieldsError = (catalog: MaterialCatalogV1): string | null => {
  for (const servant of catalog.servants) {
    const error = servantDisplayError(servant)
    if (error) return error
  }
  for (const item of catalog.items) {
    const error = itemDisplayError(item)
    if (error) return error
  }
  return null
}

const REQUIRED_MATERIAL_TABLES: MaterialsKey[] = [
  'ascensionMaterials',
  'skillMaterials',
  'appendSkillMaterials',
]

const isMaterialLevelKey = (value: string): boolean => /^(0|[1-9]\d*)$/.test(value)

const materialEntryError = (material: unknown, itemIds: Set<number>): string | null => {
  if (!material || typeof material !== 'object' || !('item' in material) || !('amount' in material)) {
    return 'invalid material item'
  }
  const { item, amount } = material
  if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'number') {
    return 'invalid material item'
  }
  if (!itemIds.has(item.id)) return `unknown material item ${item.id}`
  return isFiniteNonNegative(amount) ? null : 'invalid material amount'
}

const materialLevelError = (
  levelKey: string,
  level: unknown,
  tableKey: MaterialsKey,
  servantId: number,
  itemIds: Set<number>
): string | null => {
  if (!isMaterialLevelKey(levelKey)) return `invalid material level ${tableKey}.${levelKey} for servant ${servantId}`
  if (!level || typeof level !== 'object' || Array.isArray(level) || !('qp' in level) || !('items' in level) || !Array.isArray(level.items)) {
    return `invalid material level ${tableKey}.${levelKey} for servant ${servantId}`
  }
  if (!isFiniteNonNegative(level.qp)) return 'invalid qp'
  for (const material of level.items) {
    const error = materialEntryError(material, itemIds)
    if (error) return error
  }
  return null
}

const materialTableError = (
  table: unknown,
  tableKey: MaterialsKey,
  servantId: number,
  itemIds: Set<number>
): string | null => {
  if (!table) return `missing material table ${tableKey} for servant ${servantId}`
  if (typeof table !== 'object' || Array.isArray(table)) return `invalid material table ${tableKey} for servant ${servantId}`
  const levels = Object.entries(table)
  if (!levels.length) return `empty material table ${tableKey} for servant ${servantId}`
  for (const [levelKey, level] of levels) {
    const error = materialLevelError(levelKey, level, tableKey, servantId, itemIds)
    if (error) return error
  }
  return null
}

const validateMaterials = (catalog: MaterialCatalogV1, itemIds: Set<number>): string | null => {
  for (const servant of catalog.servants) {
    const records = catalog.materials[servant.id]
    if (!records) return `missing materials for servant ${servant.id}`
    for (const key of REQUIRED_MATERIAL_TABLES) {
      const error = materialTableError(Object.getOwnPropertyDescriptor(records, key)?.value, key, servant.id, itemIds)
      if (error) return error
    }
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
  const displayError = displayFieldsError(catalog)
  if (displayError) return { ok: false, reason: displayError }
  if (new Set(catalog.servants.map(servant => servant.id)).size !== catalog.servants.length) return { ok: false, reason: 'duplicate servant id' }
  if (new Set(catalog.items.map(item => item.id)).size !== catalog.items.length) return { ok: false, reason: 'duplicate item id' }
  if (previous && catalog.servants.length < previous.servants.length * 0.8) return { ok: false, reason: 'servant count dropped unexpectedly' }
  const itemIds = new Set(catalog.items.map(item => item.id))
  const materialError = validateMaterials(catalog, itemIds)
  if (materialError) return { ok: false, reason: materialError }
  if (new TextEncoder().encode(JSON.stringify(catalog)).byteLength > MATERIAL_CATALOG_MAX_BYTES) return { ok: false, reason: 'catalog exceeds size limit' }
  return { ok: true }
}

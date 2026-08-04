import { describe, expect, it } from 'vitest'
import { buildMaterialCatalog, materialCatalogFingerprint, validateMaterialCatalog } from './material-catalog'
import { makeItem, makeMaterials, makeServant } from '../components/material/test-fixtures'

const createCatalog = () =>
  buildMaterialCatalog({
    servants: [makeServant({ id: 1, extraAssets: { faces: { ascension: { '0': 'face.png' } }, charaGraph: {} } })],
    materials: { 1: makeMaterials() },
    items: [makeItem({ id: 100 }), makeItem({ id: 200 }), makeItem({ id: 300 }), makeItem({ id: 400 }), makeItem({ id: 500 })],
    sources: { niceServant: { etag: 'servant' }, niceItem: { lastModified: 'today' } },
    updatedAt: 1,
  })

describe('Material Catalog', () => {
  it('projects a servant face and omits unused Atlas assets', () => {
    const catalog = createCatalog()
    expect(catalog.servants[0]).toEqual({
      id: 1, name: 'サーヴァントA', className: 'saber', collectionNo: 1, rarity: 5, face: 'face.png',
    })
    expect(JSON.stringify(catalog)).not.toContain('charaGraph')
  })

  it('rejects an item reference that cannot be displayed', () => {
    const catalog = createCatalog()
    catalog.materials[1].ascensionMaterials['0'].items[0].item.id = 999
    expect(validateMaterialCatalog(catalog)).toEqual({ ok: false, reason: 'unknown material item 999' })
  })

  it('rejects catalogs with missing or empty material tables', () => {
    const missingTable = createCatalog()
    Reflect.deleteProperty(missingTable.materials[1], 'appendSkillMaterials')
    expect(validateMaterialCatalog(missingTable)).toEqual({
      ok: false,
      reason: 'missing material table appendSkillMaterials for servant 1',
    })

    const emptyTable = createCatalog()
    emptyTable.materials[1].skillMaterials = {}
    expect(validateMaterialCatalog(emptyTable)).toEqual({
      ok: false,
      reason: 'empty material table skillMaterials for servant 1',
    })

    const malformedLevel = createCatalog()
    malformedLevel.materials[1].skillMaterials = {
      invalid: malformedLevel.materials[1].skillMaterials['1'],
    }
    expect(validateMaterialCatalog(malformedLevel)).toEqual({
      ok: false,
      reason: 'invalid material level skillMaterials.invalid for servant 1',
    })
  })

  it('rejects a degrading catalog instead of replacing last-known-good', () => {
    const prior = createCatalog()
    const candidate = { ...createCatalog(), servants: [] }
    expect(validateMaterialCatalog(candidate, prior).ok).toBe(false)
  })

  it('ignores timestamps and source validators when comparing semantic content', () => {
    const first = createCatalog()
    const second = { ...createCatalog(), updatedAt: 2, sources: { niceServant: {}, niceItem: {} } }
    expect(materialCatalogFingerprint(first)).toBe(materialCatalogFingerprint(second))
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildMaterialCatalog,
  materialCatalogFingerprint,
  validateMaterialCatalog,
} from './material-catalog'
import {
  makeCompleteMaterials,
  makeItem,
  makeServant,
} from '../components/material/test-fixtures'

const createCatalog = (
  servant = makeServant({
    id: 1,
    extraAssets: { faces: { ascension: { '0': 'face.png' } }, charaGraph: {} },
  }),
) =>
  buildMaterialCatalog({
    servants: [servant],
    materials: Object.fromEntries([[servant.id, makeCompleteMaterials()]]),
    items: [
      makeItem({ id: 100 }),
      makeItem({ id: 200 }),
      makeItem({ id: 300 }),
      makeItem({ id: 400 }),
      makeItem({ id: 500 }),
    ],
    sources: {
      niceServant: { etag: 'servant' },
      niceItem: { lastModified: 'today' },
    },
    updatedAt: 1,
  })

describe('Material Catalog', () => {
  it('projects a servant face and omits unused Atlas assets', () => {
    const catalog = createCatalog(
      makeServant({
        id: 1,
        extraAssets: {
          faces: { ascension: { '0': 'first.png', '1': 'face.png' } },
          charaGraph: {},
        },
      }),
    )
    expect(catalog.servants[0]).toEqual({
      id: 1,
      name: 'サーヴァントA',
      className: 'saber',
      collectionNo: 1,
      rarity: 5,
      face: 'face.png',
    })
    expect(JSON.stringify(catalog)).not.toContain('charaGraph')
  })

  it('rejects an item reference that cannot be displayed', () => {
    const catalog = createCatalog()
    catalog.materials[1].ascensionMaterials['0'].items[0].item.id = 999
    expect(validateMaterialCatalog(catalog)).toEqual({
      ok: false,
      reason: 'unknown material item 999',
    })
  })

  it('rejects catalogs with invalid display fields', () => {
    const blankServantName = createCatalog()
    blankServantName.servants[0].name = ''
    expect(validateMaterialCatalog(blankServantName)).toEqual({
      ok: false,
      reason: 'invalid servant display fields',
    })

    const invalidClassName = createCatalog()
    Reflect.set(invalidClassName.servants[0], 'className', 'unknown')
    expect(validateMaterialCatalog(invalidClassName)).toEqual({
      ok: false,
      reason: 'invalid servant display fields',
    })

    const invalidFace = createCatalog()
    Reflect.set(invalidFace.servants[0], 'face', 1)
    expect(validateMaterialCatalog(invalidFace)).toEqual({
      ok: false,
      reason: 'invalid servant display fields',
    })

    const blankItemIcon = createCatalog()
    blankItemIcon.items[0].icon = ''
    expect(validateMaterialCatalog(blankItemIcon)).toEqual({
      ok: false,
      reason: 'invalid item display fields',
    })
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

    const missingRequiredLevel = createCatalog()
    Reflect.deleteProperty(missingRequiredLevel.materials[1].skillMaterials, '2')
    expect(validateMaterialCatalog(missingRequiredLevel)).toEqual({
      ok: false,
      reason: 'missing material level skillMaterials.2 for servant 1',
    })

    const unexpectedLevel = createCatalog()
    unexpectedLevel.materials[1].appendSkillMaterials['10'] =
      unexpectedLevel.materials[1].appendSkillMaterials['9']
    expect(validateMaterialCatalog(unexpectedLevel)).toEqual({
      ok: false,
      reason: 'unexpected material level appendSkillMaterials.10 for servant 1',
    })
  })

  it('allows Mash alone to omit ascension materials', () => {
    const mash = createCatalog(makeServant({ id: 800100 }))
    mash.materials[800100].ascensionMaterials = {}
    expect(validateMaterialCatalog(mash)).toEqual({ ok: true })

    const incompleteMash = createCatalog(makeServant({ id: 800100 }))
    incompleteMash.materials[800100].ascensionMaterials = {
      '0': incompleteMash.materials[800100].ascensionMaterials['0'],
    }
    expect(validateMaterialCatalog(incompleteMash)).toEqual({
      ok: false,
      reason: 'missing material level ascensionMaterials.1 for servant 800100',
    })
  })

  it('rejects a degrading catalog instead of replacing last-known-good', () => {
    const prior = createCatalog()
    const candidate = { ...createCatalog(), servants: [] }
    expect(validateMaterialCatalog(candidate, prior).ok).toBe(false)
  })

  it('rejects candidates whose material entries or projected items shrink unexpectedly', () => {
    const prior = createCatalog()

    const missingMaterialEntries = createCatalog()
    for (const table of Object.values(missingMaterialEntries.materials[1])) {
      for (const level of Object.values(table)) level.items = []
    }
    expect(validateMaterialCatalog(missingMaterialEntries, prior)).toEqual({
      ok: false,
      reason: 'material entry count dropped unexpectedly',
    })

    const missingProjectedItems = createCatalog()
    for (const table of Object.values(missingProjectedItems.materials[1])) {
      for (const level of Object.values(table)) {
        for (const entry of level.items) entry.item.id = 100
      }
    }
    missingProjectedItems.items = [missingProjectedItems.items[0]]
    expect(validateMaterialCatalog(missingProjectedItems, prior)).toEqual({
      ok: false,
      reason: 'projected item count dropped unexpectedly',
    })
  })

  it('ignores timestamps and source validators when comparing semantic content', () => {
    const first = createCatalog()
    const second = {
      ...createCatalog(),
      updatedAt: 2,
      sources: { niceServant: {}, niceItem: {} },
    }
    expect(materialCatalogFingerprint(first)).toBe(
      materialCatalogFingerprint(second),
    )
  })
})

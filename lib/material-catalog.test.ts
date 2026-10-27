import { describe, expect, it } from 'vitest'
import {
  buildMaterialCatalog,
  distillBondUpCraftEssences,
  isValidBondGrowth,
  materialCatalogFingerprint,
  validateMaterialCatalog,
} from './material-catalog'
import {
  makeBondUpCraftEssence,
  makeCompleteMaterials,
  makeItem,
  makeNiceEquip,
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
    bondUpCraftEssences: [makeBondUpCraftEssence()],
    sources: {
      niceServant: { etag: 'servant' },
      niceItem: { lastModified: 'today' },
    },
    updatedAt: 1,
  })

const forEachMaterialLevel = (
  catalog: ReturnType<typeof createCatalog>,
  visit: (level: { items: { item: { id: number }; amount: number }[]; qp: number }) => void,
) => {
  for (const table of Object.values(catalog.materials[1])) {
    for (const level of Object.values(table)) visit(level)
  }
}

const doubleMaterialEntries = (catalog: ReturnType<typeof createCatalog>) =>
  forEachMaterialLevel(catalog, level => {
    level.items.push(...level.items.map(entry => ({ ...entry, item: { ...entry.item } })))
  })

const setMaterialAmounts = (catalog: ReturnType<typeof createCatalog>, amount: number) =>
  forEachMaterialLevel(catalog, level => {
    for (const entry of level.items) entry.amount = amount
  })

const setQp = (catalog: ReturnType<typeof createCatalog>, qp: number) =>
  forEachMaterialLevel(catalog, level => {
    level.qp = qp
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
      eventBonuses: [],
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

  it('rejects zero material quantities and QP', () => {
    const zeroAmount = createCatalog()
    zeroAmount.materials[1].ascensionMaterials['0'].items[0].amount = 0
    expect(validateMaterialCatalog(zeroAmount)).toEqual({
      ok: false,
      reason: 'invalid material amount',
    })

    const zeroQp = createCatalog()
    zeroQp.materials[1].ascensionMaterials['0'].qp = 0
    expect(validateMaterialCatalog(zeroQp)).toEqual({
      ok: false,
      reason: 'invalid qp',
    })

    const emptyItems = createCatalog()
    emptyItems.materials[1].skillMaterials['1'].items = []
    expect(validateMaterialCatalog(emptyItems)).toEqual({
      ok: false,
      reason: 'empty material level skillMaterials.1 for servant 1',
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

    const unexpectedAppendUnlockLevel = createCatalog()
    unexpectedAppendUnlockLevel.materials[1].appendSkillMaterials['0'] =
      unexpectedAppendUnlockLevel.materials[1].appendSkillMaterials['1']
    expect(validateMaterialCatalog(unexpectedAppendUnlockLevel)).toEqual({
      ok: false,
      reason: 'unexpected material level appendSkillMaterials.0 for servant 1',
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
    const entryPrior = createCatalog()
    doubleMaterialEntries(entryPrior)

    const fewerMaterialEntries = createCatalog()
    expect(validateMaterialCatalog(fewerMaterialEntries, entryPrior)).toEqual({
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

    const smallerMaterialQuantities = createCatalog()
    setMaterialAmounts(smallerMaterialQuantities, 1)
    expect(validateMaterialCatalog(smallerMaterialQuantities, prior)).toEqual({
      ok: false,
      reason: 'material quantity dropped unexpectedly',
    })

    const smallerQp = createCatalog()
    setQp(smallerQp, 1)
    expect(validateMaterialCatalog(smallerQp, prior)).toEqual({
      ok: false,
      reason: 'QP total dropped unexpectedly',
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

describe('isValidBondGrowth', () => {
  it.each([
    ['monotonic 16 levels', Array.from({ length: 16 }, (_, i) => (i + 1) * 1000), true],
    ['single level', [1000], true],
    ['equal neighbours are non-decreasing', [1000, 1000, 2000], true],
    ['empty array', [], false],
    ['not an array', undefined, false],
    ['zero', [0, 1000], false],
    ['negative value', [1000, -1], false],
    ['NaN', [1000, Number.NaN], false],
    ['Infinity', [1000, Number.POSITIVE_INFINITY], false],
    ['non-number', [1000, '2000'], false],
    ['decreasing', [1000, 3000, 2000], false],
  ])('%s', (_label, value, expected) => {
    expect(isValidBondGrowth(value)).toBe(expected)
  })
})

describe('Material Catalog bondGrowth', () => {
  const withBond = (id: number, bondGrowth: unknown) =>
    ({
      ...makeServant({
        id,
        collectionNo: id,
        extraAssets: { faces: { ascension: { '0': 'face.png' } }, charaGraph: {} },
      }),
      bondGrowth,
    }) as ReturnType<typeof makeServant>

  it('distills valid bondGrowth and omits invalid values without rejecting the catalog', () => {
    const catalog = buildMaterialCatalog({
      servants: [withBond(1, [1000, 3000]), withBond(2, [1000, -5]), withBond(3, undefined)],
      materials: { 1: makeCompleteMaterials(), 2: makeCompleteMaterials(), 3: makeCompleteMaterials() },
      items: [100, 200, 300, 400, 500].map(id => makeItem({ id })),
      bondUpCraftEssences: [makeBondUpCraftEssence()],
      sources: { niceServant: {}, niceItem: {} },
      updatedAt: 1,
    })
    expect(catalog.servants[0].bondGrowth).toEqual([1000, 3000])
    expect(catalog.servants[1]).not.toHaveProperty('bondGrowth')
    expect(catalog.servants[2]).not.toHaveProperty('bondGrowth')
    expect(validateMaterialCatalog(catalog)).toEqual({ ok: true })
  })

  it('keeps bondGrowth when rebuilding from an already distilled catalog', () => {
    const first = createCatalog(withBond(1, [1000, 3000]))
    const rebuilt = buildMaterialCatalog({ ...first, servants: first.servants })
    expect(rebuilt.servants[0].bondGrowth).toEqual([1000, 3000])
  })
})

describe('Material Catalog cost', () => {
  const withCost = (id: number, cost: unknown) =>
    ({ ...makeServant({ id, collectionNo: id }), cost }) as ReturnType<typeof makeServant>

  it('distills a non-negative integer cost and omits invalid costs without rejecting the catalog', () => {
    const servants = [withCost(1, 16), withCost(2, 0), withCost(3, undefined), withCost(4, -1), withCost(5, 1.5)]
    const catalog = buildMaterialCatalog({
      servants,
      materials: Object.fromEntries(servants.map(servant => [servant.id, makeCompleteMaterials()])),
      items: [100, 200, 300, 400, 500].map(id => makeItem({ id })),
      bondUpCraftEssences: [makeBondUpCraftEssence()],
      sources: { niceServant: {}, niceItem: {} },
      updatedAt: 1,
    })
    expect(catalog.servants.map(servant => servant.cost)).toEqual([16, 0, undefined, undefined, undefined])
    expect(catalog.servants[2]).not.toHaveProperty('cost')
    expect(validateMaterialCatalog(catalog)).toEqual({ ok: true })
  })

  it('keeps cost when rebuilding from an already distilled catalog', () => {
    const first = createCatalog(withCost(1, 16))
    const rebuilt = buildMaterialCatalog({ ...first, servants: first.servants })
    expect(rebuilt.servants[0].cost).toBe(16)
  })
})

describe('distillBondUpCraftEssences', () => {
  const fn = (
    funcTargetType: string,
    sval: { RateCount?: number; AddCount?: number; EventId?: number; Individuality?: number },
    funcType = 'servantFriendshipUp',
  ) => ({ funcType, funcTargetType, svals: [sval] })

  it('reads the party rate of the max limit-break step', () => {
    const [essence] = distillBondUpCraftEssences([
      makeNiceEquip({
        id: 9402000,
        collectionNo: 200,
        name: 'カルデア・ランチタイム',
        rarity: 5,
        cost: 12,
        extraAssets: { faces: { equip: { '9402000': 'f_9402000.png' } } },
        skills: [
          { condLimitCount: 0, functions: [fn('ptFull', { RateCount: 20 })] },
          { condLimitCount: 4, functions: [fn('ptFull', { RateCount: 100 })] },
        ],
      }),
    ])
    expect(essence).toEqual({
      id: 9402000,
      collectionNo: 200,
      name: 'カルデア・ランチタイム',
      rarity: 5,
      cost: 12,
      face: 'f_9402000.png',
      target: 'party',
      rate: 100,
      add: 0,
    })
  })

  it('reads a self fixed amount that does not change on limit break and ignores a self rate', () => {
    const [essence] = distillBondUpCraftEssences([
      makeNiceEquip({
        cost: 5,
        skills: [{ condLimitCount: 0, functions: [fn('self', { AddCount: 50, RateCount: 100 })] }],
      }),
    ])
    expect(essence).toMatchObject({ target: 'self', rate: 0, add: 50, cost: 5 })
  })

  it('reads the last sval and sums functions of the same target', () => {
    const [essence] = distillBondUpCraftEssences([
      makeNiceEquip({
        skills: [{
          condLimitCount: 0,
          functions: [
            { funcType: 'servantFriendshipUp', funcTargetType: 'ptFull', svals: [{ RateCount: 10 }, { RateCount: 30 }] },
            fn('ptFull', { AddCount: 50 }),
            fn('ptFull', { Value: 100 } as never, 'addState'),
          ],
        }],
      }),
    ])
    expect(essence).toMatchObject({ target: 'party', rate: 30, add: 50 })
  })

  it.each([
    ['an event-limited effect only', [fn('ptFull', { RateCount: 200, EventId: 80001 })]],
    ['a trait-limited effect only', [fn('ptFull', { RateCount: 200, Individuality: 2000 })]],
    ['an effect with no value', [fn('ptFull', {})]],
    ['an unsupported target only', [fn('enemy', { RateCount: 200 })]],
    ['mixed party and self effects', [fn('ptFull', { RateCount: 200 }), fn('self', { AddCount: 50 })]],
    ['no bond effect', [fn('ptFull', { RateCount: 200 }, 'gainNp')]],
  ])('excludes an essence with %s', (_label, functions) => {
    expect(distillBondUpCraftEssences([makeNiceEquip({ skills: [{ condLimitCount: 0, functions }] })])).toEqual([])
  })

  it('keeps the remaining permanent effect when an event-limited one is dropped', () => {
    const [essence] = distillBondUpCraftEssences([
      makeNiceEquip({
        skills: [{
          condLimitCount: 0,
          functions: [fn('ptFull', { RateCount: 200, EventId: 80001 }), fn('ptFull', { AddCount: 50 })],
        }],
      }),
    ])
    expect(essence).toMatchObject({ rate: 0, add: 50 })
  })

  it('orders essences by collection number', () => {
    const essences = distillBondUpCraftEssences([
      makeNiceEquip({ id: 3, collectionNo: 30 }),
      makeNiceEquip({ id: 1, collectionNo: 10 }),
    ])
    expect(essences.map(essence => essence.collectionNo)).toEqual([10, 30])
  })
})

describe('Material Catalog bond-up craft essence validation', () => {
  it.each([
    ['a zero cost', { cost: 0 }],
    ['a non-integer cost', { cost: 1.5 }],
    ['zero rate and amount', { rate: 0, add: 0 }],
    ['a negative rate', { rate: -10, add: 50 }],
    ['an infinite amount', { add: Number.POSITIVE_INFINITY }],
    ['a blank name', { name: ' ' }],
    ['a blank face', { face: '' }],
  ])('rejects %s', (_label, overrides) => {
    const catalog = createCatalog()
    catalog.bondUpCraftEssences = [makeBondUpCraftEssence(overrides)]
    expect(validateMaterialCatalog(catalog)).toEqual({ ok: false, reason: 'invalid bond-up craft essence' })
  })

  it('rejects duplicate ids', () => {
    const catalog = createCatalog()
    catalog.bondUpCraftEssences = [makeBondUpCraftEssence(), makeBondUpCraftEssence({ collectionNo: 2 })]
    expect(validateMaterialCatalog(catalog)).toEqual({ ok: false, reason: 'duplicate bond-up craft essence id' })
  })

  it.each([
    ['empty', []],
    ['missing', undefined],
  ])('rejects a %s list', (_label, essences) => {
    const catalog = createCatalog()
    catalog.bondUpCraftEssences = essences
    expect(validateMaterialCatalog(catalog)).toEqual({ ok: false, reason: 'bond-up craft essences is empty' })
  })

  it('rejects a list that shrinks by more than 20%', () => {
    const essences = (count: number) =>
      Array.from({ length: count }, (_, i) => makeBondUpCraftEssence({ id: i + 1, collectionNo: i + 1 }))
    const prior = createCatalog()
    prior.bondUpCraftEssences = essences(10)
    const shrunk = createCatalog()
    shrunk.bondUpCraftEssences = essences(7)
    expect(validateMaterialCatalog(shrunk, prior)).toEqual({
      ok: false,
      reason: 'bond-up craft essence count dropped unexpectedly',
    })
    const kept = createCatalog()
    kept.bondUpCraftEssences = essences(8)
    expect(validateMaterialCatalog(kept, prior)).toEqual({ ok: true })
  })

  it('treats a change in bond-up craft essences as a semantic change', () => {
    const first = createCatalog()
    const second = createCatalog()
    second.bondUpCraftEssences = [makeBondUpCraftEssence({ rate: 100 })]
    expect(materialCatalogFingerprint(first)).not.toBe(materialCatalogFingerprint(second))
  })
})

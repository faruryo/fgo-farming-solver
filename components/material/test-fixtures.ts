// Shared fixture factories for components/material/*.test.tsx.
// Not a *.test.ts(x) file itself, so vitest does not pick it up as a suite.
import { NiceServant, Item } from '../../interfaces/atlas-academy'
import { ReducedMaterialsRecord } from '../../lib/get-materials'

export const makeServant = (overrides: Partial<NiceServant> = {}): NiceServant => ({
  id: 1,
  collectionNo: 1,
  name: 'サーヴァントA',
  type: 'normal',
  flag: 'normal',
  className: 'saber',
  attribute: 'human',
  rarity: 5,
  extraAssets: { faces: {}, charaGraph: {} },
  // Full (unreduced) material records are part of the NiceServant type but
  // unused by the components under test — the `materials` prop (a separate
  // ReducedMaterialsRecord map) is what actually drives diff calculations.
  ascensionMaterials: {},
  skillMaterials: {},
  appendSkillMaterials: {},
  ...overrides,
})

export const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 100,
  name: '灯火の焔',
  type: 'ascension',
  uses: 'ascension',
  detail: '',
  icon: 'Item100',
  background: 'bronze',
  priority: 1,
  dropPriority: 1,
  ...overrides,
})

/**
 * A small but non-trivial material table:
 * - ascension: step 0 needs 4x item 100 + 1x item 200 (+ QP); step 1 needs 8x item 100 (+ QP)
 * - skill: step 1 needs 5x item 400 (+ QP)
 * - appendSkill: step 0 needs 3x item 500 (+ QP)
 */
export const makeMaterials = (): ReducedMaterialsRecord => ({
  ascensionMaterials: {
    '0': { items: [{ item: { id: 100 }, amount: 4 }, { item: { id: 200 }, amount: 1 }], qp: 50000 },
    '1': { items: [{ item: { id: 100 }, amount: 8 }], qp: 100000 },
    '2': { items: [{ item: { id: 300 }, amount: 2 }], qp: 300000 },
    '3': { items: [{ item: { id: 100 }, amount: 12 }], qp: 900000 },
  },
  skillMaterials: {
    '1': { items: [{ item: { id: 400 }, amount: 5 }], qp: 20000 },
    '2': { items: [{ item: { id: 400 }, amount: 5 }], qp: 40000 },
  },
  appendSkillMaterials: {
    '0': { items: [{ item: { id: 500 }, amount: 3 }], qp: 10000 },
    '1': { items: [{ item: { id: 500 }, amount: 5 }], qp: 20000 },
  },
})

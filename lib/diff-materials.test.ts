import { describe, it, expect } from 'vitest'
import { diffMaterialsForStartChange } from './diff-materials'
import { ReducedMaterialsRecord } from './get-materials'

const mat: ReducedMaterialsRecord = {
  ascensionMaterials: {
    '0': {
      items: [
        { item: { id: 100 }, amount: 4 },
        { item: { id: 200 }, amount: 1 },
      ],
      qp: 50000,
    },
    '1': {
      items: [{ item: { id: 100 }, amount: 8 }],
      qp: 100000,
    },
    '2': {
      items: [{ item: { id: 300 }, amount: 2 }],
      qp: 300000,
    },
    '3': {
      items: [{ item: { id: 100 }, amount: 12 }],
      qp: 900000,
    },
  },
  skillMaterials: {
    '1': { items: [{ item: { id: 400 }, amount: 5 }], qp: 20000 },
    '2': { items: [{ item: { id: 400 }, amount: 5 }], qp: 40000 },
  },
  appendSkillMaterials: {
    '0': { items: [{ item: { id: 500 }, amount: 3 }], qp: 10000 },
    '1': { items: [{ item: { id: 500 }, amount: 5 }], qp: 20000 },
  },
}

describe('diffMaterialsForStartChange', () => {
  it('returns null when prev === new (no-op)', () => {
    expect(diffMaterialsForStartChange(mat, 'ascension', 1, 1)).toBeNull()
  })

  it('returns null when servantMaterials is undefined', () => {
    expect(diffMaterialsForStartChange(undefined, 'ascension', 0, 1)).toBeNull()
  })

  it('computes consume for ascension single step', () => {
    const delta = diffMaterialsForStartChange(mat, 'ascension', 1, 2)
    expect(delta).not.toBeNull()
    expect(delta!.direction).toBe('consume')
    expect(delta!.stepLow).toBe(1)
    expect(delta!.stepHigh).toBe(2)
    const map = Object.fromEntries(delta!.items.map((i) => [i.itemId, i.amount]))
    expect(map['100']).toBe(8)
    expect(map['1']).toBe(100000)
  })

  it('computes return when newStart < prevStart', () => {
    const delta = diffMaterialsForStartChange(mat, 'ascension', 2, 1)
    expect(delta).not.toBeNull()
    expect(delta!.direction).toBe('return')
    expect(delta!.stepLow).toBe(1)
    expect(delta!.stepHigh).toBe(2)
    const map = Object.fromEntries(delta!.items.map((i) => [i.itemId, i.amount]))
    expect(map['100']).toBe(8)
    expect(map['1']).toBe(100000)
  })

  it('aggregates multi-step jumps', () => {
    const delta = diffMaterialsForStartChange(mat, 'ascension', 0, 4)
    expect(delta).not.toBeNull()
    const map = Object.fromEntries(delta!.items.map((i) => [i.itemId, i.amount]))
    // steps 0,1,2,3 → item 100: 4+8+0+12=24; item 200: 1; item 300: 2; QP: 50000+100000+300000+900000
    expect(map['100']).toBe(24)
    expect(map['200']).toBe(1)
    expect(map['300']).toBe(2)
    expect(map['1']).toBe(1350000)
  })

  it('uses skillMaterials for skill target', () => {
    const delta = diffMaterialsForStartChange(mat, 'skill', 1, 3)
    expect(delta).not.toBeNull()
    const map = Object.fromEntries(delta!.items.map((i) => [i.itemId, i.amount]))
    expect(map['400']).toBe(10)
    expect(map['1']).toBe(60000)
  })

  it('uses appendSkillMaterials for appendSkill target', () => {
    const delta = diffMaterialsForStartChange(mat, 'appendSkill', 0, 2)
    expect(delta).not.toBeNull()
    const map = Object.fromEntries(delta!.items.map((i) => [i.itemId, i.amount]))
    expect(map['500']).toBe(8)
    expect(map['1']).toBe(30000)
  })
})

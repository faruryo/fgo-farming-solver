import { describe, expect, it } from 'vitest'
import { applyViewPatch, DEFAULT_MATERIAL_VIEW, hasViewFilter, parseMaterialView } from './material-view'

describe('parseMaterialView', () => {
  it('keeps valid values', () => {
    const v = { class: 'saber', rarities: [5, 4], servantFilter: 'hide-unowned', sortMode: 'new' }
    expect(parseMaterialView(v)).toEqual(v)
  })

  it('falls back per field for unknown values', () => {
    expect(parseMaterialView({ class: 'gone', rarities: [5, 9, '4', 5], servantFilter: 'x', sortMode: 'new' }))
      .toEqual({ ...DEFAULT_MATERIAL_VIEW, rarities: [5], sortMode: 'new' })
  })

  it('returns defaults for broken storage', () => {
    for (const item of [null, 'str', [1], undefined]) expect(parseMaterialView(item)).toEqual(DEFAULT_MATERIAL_VIEW)
  })
})

describe('hasViewFilter', () => {
  it('ignores sort order', () => {
    expect(hasViewFilter({ ...DEFAULT_MATERIAL_VIEW, sortMode: 'new' })).toBe(false)
    expect(hasViewFilter({ ...DEFAULT_MATERIAL_VIEW, rarities: [5] })).toBe(true)
  })
})

describe('applyViewPatch', () => {
  const saved = { ...DEFAULT_MATERIAL_VIEW, class: 'saber' as const, sortMode: 'new' as const }
  it('patches the saved view normally', () => {
    expect(applyViewPatch(false, saved, () => ({ rarities: [5] }))).toEqual({ ...saved, rarities: [5] })
  })
  it('patches from defaults while overridden by #svt jump', () => {
    expect(applyViewPatch(true, saved, () => ({ rarities: [5] }))).toEqual({ ...DEFAULT_MATERIAL_VIEW, rarities: [5] })
  })
})

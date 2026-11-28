// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChaldeaState } from './create-chaldea-state'
import { useRequiredMaterials } from './use-required-materials'

// 素材データの取得の共有（loadMaterialCatalog）を本物のまま使い、fetch の回数を数える。
const catalog = {
  schemaVersion: 1,
  updatedAt: 1,
  sources: {},
  servants: [],
  items: [],
  materials: {
    '1': {
      ascensionMaterials: { '0': { items: [{ item: { id: 6001 }, amount: 5 }], qp: 1000 } },
      skillMaterials: {},
      appendSkillMaterials: {},
    },
  },
}

describe('useRequiredMaterials の素材データの取得', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('同じ画面で複数の部品が使っても、素材データの取得は1回', async () => {
    const state = createChaldeaState(['1'])
    state['1'].disabled = false
    state['1'].targets.ascension.ranges = [{ start: 0, end: 1 }]
    state['1'].targets.skill.disabled = true
    state['1'].targets.appendSkill.disabled = true
    localStorage.setItem('material', JSON.stringify(state))
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(catalog), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => [useRequiredMaterials(), useRequiredMaterials(), useRequiredMaterials()])
    await waitFor(() => expect(result.current.every((r) => r.total['6001'] === 5)).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('material/servant-result') ?? 'null')).toEqual({ '6001': 5, '1': 1000 })
  })
})

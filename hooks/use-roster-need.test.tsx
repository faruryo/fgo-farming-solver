// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaterialsForServants } from '../lib/get-materials'
import type { MaterialCatalogV1 } from '../lib/material-catalog'
import { loadMaterialCatalog } from './use-material-catalog'
import { createChaldeaState, type ChaldeaState } from './create-chaldea-state'
import { toAmounts, useRosterNeed } from './use-roster-need'

vi.mock('./use-material-catalog', () => ({ loadMaterialCatalog: vi.fn() }))
const fetchMock = vi.mocked(loadMaterialCatalog)
const catalogOf = (materials: MaterialsForServants) =>
  ({ schemaVersion: 1, updatedAt: 0, sources: {}, servants: [], items: [], materials }) as unknown as MaterialCatalogV1

// 再臨 0→1 で素材 6001 ×5 と QP 1000。スキル・アペンドは対象外。
const servantMaterials = (): MaterialsForServants[string] => ({
  ascensionMaterials: { '0': { items: [{ item: { id: 6001 }, amount: 5 }], qp: 1000 } },
  skillMaterials: {},
  appendSkillMaterials: {},
})

const seedRoster = (ids: string[], extra: ChaldeaState = {}) => {
  const state = createChaldeaState(ids)
  for (const id of ids) {
    const s: ChaldeaState[string] = Reflect.get(state, id)
    s.disabled = false
    s.targets.ascension.ranges = [{ start: 0, end: 1 }]
    s.targets.skill.disabled = true
    s.targets.appendSkill.disabled = true
  }
  localStorage.setItem('material', JSON.stringify({ ...state, ...extra }))
}

describe('useRosterNeed', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.restoreAllMocks()
  })

  it('ロスター未設定なら empty で、localStorage に書き込まない', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useRosterNeed())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.status).toBe('empty')
    expect(setItem).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('全件取得できたら ready で総必要数を返す（all・disabled は要求しない）', async () => {
    seedRoster(['1', '2'], {
      all: createChaldeaState(['all']).all,
      '3': createChaldeaState(['3'])['3'],
    })
    // カタログには育成対象外の 3・4 も入っている。
    fetchMock.mockResolvedValue(
      catalogOf({ '1': servantMaterials(), '2': servantMaterials(), '3': servantMaterials(), '4': servantMaterials() }),
    )
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() => useRosterNeed())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    if (result.current.status !== 'ready') throw new Error('unreachable')
    expect(Object.keys(result.current.materialsForServants)).toEqual(['1', '2'])
    expect(toAmounts(result.current.totalNeed)).toEqual({ '6001': 10, '1': 2000 })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('カタログに無いサーヴァントがいたら error（計算しない）', async () => {
    seedRoster(['1', '2'])
    fetchMock.mockResolvedValue(catalogOf({ '1': servantMaterials() }))
    const { result } = renderHook(() => useRosterNeed())
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('取得が reject したら error', async () => {
    seedRoster(['1'])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useRosterNeed())
    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})

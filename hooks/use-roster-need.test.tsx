// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMaterialsForServantIds } from '../lib/get-materials'
import type { MaterialsForServants } from '../lib/get-materials'
import { createChaldeaState, type ChaldeaState } from './create-chaldea-state'
import { toAmounts, useRosterNeed } from './use-roster-need'

vi.mock('../lib/get-materials', () => ({ getMaterialsForServantIds: vi.fn() }))
const fetchMock = vi.mocked(getMaterialsForServantIds)

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
    fetchMock.mockResolvedValue({ '1': servantMaterials(), '2': servantMaterials() })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { result } = renderHook(() => useRosterNeed())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(fetchMock).toHaveBeenCalledWith([1, 2])
    if (result.current.status !== 'ready') throw new Error('unreachable')
    expect(toAmounts(result.current.totalNeed)).toEqual({ '6001': 10, '1': 2000 })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('一部サーヴァントの素材が欠けたら error（計算しない）', async () => {
    seedRoster(['1', '2'])
    fetchMock.mockResolvedValue({ '1': servantMaterials() })
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

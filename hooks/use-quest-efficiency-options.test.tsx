// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuestEfficiencyOptions } from './use-quest-efficiency-options'
import { loadMaterialCatalog } from './use-material-catalog'
import { servantNeedOf, catalogOf } from './required-materials-test-utils'

vi.mock('./use-material-catalog', () => ({ loadMaterialCatalog: vi.fn() }))
const catalogMock = vi.mocked(loadMaterialCatalog)

describe('useQuestEfficiencyOptions の必要数', () => {
  beforeEach(() => {
    localStorage.clear()
    catalogMock.mockReset()
  })

  it('開くと育成ぶんの移行が走り、必要数は育成ぶんとクラススコアぶんの合算になる', async () => {
    const { state, materials } = servantNeedOf({ '7001': 10 })
    localStorage.setItem('material', JSON.stringify(state))
    localStorage.setItem('material/result', JSON.stringify({ '7001': 999 }))
    localStorage.setItem('classScore', JSON.stringify({ classes: { saber: 'target' } }))
    catalogMock.mockResolvedValue(catalogOf(materials))

    const { result } = renderHook(() => useQuestEfficiencyOptions())
    await waitFor(() => expect(result.current.materialResult['7001']).toBe(150))
    expect(JSON.parse(localStorage.getItem('material/servant-result') ?? 'null')).toEqual({ '7001': 10, '1': 0 })
    // 旧値は書き換えない
    expect(localStorage.getItem('material/result')).toBe(JSON.stringify({ '7001': 999 }))
  })
})

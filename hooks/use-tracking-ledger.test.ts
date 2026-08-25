// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTrackingLedger } from './use-tracking-ledger'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import type { ShowBlockedToastParams, ShowTrackingToastParams } from '../lib/tracking-toast'
import type { MaterialCatalogItem, MaterialCatalogServant } from '../lib/material-catalog'
import type { MaterialsForServants } from '../lib/get-materials'

const showTrackingToast = vi.fn<(p: ShowTrackingToastParams) => void>()
const showBlockedToast = vi.fn<(p: ShowBlockedToastParams) => void>()

vi.mock('../lib/tracking-toast', () => ({
  showTrackingToast: (p: ShowTrackingToastParams) => showTrackingToast(p),
  showBlockedToast: (p: ShowBlockedToastParams) => showBlockedToast(p),
}))

const servant: MaterialCatalogServant = {
  id: 1,
  collectionNo: 1,
  name: 'サーヴァントA',
  className: 'saber',
  rarity: 5,
  face: '',
}

const items: MaterialCatalogItem[] = [
  { id: 100, name: '灯火の焔', icon: '100.png' },
  { id: 200, name: '蛮神の心臓', icon: '200.png' },
]

const itemsById = {
  '100': items[0],
  '200': items[1],
}

const servantsById = {
  '1': servant,
}

// Ascension 0 -> 1 costs 10 of item 100, 5 of item 200, and 1,000,000 QP (itemId 1)
const materials: MaterialsForServants = {
  '1': {
    ascensionMaterials: {
      '0': {
        items: [
          { item: { id: 100 }, amount: 10 },
          { item: { id: 200 }, amount: 5 },
        ],
        qp: 1000000,
      },
    },
    skillMaterials: {},
    appendSkillMaterials: {},
  },
}

beforeEach(() => {
  localStorage.clear()
  showTrackingToast.mockClear()
  showBlockedToast.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useTrackingLedger', () => {
  it('defaults to tracking mode OFF and allows all start changes without updating possession', () => {
    const { result } = renderHook(() =>
      useTrackingLedger({ materials, servantsById, itemsById })
    )

    expect(result.current.trackingMode).toBe(false)
    expect(result.current.hasPossessionInput).toBe(false)

    let allowed = false
    act(() => {
      allowed = result.current.checkStartChange('1', 'ascension', 0, 0, 1)
      result.current.applyStartChange('1', 'ascension', 0, 0, 1)
    })

    expect(allowed).toBe(true)
    expect(result.current.possession).toEqual({})
    expect(showTrackingToast).not.toHaveBeenCalled()
    expect(showBlockedToast).not.toHaveBeenCalled()
  })

  it('blocks start changes when tracking mode ON and items are insufficient', () => {
    localStorage.setItem(STORAGE_KEYS.TRACKING_MODE, 'true')
    localStorage.setItem(
      STORAGE_KEYS.POSSESSION,
      JSON.stringify({ '100': 5, '1': 10000000 })
    ) // shortage on 100 (has 5, needs 10) and 200 (has 0, needs 5), QP is sufficient

    const { result } = renderHook(() =>
      useTrackingLedger({ materials, servantsById, itemsById })
    )

    expect(result.current.trackingMode).toBe(true)
    expect(result.current.hasPossessionInput).toBe(true)

    let allowed = true
    act(() => {
      allowed = result.current.checkStartChange('1', 'ascension', 0, 0, 1)
    })

    expect(allowed).toBe(false)
    expect(showBlockedToast).toHaveBeenCalledTimes(1)
    expect(showBlockedToast).toHaveBeenCalledWith(
      expect.objectContaining({
        servantName: 'サーヴァントA',
        target: 'ascension',
        idx: 0,
        prevStart: 0,
        newStart: 1,
        shortageItems: [
          expect.objectContaining({ itemId: '100', owned: 5, required: 10 }),
          expect.objectContaining({ itemId: '200', owned: 0, required: 5 }),
        ],
      })
    )

    // Test the recovery callback supplied to showBlockedToast
    const calls = showBlockedToast.mock.calls as unknown as [ShowBlockedToastParams][]
    const firstCall = calls[0]
    expect(firstCall).toBeDefined()
    act(() => {
      firstCall?.[0].onSetPossession({ '100': 20, '200': 10 })
    })

    expect(result.current.possession['100']).toBe(20)
    expect(result.current.possession['200']).toBe(10)
  })

  it('consumes materials and triggers tracking toast when sufficient', () => {
    localStorage.setItem(STORAGE_KEYS.TRACKING_MODE, 'true')
    localStorage.setItem(
      STORAGE_KEYS.POSSESSION,
      JSON.stringify({ '100': 20, '200': 10, '1': 5000000 })
    )

    const { result } = renderHook(() =>
      useTrackingLedger({ materials, servantsById, itemsById })
    )

    let allowed = false
    act(() => {
      allowed = result.current.checkStartChange('1', 'ascension', 0, 0, 1)
      result.current.applyStartChange('1', 'ascension', 0, 0, 1)
    })

    expect(allowed).toBe(true)
    expect(result.current.possession['100']).toBe(10) // 20 - 10
    expect(result.current.possession['200']).toBe(5)  // 10 - 5
    expect(result.current.possession['1']).toBe(4000000) // 5M - 1M
    expect(showTrackingToast).toHaveBeenCalledTimes(1)
    expect(showTrackingToast).toHaveBeenCalledWith(
      expect.objectContaining({
        servantId: '1',
        servantName: 'サーヴァントA',
        target: 'ascension',
        prevStart: 0,
        newStart: 1,
      })
    )
  })

  it('returns materials back when reducing start (decrement/wrap back) including QP', () => {
    localStorage.setItem(STORAGE_KEYS.TRACKING_MODE, 'true')
    localStorage.setItem(STORAGE_KEYS.POSSESSION, JSON.stringify({ '100': 10, '200': 5 }))

    const { result } = renderHook(() =>
      useTrackingLedger({ materials, servantsById, itemsById })
    )

    let allowed = false
    act(() => {
      allowed = result.current.checkStartChange('1', 'ascension', 0, 1, 0)
      result.current.applyStartChange('1', 'ascension', 0, 1, 0)
    })

    expect(allowed).toBe(true)
    expect(result.current.possession).toEqual({
      '100': 20,      // 10 + 10 returned
      '200': 10,      // 5 + 5 returned
      '1': 1000000,   // 0 + 1,000,000 QP returned
    })
    expect(showTrackingToast).toHaveBeenCalledTimes(1)
  })

  it('retains hasPossessionInput = true when possession transitions from positive to zero/empty', () => {
    localStorage.setItem(STORAGE_KEYS.POSSESSION, JSON.stringify({ '100': 10 }))

    const { result } = renderHook(() =>
      useTrackingLedger({ materials, servantsById, itemsById })
    )

    expect(result.current.hasPossessionInput).toBe(true)

    act(() => {
      result.current.setPossession({ '100': 0 })
    })

    expect(result.current.hasPossessionInput).toBe(true)

    act(() => {
      result.current.setPossession({})
    })

    expect(result.current.hasPossessionInput).toBe(true)
  })
})

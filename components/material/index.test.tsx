// @vitest-environment jsdom
//
// Integration tests for the "育成記録モード" (tracking mode) behavior that
// components/material/index.tsx owns: gating possession updates on the
// mode toggle, the consume/shortage decision (checkStartChange /
// applyStartChange), and the mode-suggestion banner's visibility rules.
//
// lib/tracking-toast's diff math is already covered exhaustively by
// lib/diff-materials.test.ts; here we mock showTrackingToast/showBlockedToast
// so we can assert *when* and *with what* they're invoked, and drive the
// shortage recovery callback directly instead of rendering the real Sonner
// toast tree (which lives outside this component, at the layout level).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Index } from './index'
import { makeServant, makeItem, makeMaterials } from './test-fixtures'
import type { ShowBlockedToastParams, ShowTrackingToastParams } from '../../lib/tracking-toast'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const showTrackingToast = vi.fn<(p: ShowTrackingToastParams) => void>()
const showBlockedToast = vi.fn<(p: ShowBlockedToastParams) => void>()

vi.mock('../../lib/tracking-toast', () => ({
  showTrackingToast: (p: ShowTrackingToastParams) => showTrackingToast(p),
  showBlockedToast: (p: ShowBlockedToastParams) => showBlockedToast(p),
}))

const servant = makeServant({ id: 1, collectionNo: 1, name: 'サーヴァントA' })
const items = [
  makeItem({ id: 100, name: '灯火の焔' }),
  makeItem({ id: 200, name: '蛮神の心臓' }),
]
const materials = { '1': makeMaterials() }

const getPossession = (): Record<string, number | undefined> =>
  JSON.parse(localStorage.getItem('posession') ?? '{}')

const setLocalStorage = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value))

/** Ascension pips are rendered in DOM order; index 0 = target start value 1. */
const getPips = () => document.querySelectorAll('.c-sum-pip')

/**
 * Servants default to unowned (`disabled: true`), which hides the
 * ascension/skill/append pips entirely. Tests that click pips must mark
 * the card owned first via the "未所持" toggle button, unless a `material`
 * localStorage fixture already sets `disabled: false`.
 */
const makeOwned = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '未所持' }))
}

const expandGlobalPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText('COMMON TARGET — 共通目標設定'))
}

const getTrackingSwitch = () => screen.getByRole('switch', { name: '育成記録モード' })

beforeEach(() => {
  localStorage.clear()
  showTrackingToast.mockClear()
  showBlockedToast.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Index - tracking mode OFF (default)', () => {
  it('updates chaldeaState on pip click but leaves possession and toasts untouched', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    const pips = getPips()
    expect(pips).toHaveLength(4)
    await user.click(pips[0])

    // start advanced (pip 0 now lit)
    expect(pips[0]).toHaveClass('lit')
    expect(getPossession()).toEqual({})
    expect(showTrackingToast).not.toHaveBeenCalled()
    expect(showBlockedToast).not.toHaveBeenCalled()
  })
})

describe('Index - tracking mode ON, sufficient possession', () => {
  it('consumes the corresponding materials from possession and fires the tracking toast', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 10, '200': 5, '1': 1000000 })
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    const pips = getPips()
    await user.click(pips[0]) // ascension start 0 -> 1, step 0 costs 4x100 + 1x200 + 50000 QP

    expect(getPossession()).toEqual({ '100': 6, '200': 4, '1': 950000 })
    expect(showBlockedToast).not.toHaveBeenCalled()
    expect(showTrackingToast).toHaveBeenCalledTimes(1)
    const call = showTrackingToast.mock.calls[0][0]
    expect(call.servantId).toBe('1')
    expect(call.target).toBe('ascension')
    expect(call.prevStart).toBe(0)
    expect(call.newStart).toBe(1)
  })

  it('returns (adds back) materials when start is decremented, uncapped by shortage checks', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('material', {
      all: { disabled: true, targets: { ascension: { disabled: false, ranges: [{ start: 0, end: 4 }] }, skill: { disabled: false, ranges: [{ start: 1, end: 10 }, { start: 1, end: 10 }, { start: 1, end: 10 }] }, appendSkill: { disabled: false, ranges: [{ start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }] } } },
      '1': { disabled: false, targets: { ascension: { disabled: false, ranges: [{ start: 2, end: 4 }] }, skill: { disabled: false, ranges: [{ start: 1, end: 10 }, { start: 1, end: 10 }, { start: 1, end: 10 }] }, appendSkill: { disabled: false, ranges: [{ start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }] } } },
    })
    setLocalStorage('posession', { '100': 0 })
    render(<Index servants={[servant]} materials={materials} items={items} />)

    const pips = getPips()
    // start is 2; right-click (contextmenu) decrements to 1 -> returns step 1's materials (8x item 100 + 100000 QP)
    await act(async () => {
      pips[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })

    expect(getPossession()).toEqual({ '100': 8, '1': 100000 })
    expect(showTrackingToast).toHaveBeenCalledTimes(1)
    expect(showTrackingToast.mock.calls[0][0].prevStart).toBe(2)
    expect(showTrackingToast.mock.calls[0][0].newStart).toBe(1)
  })
})

describe('Index - tracking mode ON, insufficient possession (shortage)', () => {
  it('blocks the start change entirely and shows the blocked toast instead of clamping to 0', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 1, '200': 5, '1': 1000000 }) // need 4x100, have 1
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    const pips = getPips()
    await user.click(pips[0])

    // Blocked: chaldeaState (pip) and possession stay unchanged.
    expect(pips[0]).not.toHaveClass('lit')
    expect(getPossession()).toEqual({ '100': 1, '200': 5, '1': 1000000 })
    expect(showTrackingToast).not.toHaveBeenCalled()
    expect(showBlockedToast).toHaveBeenCalledTimes(1)

    const call = showBlockedToast.mock.calls[0][0]
    expect(call.shortageItems).toEqual([
      { itemId: '100', owned: 1, required: 4, name: '灯火の焔', icon: 'Item100' },
    ])
  })

  it('lets the shortage-recovery callback correct possession directly (no subtraction, since nothing was consumed)', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 1 })
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    await user.click(getPips()[0])
    expect(showBlockedToast).toHaveBeenCalledTimes(1)

    // Simulate the BlockedToast's "所持数を更新する" confirmation.
    const { onSetPossession } = showBlockedToast.mock.calls[0][0]
    act(() => {
      onSetPossession({ '100': 12 })
    })

    expect(getPossession()).toEqual({ '100': 12 })
  })
})

describe('Index - tracking mode toggle UI', () => {
  it('persists the toggle to localStorage and shows/hides the ● REC indicator when the panel is collapsed', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)

    expect(screen.queryByText('● REC')).not.toBeInTheDocument()

    await expandGlobalPanel(user)
    const toggle = getTrackingSwitch()
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(JSON.parse(localStorage.getItem('material/tracking-mode')!)).toBe(true)

    // Collapse the panel again; the REC indicator should now be visible.
    await expandGlobalPanel(user)
    expect(screen.getByText('● REC')).toBeInTheDocument()
  })
})

describe('Index - tracking-mode suggestion banner', () => {
  const bannerText =
    'セットアップが進んでいるようです。今後の現在値変更で所持数を自動で増減する「育成記録モード」をオンにしますか？'

  it('stays hidden while possession has never been non-zero', () => {
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
  })

  it('appears once possession becomes non-zero (e.g. synced in from /material/result), and "ON にする" enables tracking mode and dismisses it', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)

    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()

    // Simulate another tab/page writing to the shared 'posession' key.
    act(() => {
      localStorage.setItem('posession', JSON.stringify({ '100': 3 }))
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'posession' } }))
    })

    expect(await screen.findByText(bannerText)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ON にする' }))

    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('material/tracking-mode')!)).toBe(true)
    expect(JSON.parse(localStorage.getItem('material/tracking-suggest-dismissed')!)).toBe(true)
  })

  it('"今はやめておく" dismisses the banner without enabling tracking mode', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)

    act(() => {
      localStorage.setItem('posession', JSON.stringify({ '100': 3 }))
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'posession' } }))
    })
    await screen.findByText(bannerText)

    await user.click(screen.getByRole('button', { name: '今はやめておく' }))

    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('material/tracking-suggest-dismissed')!)).toBe(true)
    // Tracking mode itself was never toggled on, only initialized to its
    // default (false) by useLocalStorage's first-write effect.
    expect(JSON.parse(localStorage.getItem('material/tracking-mode') ?? 'null')).toBe(false)
  })

  it('never shows once already dismissed, even with non-zero possession', () => {
    setLocalStorage('material/tracking-suggest-dismissed', true)
    setLocalStorage('posession', { '100': 3 })
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
  })

  it('never shows once tracking mode is already ON', () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 3 })
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
  })
})

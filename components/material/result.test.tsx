// @vitest-environment jsdom
//
// Integration tests for the direct-submit `goSolver` flow that
// components/material/result.tsx owns: goal A/B query building (unchanged
// algorithm, just the transport), excluded-quest wiring into `quests=`, the
// stock-only (goal A empty) single-item submission decision, and the
// validation guards that block submission.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EnrichedItem } from '../../lib/get-items'
import type { Quest } from '../../interfaces/fgodrop'
import {
  solveCallUrl,
  stubFetch,
  submitButton,
} from '../../lib/farming/solve-request-test-utils'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../common/StockTargetSettings', () => ({
  StockTargetSettings: () => <div>stock-target-settings</div>,
}))
vi.mock('../common/possession-import/PossessionImportDialog', () => ({
  PossessionImportDialog: () => null,
}))
vi.mock('./material-selection-advisor', () => ({
  MaterialSelectionAdvisor: () => <div>advisor</div>,
}))
vi.mock('../../lib/progress/snapshot-client', () => ({
  saveProgressSnapshot: vi.fn().mockResolvedValue(undefined),
}))

import { Result } from './result'

// gold, largeCategory 強化素材(normal group) → DEFAULT_STOCK_BUFFER.normal.gold = 60
const itemA: EnrichedItem = {
  id: 100,
  name: '金素材A',
  type: 'skillLvUp',
  uses: 'ascension',
  detail: '',
  icon: '',
  background: 'gold',
  priority: 201,
  dropPriority: 0,
  largeCategory: '強化素材',
  category: '金素材',
}
// silver, largeCategory 強化素材(normal group) → DEFAULT_STOCK_BUFFER.normal.silver = 150
const itemB: EnrichedItem = {
  id: 200,
  name: '銀素材B',
  type: 'skillLvUp',
  uses: 'ascension',
  detail: '',
  icon: '',
  background: 'silver',
  priority: 202,
  dropPriority: 0,
  largeCategory: '強化素材',
  category: '銀素材',
}
const items = [itemA, itemB]

// toApiItemId(itemA, items) === '20' (generic gold intercept 2, index 0)
// toApiItemId(itemB, items) === '10' (generic silver intercept 1, index 0)

const quests: Quest[] = [
  { id: '1A01', section: '1章', area: 'エリアA', name: 'クエスト1', ap: 10 },
  { id: '1A02', section: '1章', area: 'エリアA', name: 'クエスト2', ap: 10 },
  { id: '1B01', section: '1章', area: 'エリアB', name: 'クエスト3', ap: 10 },
]
const allQuestIds = quests.map((q) => q.id)

const setLocalStorage = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value))

beforeEach(() => {
  localStorage.clear()
  push.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('goSolver — goal A/B transport (5.1)', () => {
  it('stockEnabled ON, A and B differ: sends both items and itemsStock', async () => {
    setLocalStorage('efficiency/stockEnabled', true)
    setLocalStorage('material/result', { '100': 5, '200': 3 })
    setLocalStorage('posession', { '100': 0, '200': 3 })
    const fetchMock = stubFetch()

    render(<Result items={items} quests={quests} />)
    await userEvent.click(await submitButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = solveCallUrl(fetchMock)
    expect(url.searchParams.get('items')).toBe('20:5')
    expect(url.searchParams.get('itemsStock')).toBe('20:65,10:150')
  })

  it('stockEnabled OFF: sends items only, no itemsStock', async () => {
    setLocalStorage('efficiency/stockEnabled', false)
    setLocalStorage('material/result', { '100': 5, '200': 3 })
    setLocalStorage('posession', { '100': 0, '200': 3 })
    const fetchMock = stubFetch()

    render(<Result items={items} quests={quests} />)
    await userEvent.click(await submitButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = solveCallUrl(fetchMock)
    expect(url.searchParams.get('items')).toBe('20:5')
    expect(url.searchParams.has('itemsStock')).toBe(false)
  })
})

describe('goSolver — quest exclusion (5.2)', () => {
  it('sends only the checked (non-excluded) quest ids, as full ids not prefixes', async () => {
    setLocalStorage('efficiency/stockEnabled', false)
    setLocalStorage('material/result', { '100': 5 })
    setLocalStorage('posession', {})
    setLocalStorage('excludedQuests', ['1A02'])
    const fetchMock = stubFetch()

    render(<Result items={items} quests={quests} />)
    await userEvent.click(await submitButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = solveCallUrl(fetchMock)
    expect(url.searchParams.get('quests')).toBe('1A01,1B01')
  })
})

describe('goSolver — boundary cases (5.3)', () => {
  it('(a) goal A=0, goal B>0 (stock-only): submits with B as the sole items param, no itemsStock', async () => {
    setLocalStorage('efficiency/stockEnabled', true)
    setLocalStorage('material/result', { '200': 3 })
    setLocalStorage('posession', { '200': 3 })
    const fetchMock = stubFetch()

    render(<Result items={items} quests={quests} />)
    const button = await submitButton()
    expect(button).not.toBeDisabled()
    await userEvent.click(button)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = solveCallUrl(fetchMock)
    expect(url.searchParams.get('items')).toBe('10:150')
    expect(url.searchParams.has('itemsStock')).toBe(false)
  })

  it('(b) goal A=0 and goal B=0: submission is blocked, fetch is not called, validation message is shown', async () => {
    setLocalStorage('efficiency/stockEnabled', false)
    setLocalStorage('material/result', {})
    setLocalStorage('posession', {})
    const fetchMock = stubFetch()

    render(<Result items={items} quests={quests} />)
    const button = await submitButton()
    expect(button).toBeDisabled()
    await userEvent.click(button)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('集めたいアイテムの数を最低1つ入力してください。')
    ).toBeInTheDocument()
  })

  it('(c) zero quests selected: submission is blocked and fetch is not called', async () => {
    setLocalStorage('efficiency/stockEnabled', false)
    setLocalStorage('material/result', { '100': 5 })
    setLocalStorage('posession', {})
    setLocalStorage('excludedQuests', allQuestIds)
    const fetchMock = stubFetch()

    render(<Result items={items} quests={quests} />)
    const button = await submitButton()
    expect(button).toBeDisabled()
    await userEvent.click(button)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      screen.getByText('周回対象に含めるクエストを最低1つ選択してください。')
    ).toBeInTheDocument()
  })
})

describe('goSolver — recovers from a failed submission', () => {
  it('clears the loading state after fetch rejects, so the user can retry', async () => {
    setLocalStorage('efficiency/stockEnabled', false)
    setLocalStorage('material/result', { '100': 5 })
    setLocalStorage('posession', {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    render(<Result items={items} quests={quests} />)
    const button = await submitButton()
    await userEvent.click(button)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    // Without the fix, the button stays disabled forever (isLoading never
    // resets) and the user cannot retry without reloading the page.
    await waitFor(() => expect(button).not.toBeDisabled())

    errorSpy.mockRestore()
  })
})

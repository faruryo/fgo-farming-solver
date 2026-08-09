// @vitest-environment jsdom
//
// Regression test for task 5.4: `/farming` direct access (manual item entry)
// must keep working unchanged now that goSolver no longer routes through
// this page. Also doubles as a check for task 5.5 (no `itemsStock` leaks
// into the submitted request now that the dead `stockItemsParam` code path
// has been removed).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Localized } from '../../lib/get-local-items'
import type { Item, Quest } from '../../interfaces/fgodrop'
import {
  solveCallUrl,
  stubFetch,
  submitButton,
} from '../../lib/farming/solve-request-test-utils'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../../lib/progress/snapshot-client', () => ({
  saveProgressSnapshot: vi.fn().mockResolvedValue(undefined),
}))

import { Index } from './index'

const items: Localized<Item>[] = [
  {
    id: '100',
    category: '金素材',
    name: '灯火の焔',
    largeCategory: '強化素材',
    shortName: '灯火',
  },
]
const quests: Quest[] = [
  { id: '1A01', section: '1章', area: 'エリアA', name: 'クエスト1', ap: 10 },
]

beforeEach(() => {
  localStorage.clear()
  push.mockClear()
  replace.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/farming direct access (5.4 regression)', () => {
  it('disables submit and shows the item-count alert when no counts are entered', async () => {
    render(<Index items={items} quests={quests} />)

    const button = await submitButton()
    expect(button).toBeDisabled()
    expect(
      screen.getByText('集めたいアイテムの数を最低1つ入力してください。')
    ).toBeInTheDocument()
  })

  it('submits manually entered counts to /api/solve without itemsStock (5.5)', async () => {
    const fetchMock = stubFetch()
    const user = userEvent.setup()

    render(<Index items={items} quests={quests} />)

    const countInput = screen.getByRole('spinbutton', { name: /灯火の焔/ })
    await user.clear(countInput)
    await user.type(countInput, '3')

    const button = await submitButton()
    await waitFor(() => expect(button).not.toBeDisabled())
    await user.click(button)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = solveCallUrl(fetchMock)
    expect(url.searchParams.get('items')).toBe('100:3')
    expect(url.searchParams.has('itemsStock')).toBe(false)
  })
})

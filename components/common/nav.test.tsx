// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'ja' },
  }),
}))

const mockSession = vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' })
vi.mock('next-auth/react', () => ({
  useSession: () => mockSession(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('../../hooks/use-cloud-sync', () => ({
  useCloudSync: () => ({ session: null }),
}))

vi.mock('./FarmingPurposeSelector', () => ({
  FarmingPurposeSelector: () => null,
}))

import { Nav } from './nav'

const openMenu = async () => {
  render(<Nav />)
  await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
  // 常に出る項目でメニューが開いたことを確かめる
  expect(await screen.findByText('育成素材計算機')).toBeInTheDocument()
}

beforeEach(() => {
  mockSession.mockReturnValue({ data: null, status: 'unauthenticated' })
})

describe('Nav', () => {
  it('hides the history item when unauthenticated', async () => {
    await openMenu()
    expect(screen.queryByText('計算履歴')).not.toBeInTheDocument()
  })

  it('hides the history item while the session is being checked', async () => {
    mockSession.mockReturnValue({ data: null, status: 'loading' })
    await openMenu()
    expect(screen.queryByText('計算履歴')).not.toBeInTheDocument()
  })

  it('shows the history item when authenticated', async () => {
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' })
    await openMenu()
    expect(screen.getByText('計算履歴').closest('a')).toHaveAttribute('href', '/farming/history')
  })
})

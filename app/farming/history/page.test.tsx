// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

const mockSession = vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' })
vi.mock('next-auth/react', () => ({
  useSession: () => mockSession(),
}))

import HistoryPage from './page'

const stubFetch = () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  mockSession.mockReturnValue({ data: null, status: 'unauthenticated' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/farming/history', () => {
  it('does not fetch history when unauthenticated and shows a login prompt linking to /cloud', async () => {
    const fetchMock = stubFetch()

    render(<HistoryPage />)

    expect(screen.getByText(/計算履歴はログインすると使えます/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ログインする' })).toHaveAttribute('href', '/cloud')
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not fetch history while the session is being checked', async () => {
    mockSession.mockReturnValue({ data: null, status: 'loading' })
    const fetchMock = stubFetch()

    render(<HistoryPage />)

    await new Promise((r) => setTimeout(r, 0))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/計算履歴はログインすると使えます/)).not.toBeInTheDocument()
  })

  it('fetches history when authenticated', async () => {
    mockSession.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' })
    const fetchMock = stubFetch()

    render(<HistoryPage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/farming/history'))
    expect(await screen.findByText('履歴がありません')).toBeInTheDocument()
    expect(screen.queryByText(/計算履歴はログインすると使えます/)).not.toBeInTheDocument()
  })
})

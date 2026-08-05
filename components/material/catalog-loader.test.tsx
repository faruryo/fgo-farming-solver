// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('./index', () => ({ Index: () => <div>index-mounted</div> }))
vi.mock('./material', () => ({ Material: () => <div>material-mounted</div> }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }))

import { MaterialCatalogLoader } from './catalog-loader'

const catalog = {
  schemaVersion: 1,
  servants: [{ id: 1, name: 'Mash', className: 'shielder', collectionNo: 1, rarity: 4, face: null }],
  items: [{ id: 1, name: 'Proof', icon: 'proof.png' }],
  materials: {},
  sources: { niceServant: {}, niceItem: {} },
  updatedAt: 1,
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('MaterialCatalogLoader', () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

  it('does not mount stateful Material UI while catalog loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    const storageSync = vi.fn()
    window.addEventListener('ls-sync', storageSync)
    render(<MaterialCatalogLoader />)
    expect(screen.getByText('素材データを読み込んでいます…')).toBeInTheDocument()
    await screen.findByText('素材データを読み込めません。')
    expect(screen.queryByText('index-mounted')).not.toBeInTheDocument()
    expect(localStorage.getItem('material')).toBeNull()
    expect(localStorage.getItem('posession')).toBeNull()
    expect(storageSync).not.toHaveBeenCalled()
    window.removeEventListener('ls-sync', storageSync)
  })

  it('retries failed loading and mounts only after a valid catalog', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json(catalog))
    vi.stubGlobal('fetch', fetchMock)
    render(<MaterialCatalogLoader />)
    await screen.findByText('素材データを読み込めません。')
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    await waitFor(() => expect(screen.getByText('index-mounted')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the most recent retry result when earlier retries settle later', async () => {
    const firstRetry = deferred<Response>()
    const secondRetry = deferred<Response>()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockReturnValueOnce(firstRetry.promise)
      .mockReturnValueOnce(secondRetry.promise)
    vi.stubGlobal('fetch', fetchMock)
    render(<MaterialCatalogLoader />)
    await screen.findByText('素材データを読み込めません。')

    const retry = screen.getByRole('button', { name: '再試行' })
    act(() => {
      retry.click()
      retry.click()
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    secondRetry.resolve(Response.json(catalog))
    await screen.findByText('index-mounted')
    await act(async () => {
      firstRetry.reject(new Error('first retry failed'))
      await Promise.resolve()
    })
    expect(screen.queryByText('素材データを読み込めません。')).not.toBeInTheDocument()
  })

  it('rejects a truncated catalog before mounting stateful Material UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...catalog, servants: [{ id: 1 }] })))
    render(<MaterialCatalogLoader />)
    await screen.findByText('素材データを読み込めません。')
    expect(screen.queryByText('index-mounted')).not.toBeInTheDocument()
  })
})

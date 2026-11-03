// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const catalog = { schemaVersion: 1, updatedAt: 1, servants: [], items: [], materials: {}, sources: {} }
const ok = () => new Response(JSON.stringify(catalog), { status: 200 })

describe('loadMaterialCatalog', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const load = async () => (await import('./use-material-catalog')).loadMaterialCatalog
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('同時に呼んでも取得は1回で、同じカタログを返す', async () => {
    fetchMock.mockImplementation(async () => ok())
    const loadMaterialCatalog = await load()
    const [a, b] = await Promise.all([loadMaterialCatalog(), loadMaterialCatalog()])
    expect(await loadMaterialCatalog()).toBe(a)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('失敗した取得は使い回さず、次の呼び出しで取り直す', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 })).mockImplementation(async () => ok())
    const loadMaterialCatalog = await load()
    await expect(loadMaterialCatalog()).rejects.toThrow()
    await expect(loadMaterialCatalog()).resolves.toEqual(catalog)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fresh なら使い回さずに取り直す', async () => {
    fetchMock.mockImplementation(async () => ok())
    const loadMaterialCatalog = await load()
    await loadMaterialCatalog()
    await loadMaterialCatalog(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('5分を過ぎたら取り直す', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    fetchMock.mockImplementation(async () => ok())
    const loadMaterialCatalog = await load()
    await loadMaterialCatalog()
    vi.setSystemTime(Date.now() + 5 * 60 * 1000)
    await loadMaterialCatalog()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

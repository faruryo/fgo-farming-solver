import { describe, expect, it, vi } from 'vitest'
import { materialCatalogResponse } from './route'

describe('materialCatalogResponse', () => {
  it('streams the production KV value without parsing it', async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"schemaVersion":1}')); controller.close() } })
    const get = vi.fn().mockResolvedValue(stream)
    const response = await materialCatalogResponse({ kv: { get }, isLocal: false })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(await response.text()).toBe('{"schemaVersion":1}')
    expect(get).toHaveBeenCalledWith('material_catalog_v1', { type: 'stream', cacheTtl: 300 })
  })

  it('returns no-store 503 when production KV is unavailable', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await materialCatalogResponse({ isLocal: false })
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the explicit local-only loader when no KV binding exists', async () => {
    const loadLocal = vi.fn().mockResolvedValue({ schemaVersion: 1 })
    const response = await materialCatalogResponse({ isLocal: true, loadLocal })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ schemaVersion: 1 })
  })

  it('falls back to the local loader when a development KV binding has no catalog', async () => {
    const get = vi.fn().mockResolvedValue(null)
    const loadLocal = vi.fn().mockResolvedValue({ schemaVersion: 1 })

    const response = await materialCatalogResponse({ kv: { get }, isLocal: true, loadLocal })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ schemaVersion: 1 })
    expect(get).toHaveBeenCalledOnce()
  })

  it('returns no-store 503 when the catalog has not been seeded', async () => {
    const response = await materialCatalogResponse({ kv: { get: vi.fn().mockResolvedValue(null) }, isLocal: false })

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns no-store 503 when the KV read fails', async () => {
    const response = await materialCatalogResponse({ kv: { get: vi.fn().mockRejectedValue(new Error('KV unavailable')) }, isLocal: false })

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

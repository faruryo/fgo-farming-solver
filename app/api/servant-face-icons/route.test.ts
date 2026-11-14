import { describe, expect, it, vi } from 'vitest'
import { servantFaceIconsResponse } from './route'

const data = { icons: [{ servantId: 100100, url: 'https://example.test/f.png', pixels: 'AAAA' }] }

describe('servantFaceIconsResponse', () => {
  it('streams the KV value without parsing it', async () => {
    const body = JSON.stringify(data)
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close() } })
    const get = vi.fn().mockResolvedValue(stream)
    const loadLocal = vi.fn()

    const response = await servantFaceIconsResponse({ kv: { get }, isLocal: true, loadLocal })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(await response.text()).toBe(body)
    expect(get).toHaveBeenCalledWith('servant_face_icons', { type: 'stream', cacheTtl: 300 })
    expect(loadLocal).not.toHaveBeenCalled()
  })

  it('reads the local file when the KV has no value and the file system is readable', async () => {
    const loadLocal = vi.fn().mockResolvedValue(data)

    const response = await servantFaceIconsResponse({ kv: { get: vi.fn().mockResolvedValue(null) }, isLocal: true, loadLocal })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(data)
  })

  it('reads the local file when there is no KV binding', async () => {
    const response = await servantFaceIconsResponse({ isLocal: true, loadLocal: vi.fn().mockResolvedValue(data) })

    expect(await response.json()).toEqual(data)
  })

  it('returns no-store 503 when neither the KV value nor the local file exists', async () => {
    const response = await servantFaceIconsResponse({
      kv: { get: vi.fn().mockResolvedValue(null) },
      isLocal: true,
      loadLocal: vi.fn().mockResolvedValue(null),
    })

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('does not read the local file where the file system is not readable', async () => {
    const loadLocal = vi.fn().mockResolvedValue(data)

    const response = await servantFaceIconsResponse({ kv: { get: vi.fn().mockResolvedValue(null) }, isLocal: false, loadLocal })

    expect(response.status).toBe(503)
    expect(loadLocal).not.toHaveBeenCalled()
  })

  it('returns no-store 503 when the KV read fails in production', async () => {
    const response = await servantFaceIconsResponse({ kv: { get: vi.fn().mockRejectedValue(new Error('KV unavailable')) }, isLocal: false })

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

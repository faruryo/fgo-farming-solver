import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.fn()
vi.mock('../../../../../lib/auth', () => ({
  auth: () => mockAuth(),
}))

const mockGetResult = vi.fn()
vi.mock('../../../../../lib/get-result', () => ({
  getResult: (...args: unknown[]) => mockGetResult(...args),
}))

const mockPrepare = vi.fn()
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: {
      DB: {
        prepare: mockPrepare,
      },
    },
  })),
}))

import { GET, PATCH } from './route'

describe('GET /api/farming/results/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes session user id to getResult and returns 200 on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockGetResult.mockResolvedValue({ id: 'res-1', isPublic: true })

    const req = new NextRequest('http://localhost/api/farming/results/res-1')
    const res = await GET(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'res-1', isPublic: true })
    expect(mockGetResult).toHaveBeenCalledWith('res-1', 'user-1')
  })

  it('returns 404 when getResult throws', async () => {
    mockAuth.mockResolvedValue(null)
    mockGetResult.mockRejectedValue(new Error('Result not found'))

    const req = new NextRequest('http://localhost/api/farming/results/res-1')
    const res = await GET(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not Found' })
    expect(mockGetResult).toHaveBeenCalledWith('res-1', undefined)
  })

  it('does not include userId in the JSON response', async () => {
    mockAuth.mockResolvedValue(null)
    mockGetResult.mockResolvedValue({ id: 'res-1', isPublic: true, isOwner: false })

    const req = new NextRequest('http://localhost/api/farming/results/res-1')
    const res = await GET(req, { params: Promise.resolve({ id: 'res-1' }) })
    const data: Record<string, unknown> = await res.json()

    expect(res.status).toBe(200)
    expect(data.userId).toBeUndefined()
    expect(data.isOwner).toBe(false)
  })
})

describe('PATCH /api/farming/results/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 401 if unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/farming/results/res-1', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: false }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(401)
  })

  it('returns 400 if isPublic is missing or not a boolean', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const req = new NextRequest('http://localhost/api/farming/results/res-1', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: 'invalid' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 400 if body is null', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

    const req = new NextRequest('http://localhost/api/farming/results/res-1', {
      method: 'PATCH',
      body: JSON.stringify(null),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 404 if target row does not belong to the user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ batch_id: null, user_id: 'user-2' }),
      }),
    })

    const req = new NextRequest('http://localhost/api/farming/results/res-1', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: false }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(404)
  })

  it('updates single row visibility and returns 200 for owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } })
    const mockUpdateBind = vi.fn().mockReturnValue({ run: mockRun })

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ batch_id: null, user_id: 'user-1' }),
          }),
        }
      }
      return { bind: mockUpdateBind }
    })

    const req = new NextRequest('http://localhost/api/farming/results/res-1', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: false }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, isPublic: false })
    expect(mockUpdateBind).toHaveBeenCalledWith(0, 'res-1', 'user-1')
  })

  it('updates batch pair visibility and returns 200 for owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 2 } })
    const mockUpdateBind = vi.fn().mockReturnValue({ run: mockRun })

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ batch_id: 'batch-999', user_id: 'user-1' }),
          }),
        }
      }
      return { bind: mockUpdateBind }
    })

    const req = new NextRequest('http://localhost/api/farming/results/res-1', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: true }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'res-1' }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, isPublic: true })
    expect(mockUpdateBind).toHaveBeenCalledWith(1, 'batch-999', 'user-1')
  })

  it('updates visibility even if result was soft-deleted', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } })
    const mockUpdateBind = vi.fn().mockReturnValue({ run: mockRun })

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ batch_id: null, user_id: 'user-1' }),
          }),
        }
      }
      return { bind: mockUpdateBind }
    })

    const req = new NextRequest('http://localhost/api/farming/results/deleted-res', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: false }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'deleted-res' }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, isPublic: false })
    expect(mockUpdateBind).toHaveBeenCalledWith(0, 'deleted-res', 'user-1')
  })
})

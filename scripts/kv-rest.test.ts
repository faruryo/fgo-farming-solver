import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ACCOUNT = 'acc'
const PREVIEW_NS = '9d4d9cbdf56e4cb284d6c74234e40a5d'
const PRODUCTION_NS = '306bbe537e9d4907809f82468df500e4'
const url = (ns: string, key: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces/${ns}/values/${key}`

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', ACCOUNT)
  vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token')
  fetchMock = vi.fn(async () => new Response('value', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('kv-rest', () => {
  it('reads from the given namespace', async () => {
    vi.stubEnv('DRY_RUN', '')
    const { kvGetIn } = await import('./kv-rest')
    expect(await kvGetIn(PREVIEW_NS, 'servants_list')).toBe('value')
    expect(fetchMock.mock.calls[0][0]).toBe(url(PREVIEW_NS, 'servants_list'))
  })

  it('writes to the given namespace', async () => {
    vi.stubEnv('DRY_RUN', '')
    const { kvPutIn } = await import('./kv-rest')
    await kvPutIn(PREVIEW_NS, 'servants_list', 'v')
    expect(fetchMock.mock.calls[0][0]).toBe(url(PREVIEW_NS, 'servants_list'))
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: 'v' })
  })

  it('kvGet / kvPut use the production namespace', async () => {
    vi.stubEnv('DRY_RUN', '')
    const { kvGet, kvPut, MASTER_DATA_NAMESPACE_ID } = await import('./kv-rest')
    expect(MASTER_DATA_NAMESPACE_ID).toBe(PRODUCTION_NS)
    await kvGet('all_drops_json')
    await kvPut('all_drops_json', 'v')
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      url(PRODUCTION_NS, 'all_drops_json'),
      url(PRODUCTION_NS, 'all_drops_json'),
    ])
  })

  it('returns null on 404', async () => {
    vi.stubEnv('DRY_RUN', '')
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))
    const { kvGetIn } = await import('./kv-rest')
    expect(await kvGetIn(PREVIEW_NS, 'servants_list')).toBeNull()
  })

  it('does not call fetch with DRY_RUN=1', async () => {
    vi.stubEnv('DRY_RUN', '1')
    const { kvGetIn, kvPutIn } = await import('./kv-rest')
    expect(await kvGetIn(PREVIEW_NS, 'servants_list')).toBeNull()
    await kvPutIn(PREVIEW_NS, 'servants_list', 'v')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

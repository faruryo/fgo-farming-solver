import { describe, expect, it, vi } from 'vitest'
import type { FaceIconData } from '../servant-roster-import/types'
import { SERVANT_FACE_ICONS_KEY } from './face-icons'
import { runServantFaceIconsPhase } from './phase'
import { makePng } from './png-fixture'

const SERVANT_URL = 'https://example.test/nice_servant.json'
const face = (name: string) => `https://example.test/faces/${name}.png`

const servants = [
  { id: 1, type: 'normal', extraAssets: { faces: { ascension: { '1': face('a1'), '2': face('a2') } } } },
  { id: 2, type: 'heroine', extraAssets: { faces: { ascension: { '1': face('m1') }, costume: { '10': face('m-c') } } } },
]
const allUrls = [face('a1'), face('a2'), face('m1'), face('m-c')]

const servantResponse = (etag = '"v2"') =>
  new Response(JSON.stringify(servants), { status: 200, headers: { etag } })

type Route = (url: string, init?: RequestInit) => Response

const urlOf = (input: string | URL | Request) => {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

/** nice_servant と顔のアイコンに答える fetch。`failing` の URL は 404 を返す */
const atlas = ({ servant = () => servantResponse(), failing = [] as string[] }: { servant?: Route; failing?: string[] } = {}) =>
  vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = urlOf(input)
    if (url === SERVANT_URL) return Promise.resolve(servant(url, init))
    if (failing.includes(url) || !allUrls.includes(url)) return Promise.resolve(new Response('not found', { status: 404 }))
    return Promise.resolve(new Response(makePng(), { status: 200 }))
  })

const iconUrls = (fetchSource: ReturnType<typeof atlas>) =>
  fetchSource.mock.calls.map(([input]) => urlOf(input)).filter(url => url !== SERVANT_URL)

const stored = (put: ReturnType<typeof vi.fn>): FaceIconData =>
  JSON.parse(put.mock.calls[0][1] as string) as FaceIconData

const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }

const run = (overrides: Partial<Parameters<typeof runServantFaceIconsPhase>[0]>) =>
  runServantFaceIconsPhase({
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    servantUrl: SERVANT_URL,
    now: () => Date.UTC(2026, 10, 15),
    logger,
    ...overrides,
  })

const previousData = (overrides: Partial<FaceIconData> = {}): FaceIconData => ({
  icons: [face('a1'), face('a2'), face('m1')].map(url => ({ servantId: url.includes('/m') ? 2 : 1, url, pixels: 'kept' })),
  failedUrls: [],
  etag: '"v1"',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
})

describe('runServantFaceIconsPhase', () => {
  it('fetches every face unconditionally on the first build', async () => {
    const fetchSource = atlas()
    const put = vi.fn().mockResolvedValue(undefined)

    await expect(run({ fetchSource, put })).resolves.toEqual({ failed: false })

    const servantInit = fetchSource.mock.calls.find(([input]) => urlOf(input) === SERVANT_URL)?.[1]
    expect(new Headers(servantInit?.headers).has('If-None-Match')).toBe(false)
    expect(new Set(iconUrls(fetchSource))).toEqual(new Set(allUrls))
    expect(iconUrls(fetchSource)).toHaveLength(allUrls.length)
    expect(put).toHaveBeenCalledOnce()
    expect(put.mock.calls[0][0]).toBe(SERVANT_FACE_ICONS_KEY)
    const data = stored(put)
    expect(data.icons.map(icon => [icon.servantId, icon.url])).toEqual([
      [1, face('a1')], [1, face('a2')], [2, face('m1')], [2, face('m-c')],
    ])
    expect(Buffer.from(data.icons[0].pixels, 'base64')).toHaveLength(16 * 16 * 4)
    expect(data.failedUrls).toEqual([])
    expect(data.etag).toBe('"v2"')
  })

  it('records a face that cannot be fetched and keeps the faces from the previous data', async () => {
    const fetchSource = atlas({ failing: [face('m-c')] })
    const put = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue(JSON.stringify(previousData()))

    await expect(run({ fetchSource, get, put })).resolves.toEqual({ failed: false })

    const data = stored(put)
    expect(data.icons.map(icon => icon.url)).toEqual([face('a1'), face('a2'), face('m1')])
    expect(data.icons.every(icon => icon.pixels === 'kept')).toBe(true)
    expect(data.failedUrls).toEqual([face('m-c')])
  })

  it('retries a face that failed last time even though nice_servant is unchanged', async () => {
    const servant = vi.fn((_url: string, init?: RequestInit) =>
      new Headers(init?.headers).has('If-None-Match') ? new Response(null, { status: 304 }) : servantResponse('"v1"'),
    )
    const fetchSource = atlas({ servant })
    const put = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue(JSON.stringify(previousData({ failedUrls: [face('m-c')] })))

    await expect(run({ fetchSource, get, put })).resolves.toEqual({ failed: false })

    expect(iconUrls(fetchSource)).toEqual([face('m-c')])
    const data = stored(put)
    expect(data.icons.map(icon => icon.url)).toEqual(allUrls)
    expect(data.failedUrls).toEqual([])
  })

  it('does nothing when nice_servant is unchanged and nothing is left to retry', async () => {
    const servant = vi.fn((_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('If-None-Match')).toBe('"v1"')
      return new Response(null, { status: 304 })
    })
    const fetchSource = atlas({ servant })
    const put = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue(JSON.stringify(previousData({ etag: 'W/"v1"' })))

    await expect(run({ fetchSource, get, put })).resolves.toEqual({ failed: false })

    expect(servant).toHaveBeenCalledOnce()
    expect(iconUrls(fetchSource)).toEqual([])
    expect(put).not.toHaveBeenCalled()
  })

  it('keeps the previous data and reports failure when nice_servant cannot be fetched', async () => {
    const fetchSource = atlas({ servant: () => new Response('down', { status: 502 }) })
    const put = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue(JSON.stringify(previousData()))
    const nextPhase = vi.fn()

    const result = await run({ fetchSource, get, put })
    if (result.failed) nextPhase()

    expect(result).toEqual({ failed: true })
    expect(put).not.toHaveBeenCalled()
    expect(iconUrls(fetchSource)).toEqual([])
    expect(nextPhase).toHaveBeenCalledOnce()
  })

  it('reports failure when the KV write fails', async () => {
    const put = vi.fn().mockRejectedValue(new Error('KV put failed'))

    await expect(run({ fetchSource: atlas(), put })).resolves.toEqual({ failed: true })
  })

  it('does not write empty data when no face could be fetched on the first build', async () => {
    const put = vi.fn().mockResolvedValue(undefined)

    await expect(run({ fetchSource: atlas({ failing: allUrls }), put })).resolves.toEqual({ failed: true })
    expect(put).not.toHaveBeenCalled()
  })
})

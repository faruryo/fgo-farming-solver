// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { EventCraftSection } from './EventCraftSection'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { __resetDropsCacheForTest } from '../../hooks/use-drops'
import type { RosterNeed } from '../../hooks/use-roster-need'
import type { EnrichedItem } from '../../lib/get-items'
import type { Drops } from '../../lib/get-drops'

const readVar = (vars: Record<string, unknown>, name: string): string => {
  let value: unknown
  if (name === 'name') value = vars.name
  else if (name === 'id') value = vars.id
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

const fill = (template: string, vars?: Record<string, unknown>) =>
  vars ? template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => readVar(vars, name)) : template

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      if (typeof fallback === 'string') return fill(fallback, options)
      if (fallback && typeof fallback === 'object') return fill(key, fallback)
      return key
    },
  }),
}))

const advisorProps: { fullNeed: Record<string, number>; stockEnabled?: boolean }[] = []
vi.mock('../material/event-craft-advisor', () => ({
  EventCraftAdvisor: (props: { fullNeed: Record<string, number>; stockEnabled?: boolean }) => {
    advisorProps.push(props)
    return <div data-testid="advisor" />
  },
}))

// undefined のときは実フック（未設定ロスター → empty）を使う。
let rosterMock: RosterNeed | undefined
vi.mock('../../hooks/use-roster-need', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/use-roster-need')>()
  return { ...actual, useRosterNeed: () => rosterMock ?? actual.useRosterNeed() }
})

const items = [
  { id: 6516, name: '証明', type: 'skillLvUp', background: 'bronze', category: '銅素材', largeCategory: '強化素材' },
  { id: 6517, name: '世界樹の種', type: 'skillLvUp', background: 'bronze', category: '銅素材', largeCategory: '強化素材' },
  { id: 6518, name: '英雄の証', type: 'skillLvUp', background: 'bronze', category: '銅素材', largeCategory: '強化素材' },
] as EnrichedItem[]

const requests: { url: string; body?: string }[] = []
const gapPosts = () => requests.filter((request) => request.url.includes('/api/event-craft-data-gap'))

const baseDrops: Drops = {
  items: [
    { id: '01', atlasId: 6516, category: '銅素材', largeCategory: '強化素材' },
    { id: '02', atlasId: 6517, category: '銅素材', largeCategory: '強化素材' },
  ] as Drops['items'],
  quests: [{ id: 'Q1', section: 'Free', area: 'A', name: 'Q1', ap: 20 }] as Drops['quests'],
  drop_rates: [
    { quest_id: 'Q1', item_id: '01', drop_rate: 0.5 },
    { quest_id: 'Q1', item_id: '02', drop_rate: 0.5 },
  ] as Drops['drop_rates'],
  campaigns: [],
}

const ready = (need: Record<number, number>): RosterNeed => ({
  status: 'ready',
  chaldeaState: {},
  materialsForServants: {},
  totalNeed: new Map(Object.entries(need).map(([k, v]) => [Number(k), v])),
})

const stubDrops = (drops: Drops | Error) => {
  requests.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input)
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url.includes('/api/event-craft-data-gap')) {
        return Promise.resolve({ ok: true, status: 204 })
      }
      return drops instanceof Error
        ? Promise.reject(drops)
        : Promise.resolve({ ok: true, json: () => Promise.resolve(drops) })
    }),
  )
}

const setLs = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

describe('EventCraftSection', () => {
  beforeEach(() => {
    localStorage.clear()
    advisorProps.length = 0
    requests.length = 0
    rosterMock = undefined
    __resetDropsCacheForTest()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('実所持数 POSSESSION で fullNeed を作り、周回目標 ITEMS とは独立', async () => {
    rosterMock = ready({ 6516: 10, 6517: 5 })
    setLs(STORAGE_KEYS.POSSESSION, { 6516: 3, 6517: 0 })
    setLs(STORAGE_KEYS.ITEMS, { 6516: 9, 6517: 5 })
    stubDrops(baseDrops)
    render(<EventCraftSection items={items} />)
    await screen.findByTestId('advisor')
    expect(advisorProps.at(-1)).toEqual({ items, fullNeed: { '01': 7, '02': 5 }, stockEnabled: false })
  })

  it('(b) 正の need 素材のドロップ率欠落で Advisor を出さず、名前と欠け方を出す', async () => {
    rosterMock = ready({ 6516: 10, 6517: 5 })
    stubDrops({ ...baseDrops, drop_rates: [baseDrops.drop_rates[0]] })
    render(<EventCraftSection items={items} />)
    await screen.findByText('世界樹の種はドロップ表にありますが、ドロップするクエストがありません')
    expect(screen.queryByTestId('advisor')).toBeNull()
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeTruthy()
    await waitFor(() => expect(gapPosts()).toHaveLength(1))
  })

  it('(a) 正の need 素材のカタログ欠落で名前と「ドロップ表に無い」を出す', async () => {
    rosterMock = ready({ 6516: 10, 6518: 1 })
    stubDrops(baseDrops)
    render(<EventCraftSection items={items} />)
    await screen.findByText('英雄の証はドロップ表にありません')
    expect(screen.queryByTestId('advisor')).toBeNull()
  })

  it('名前の無い素材は数値 ID で示す', async () => {
    rosterMock = ready({ 6666: 1 })
    stubDrops(baseDrops)
    render(<EventCraftSection items={items} />)
    expect(await screen.findByText('ID 6666はドロップ表にありません')).toBeTruthy()
  })

  it('41件の欠落は40件以下のリクエストに分け、再描画では増やさない', async () => {
    const need: Record<number, number> = {}
    for (let index = 0; index < 41; index += 1) need[8000 + index] = 1
    rosterMock = ready(need)
    stubDrops(baseDrops)
    const { rerender } = render(<EventCraftSection items={items} />)
    await waitFor(() => expect(gapPosts()).toHaveLength(2))
    const counts = gapPosts().map((post) => {
      const body: unknown = JSON.parse(post.body ?? '')
      if (!body || typeof body !== 'object' || !('gaps' in body) || !Array.isArray(body.gaps)) return 0
      return body.gaps.length
    })
    expect(counts).toEqual([40, 1])
    rerender(<EventCraftSection items={items} />)
    expect(gapPosts()).toHaveLength(2)
  })

  it('送信完了が欠落消去より遅いとき、戻った同じ組を再送する', async () => {
    rosterMock = ready({ 6518: 1 })
    const drops = { ...baseDrops, drop_rates: [baseDrops.drop_rates[0]] }
    let releaseFirst = () => {}
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let gapCount = 0
    requests.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input)
        requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
        if (url.includes('/api/event-craft-data-gap')) {
          gapCount += 1
          if (gapCount === 1) return firstHeld.then(() => ({ ok: true, status: 204 }))
          return Promise.resolve({ ok: true, status: 204 })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(drops) })
      }),
    )
    const { rerender } = render(<EventCraftSection items={items} />)
    await screen.findByText('英雄の証はドロップ表にありません')
    await waitFor(() => expect(gapPosts()).toHaveLength(1))

    rosterMock = ready({ 6516: 10 })
    rerender(<EventCraftSection items={items} />)
    await screen.findByTestId('advisor')
    releaseFirst()
    await act(async () => {
      await firstHeld
    })

    rosterMock = ready({ 6518: 1 })
    rerender(<EventCraftSection items={items} />)
    await screen.findByText('英雄の証はドロップ表にありません')
    await waitFor(() => expect(gapPosts()).toHaveLength(2))
  })

  it('欠落が消えてから同じ組が戻ると再送する', async () => {
    rosterMock = ready({ 6518: 1 })
    stubDrops({ ...baseDrops, drop_rates: [baseDrops.drop_rates[0]] })
    const { rerender } = render(<EventCraftSection items={items} />)
    await screen.findByText('英雄の証はドロップ表にありません')
    await waitFor(() => expect(gapPosts()).toHaveLength(1))

    rosterMock = ready({ 6516: 10 })
    rerender(<EventCraftSection items={items} />)
    await screen.findByTestId('advisor')
    expect(gapPosts()).toHaveLength(1)

    rosterMock = ready({ 6518: 1 })
    rerender(<EventCraftSection items={items} />)
    await screen.findByText('英雄の証はドロップ表にありません')
    await waitFor(() => expect(gapPosts()).toHaveLength(2))
  })

  it('同じ欠落の再描画ではログを1回、組が変わると2回目を送る', async () => {
    rosterMock = ready({ 6518: 1 })
    stubDrops({ ...baseDrops, drop_rates: [baseDrops.drop_rates[0]] })
    const { rerender } = render(<EventCraftSection items={items} />)
    await screen.findByText('英雄の証はドロップ表にありません')
    await waitFor(() => expect(gapPosts()).toHaveLength(1))
    rerender(<EventCraftSection items={items} />)
    expect(gapPosts()).toHaveLength(1)

    rosterMock = ready({ 6517: 5 })
    rerender(<EventCraftSection items={items} />)
    await screen.findByText('世界樹の種はドロップ表にありますが、ドロップするクエストがありません')
    await waitFor(() => expect(gapPosts()).toHaveLength(2))
  })

  it('欠落が無いときとドロップ取得失敗では欠落ログを送らない', async () => {
    rosterMock = ready({ 6516: 10 })
    stubDrops(baseDrops)
    const { unmount } = render(<EventCraftSection items={items} />)
    await screen.findByTestId('advisor')
    expect(gapPosts()).toHaveLength(0)
    unmount()

    __resetDropsCacheForTest()
    rosterMock = ready({ 6516: 10 })
    stubDrops(new Error('network'))
    render(<EventCraftSection items={items} />)
    await screen.findByText(/ドロップデータを取得できませんでした/)
    expect(gapPosts()).toHaveLength(0)
  })

  it('/api/drops 失敗で永続ローディングにならずエラー', async () => {
    rosterMock = ready({ 6516: 10 })
    stubDrops(new Error('network'))
    render(<EventCraftSection items={items} />)
    await screen.findByText(/ドロップデータを取得できませんでした/)
    expect(screen.queryByText('データを読み込み中...')).toBeNull()
    expect(screen.queryByTestId('advisor')).toBeNull()
  })

  it('ロスター未設定で /material への導線、Advisor なし', async () => {
    stubDrops(baseDrops)
    render(<EventCraftSection items={items} />)
    const link = await screen.findByRole('link', { name: '育成対象を設定する' })
    expect(link.getAttribute('href')).toBe('/material')
    expect(screen.queryByTestId('advisor')).toBeNull()
  })

  it("purpose === 'all' で注記を出し training として計算", async () => {
    rosterMock = ready({ 6516: 10, 6517: 5 })
    setLs(STORAGE_KEYS.FARMING_PURPOSE, 'all')
    // reserve なら所持数キーの無い 6517 は落ちる。training なら残る。
    setLs(STORAGE_KEYS.POSSESSION, { 6516: 3 })
    stubDrops(baseDrops)
    render(<EventCraftSection items={items} />)
    await screen.findByTestId('advisor')
    expect(screen.getByText('配布評価は今の育成を使用')).toBeTruthy()
    expect(advisorProps.at(-1)?.fullNeed).toEqual({ '01': 7, '02': 5 })
    expect(advisorProps.at(-1)?.stockEnabled).toBe(false)
  })

  it('未設定端末でマウントしても localStorage に書き込まない', async () => {
    stubDrops(baseDrops)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<EventCraftSection items={items} />)
    await screen.findByRole('link', { name: '育成対象を設定する' })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(setItem).not.toHaveBeenCalled()
  })

  it('所持数・purpose・stock 未設定で Advisor まで描画しても書き込まない', async () => {
    rosterMock = ready({ 6516: 10 })
    stubDrops(baseDrops)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<EventCraftSection items={items} />)
    await screen.findByTestId('advisor')
    expect(setItem).not.toHaveBeenCalled()
  })
})

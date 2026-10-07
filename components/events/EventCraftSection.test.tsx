// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EventCraftSection } from './EventCraftSection'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { __resetDropsCacheForTest } from '../../hooks/use-drops'
import type { RosterNeed } from '../../hooks/use-roster-need'
import type { EnrichedItem } from '../../lib/get-items'
import type { Drops } from '../../lib/get-drops'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
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
  { id: 6516, type: 'skillLvUp', background: 'bronze', category: '銅素材', largeCategory: '強化素材' },
  { id: 6517, type: 'skillLvUp', background: 'bronze', category: '銅素材', largeCategory: '強化素材' },
  { id: 6518, type: 'skillLvUp', background: 'bronze', category: '銅素材', largeCategory: '強化素材' },
] as EnrichedItem[]

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

const stubDrops = (drops: Drops | Error) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      drops instanceof Error
        ? Promise.reject(drops)
        : Promise.resolve({ ok: true, json: () => Promise.resolve(drops) }),
    ),
  )

const setLs = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

describe('EventCraftSection', () => {
  beforeEach(() => {
    localStorage.clear()
    advisorProps.length = 0
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

  it('(b) 正の need 素材のドロップ率欠落で Advisor を出さずエラー', async () => {
    rosterMock = ready({ 6516: 10, 6517: 5 })
    stubDrops({ ...baseDrops, drop_rates: [baseDrops.drop_rates[0]] })
    render(<EventCraftSection items={items} />)
    await screen.findByText(/ドロップデータが欠けている/)
    expect(screen.queryByTestId('advisor')).toBeNull()
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeTruthy()
  })

  it('(a) 正の need 素材のカタログ欠落で Advisor を出さずエラー', async () => {
    rosterMock = ready({ 6516: 10, 6518: 1 })
    stubDrops(baseDrops)
    render(<EventCraftSection items={items} />)
    await screen.findByText(/ドロップデータが欠けている/)
    expect(screen.queryByTestId('advisor')).toBeNull()
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

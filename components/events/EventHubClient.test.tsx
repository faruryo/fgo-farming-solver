// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EventHubClient } from './EventHubClient'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'
import type { RosterNeed } from '../../hooks/use-roster-need'
import type { MaterialCatalogV1 } from '../../lib/material-catalog'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'

type CatalogState = { catalog: MaterialCatalogV1 | null; failed: boolean; reload: () => void }

const mocks = vi.hoisted(() => ({
  // undefined のときは実フック（未設定の育成計画 → empty）を使う。
  roster: undefined as RosterNeed | undefined,
  catalog: undefined as CatalogState | undefined,
  useMaterialCatalog: vi.fn(),
}))

vi.mock('../../hooks/use-roster-need', async importOriginal => {
  const actual = await importOriginal<typeof import('../../hooks/use-roster-need')>()
  return { ...actual, useRosterNeed: () => mocks.roster ?? actual.useRosterNeed() }
})

vi.mock('../../hooks/use-material-catalog', () => ({
  useMaterialCatalog: () => {
    mocks.useMaterialCatalog()
    return mocks.catalog
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const template = typeof fallback === 'string' ? fallback : key
      const vars = typeof fallback === 'object' ? fallback : options
      return vars
        ? template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
            const value: unknown = Reflect.get(vars, name)
            return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
          })
        : template
    },
  }),
}))

vi.mock('./EventPlannerClient', () => ({
  EventPlannerClient: () => <div data-testid="box-planner" />,
}))

vi.mock('./EventCraftSection', () => ({
  EventCraftSection: () => <div data-testid="craft-section" />,
}))

const shopEntry = (itemId: number, costItemId: number, extra: Partial<EventShopItem> = {}): EventShopItem => ({
  itemId,
  qty: 2,
  costItemId,
  costAmount: 30,
  limitNum: 5,
  name: `素材${itemId}`,
  ...extra,
})

const event = (overrides: Partial<EventPlannerEvent>): EventPlannerEvent => ({
  id: 80632,
  name: 'テストイベント',
  type: 'eventQuest',
  startedAt: 1000,
  endedAt: 2000,
  currency: { id: 94001, name: '武蔵うどん', icon: '' },
  unlimitedBoxes: false,
  lotteries: [],
  shop: [],
  farmingNodes: [],
  ...overrides,
})

const summary = { id: 80632, name: 'テストイベント', startedAt: 1000, endedAt: 2000 }

describe('EventHubClient', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('ロトの無い交換所イベントでは交換所一覧を通貨ごとに出し、ボックス計画は出さない', () => {
    const shopEvent = event({
      shop: [
        shopEntry(1, 94001, { costName: '武蔵うどん' }),
        shopEntry(2, 94002, { costName: '江戸むすび', limitNum: 0 }),
        shopEntry(3, 94001, { costName: '武蔵うどん', costAmount: 100, limitNum: 2 }),
      ],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    expect(screen.queryByTestId('box-planner')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '交換所の周回計算' })).toBeInTheDocument()

    const udon = screen.getByRole('heading', { name: '武蔵うどん' }).closest('div.rounded-md') as HTMLElement
    expect(within(udon).getByText('全交換 350')).toBeInTheDocument()
    expect(within(udon).getByText('素材1')).toBeInTheDocument()
    expect(within(udon).getByText('素材3')).toBeInTheDocument()
    expect(within(udon).queryByText('素材2')).not.toBeInTheDocument()

    const musubi = screen.getByRole('heading', { name: '江戸むすび' }).closest('div.rounded-md') as HTMLElement
    expect(within(musubi).getByText('全交換 0')).toBeInTheDocument()
    expect(within(musubi).getByText('＋上限なし 1 品目')).toBeInTheDocument()
    expect(within(musubi).getByText('上限なし')).toBeInTheDocument()
  })

  it('通貨名を持たないデータでは、名前不明のアイテムであることと ID を見出しに出す', () => {
    render(<EventHubClient summary={summary} boxEvent={event({ shop: [shopEntry(1, 94001)] })} features={['shop']} />)

    expect(screen.getByRole('heading', { name: '名前不明のアイテム（ID 94001）' })).toBeInTheDocument()
  })

  it('ロトのあるイベントではボックス計画を出し、交換所一覧は出さない', () => {
    const boxEvent = event({
      lotteries: [{ boxIndex: 0, costPerBox: 100, contents: [], rareRewards: [] }],
      shop: [shopEntry(1, 94001, { costName: '武蔵うどん' })],
    })
    render(<EventHubClient summary={summary} boxEvent={boxEvent} features={['box', 'shop']} />)

    expect(screen.getByTestId('box-planner')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '交換所の周回計算' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '武蔵うどん' })).not.toBeInTheDocument()
  })

  it('ロトの無い交換所イベントで回数を選ぶと必要量と周回の内訳が出る', () => {
    const shopEvent = event({
      shop: [
        shopEntry(1, 94001, { costName: '武蔵うどん' }),
        shopEntry(2, 94001, { costName: '武蔵うどん', limitNum: 0 }),
      ],
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    expect(screen.getByText('周回は不要です。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '全部交換' }))
    expect(screen.getByLabelText('素材1 の交換回数')).toHaveValue(5)
    expect(screen.getByLabelText('素材2 の交換回数')).toHaveValue(0)

    fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value: '9' } })
    expect(screen.getByLabelText('素材1 の交換回数')).toHaveValue(5)
    fireEvent.change(screen.getByLabelText('素材2 の交換回数'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('武蔵うどん の所持数'), { target: { value: '60' } })

    expect(screen.getByText('選んだ交換 210')).toBeInTheDocument()
    expect(screen.getByText('必要量 150')).toBeInTheDocument()
    expect(screen.getByText('15 周')).toBeInTheDocument()
    expect(screen.getByText('合計 15 周・AP 600')).toBeInTheDocument()
    expect(screen.getByText('武蔵うどん: 見込み 150（必要量 150）')).toBeInTheDocument()
    expect(screen.getByText('ドロップはイベントのボーナス（ドロップ増加礼装）を含まない統計値です。')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('武蔵うどん の所持数'), { target: { value: '1000' } })
    expect(screen.getByText('必要量 0')).toBeInTheDocument()
    expect(screen.getByText('周回は不要です。')).toBeInTheDocument()
  })

  it('ドロップの統計が無いときは必要量を出し、周回の代わりに出せない旨を出す', () => {
    const shopEvent = event({
      shop: [shopEntry(1, 94001, { costName: '武蔵うどん' })],
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [] }],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value: '2' } })

    expect(screen.getByText('必要量 60')).toBeInTheDocument()
    expect(screen.getByText('ドロップの統計がまだ無いため、周回を出せません。')).toBeInTheDocument()
    expect(screen.queryByText(/^合計 /)).not.toBeInTheDocument()
  })

  it('周回では落ちない通貨があるときは通貨名と集められない旨を出し、残りの通貨で周回を出す', () => {
    const shopEvent = event({
      shop: [shopEntry(1, 94001, { costName: '武蔵うどん' }), shopEntry(2, 94002, { costName: '江戸むすび' })],
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('素材2 の交換回数'), { target: { value: '1' } })

    expect(screen.getByText('江戸むすび は周回では集められません。')).toBeInTheDocument()
    expect(screen.getByText('合計 3 周・AP 120')).toBeInTheDocument()
    expect(screen.queryByText(/^江戸むすび: 見込み/)).not.toBeInTheDocument()
    expect(screen.getByTestId('shop-plan-summary')).toHaveTextContent(
      '周回の合計 3 周・AP 120 （一部の通貨は周回で集められません）',
    )
  })

  it('どの通貨も周回で落ちないときは上部の1行にその旨を出す', () => {
    const shopEvent = event({
      shop: [shopEntry(1, 94001)],
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 6001, perRun: 1 }] }],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value: '1' } })
    expect(screen.getByTestId('shop-plan-summary')).toHaveTextContent('周回の合計: 周回で集められる通貨なし')
  })

  it('KV に交換所のデータが無ければ交換所一覧を出さない', () => {
    render(<EventHubClient summary={summary} features={['shop', 'craft']} />)

    expect(screen.queryByRole('heading', { name: '交換所の周回計算' })).not.toBeInTheDocument()
  })

  it('KV のイベントの交換所が空なら交換所一覧を出さない', () => {
    render(<EventHubClient summary={summary} boxEvent={event({ shop: [] })} features={['shop']} />)

    expect(screen.queryByRole('heading', { name: '交換所の周回計算' })).not.toBeInTheDocument()
  })

  it('ロトの無い交換所イベントでは見出しの下に目的の説明を出し、ロトのあるイベントの見出しは変えない', () => {
    const { unmount } = render(
      <EventHubClient summary={summary} boxEvent={event({ shop: [shopEntry(1, 94001)] })} features={['shop']} />,
    )
    expect(screen.getByRole('heading', { name: '交換所の周回計算' })).toBeInTheDocument()
    expect(
      screen.getByText('交換したい品目の数を入れると、必要な通貨の数と、集めるのに要る周回数・AP を計算します'),
    ).toBeInTheDocument()
    unmount()

    const boxEvent = event({
      lotteries: [{ boxIndex: 0, costPerBox: 100, contents: [], rareRewards: [] }],
      shop: [shopEntry(1, 94001)],
    })
    render(<EventHubClient summary={summary} boxEvent={boxEvent} features={['box', 'shop']} />)
    expect(screen.getByRole('heading', { name: 'ロト計画' })).toBeInTheDocument()
    expect(screen.queryByText(/^交換したい品目の数を入れると/)).not.toBeInTheDocument()
  })

  it('「全部交換」を押すと、交換所の上部の1行に合計の周回数と AP が出る', () => {
    const shopEvent = event({
      shop: [shopEntry(1, 94001, { costName: '武蔵うどん' })],
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    const line = screen.getByTestId('shop-plan-summary')
    const card = cardOf('武蔵うどん')
    expect(line.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line).toHaveTextContent('周回の合計: 不要')

    fireEvent.click(screen.getByRole('button', { name: '全部交換' }))
    expect(line).toHaveTextContent('周回の合計 15 周・AP 600')
    expect(screen.getByText('合計 15 周・AP 600')).toBeInTheDocument()
  })

  it('ドロップの統計が無いときは上部の1行にもその旨を短く出す', () => {
    const shopEvent = event({
      shop: [shopEntry(1, 94001)],
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [] }],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value: '1' } })
    expect(screen.getByTestId('shop-plan-summary')).toHaveTextContent('周回の合計: ドロップの統計なし')
  })

  describe('全部交換と AP 予算', () => {
    const node = { questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }
    const farmingNodes = [node]
    const statValue = (label: string) =>
      within(screen.getByTestId('shop-ap-budget')).getByText(label).nextElementSibling?.textContent

    it('全部交換を押すと2通貨の在庫上限のある品目がすべて在庫上限になり、在庫上限の無い品目の回数は変わらない', () => {
      const shopEvent = event({
        shop: [
          shopEntry(1, 94001, { costName: '武蔵うどん', costAmount: 10, limitNum: 5 }),
          shopEntry(2, 94002, { costName: '江戸むすび', costAmount: 10, limitNum: 10 }),
          shopEntry(3, 94001, { costName: '武蔵うどん', costAmount: 1, limitNum: 0 }),
        ],
        farmingNodes: [
          { questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }, { itemId: 94002, perRun: 10 }] },
        ],
      })
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

      fireEvent.change(screen.getByLabelText('素材3 の交換回数'), { target: { value: '3' } })
      fireEvent.click(screen.getByRole('button', { name: '全部交換' }))

      expect(screen.getByLabelText('素材1 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材2 の交換回数')).toHaveValue(10)
      expect(screen.getByLabelText('素材3 の交換回数')).toHaveValue(3)
      expect(within(cardOf('武蔵うどん')).getByText('必要量 53')).toBeInTheDocument()
      expect(within(cardOf('江戸むすび')).getByText('必要量 100')).toBeInTheDocument()
      expect(screen.getByText('合計 10 周・AP 400')).toBeInTheDocument()
    })

    it('周回の合計 AP に対する回復の回数・黄金の果実・聖晶石・課金額を、箱計画と同じ保存先の値で出す', () => {
      localStorage.setItem('masterLevel', '157')
      const shopEvent = event({
        shop: [shopEntry(1, 94001, { costName: '武蔵うどん', costAmount: 50, limitNum: 5 })],
        farmingNodes,
      })
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

      expect(screen.queryByTestId('shop-ap-budget')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '全部交換' }))
      expect(screen.getByText('合計 25 周・AP 1,000')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('所持黄金の果実'), { target: { value: '3' } })
      expect(localStorage.getItem('events/goldenFruit')).toBe('3')

      expect(statValue('回復の回数')).toBe('7')
      expect(statValue('黄金の果実')).toBe('3')
      expect(statValue('必要聖晶石')).toBe('4')
      expect(statValue('課金額目安')).toBe('¥238')
      expect(screen.queryByText('周回で集められる通貨の分の AP で計算しています。')).not.toBeInTheDocument()
    })

    it('周回が不要なとき・ドロップの統計が無いときは AP 予算を出さない', () => {
      const { unmount } = render(
        <EventHubClient summary={summary} boxEvent={event({ shop: [shopEntry(1, 94001)], farmingNodes })} features={['shop']} />,
      )
      expect(screen.getByText('周回は不要です。')).toBeInTheDocument()
      expect(screen.queryByTestId('shop-ap-budget')).not.toBeInTheDocument()
      unmount()

      const noDrops = event({ shop: [shopEntry(1, 94001)], farmingNodes: [{ ...node, drops: [] }] })
      render(<EventHubClient summary={summary} boxEvent={noDrops} features={['shop']} />)
      fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value: '2' } })
      expect(screen.getByText('ドロップの統計がまだ無いため、周回を出せません。')).toBeInTheDocument()
      expect(screen.queryByTestId('shop-ap-budget')).not.toBeInTheDocument()
    })

    it('周回では集められない通貨があるときは、集められる通貨の分の AP で出し、その旨を AP 予算の近くに出す', () => {
      const shopEvent = event({
        shop: [shopEntry(1, 94001, { costName: '武蔵うどん' }), shopEntry(2, 94002, { costName: '江戸むすび' })],
        farmingNodes,
      })
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

      fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value: '1' } })
      fireEvent.change(screen.getByLabelText('素材2 の交換回数'), { target: { value: '1' } })

      const budget = screen.getByTestId('shop-ap-budget')
      expect(within(budget).getByText('周回で集められる通貨の分の AP で計算しています。')).toBeInTheDocument()
      // 既定のマスターレベル 200（最大 AP 152）で AP 120 → 回復 1 回。
      expect(statValue('回復の回数')).toBe('1')
    })
  })

  describe('効率順の並び', () => {
    const farmingNodes = [
      { questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }, { itemId: 94002, perRun: 10 }] },
    ]

    it('AP 換算値の無い品目を元の順で前に、AP 換算値のある品目を効率の高い順に順位付きで並べる。区切りの線は出さない', () => {
      const shopEvent = event({
        shop: [
          shopEntry(1, 94001, { costName: '武蔵うどん', qty: 2, costAmount: 30 }),
          shopEntry(9, 94001, { costName: '武蔵うどん' }),
          shopEntry(2, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10 }),
          shopEntry(3, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 8 }),
          shopEntry(8, 94001, { costName: '武蔵うどん' }),
        ],
        farmingNodes,
      })
      // 効率は 素材1: 2×60÷30=4、素材2: 100÷10=10、素材3: 9÷8=1.125。
      render(
        <EventHubClient
          summary={summary}
          boxEvent={shopEvent}
          features={['shop']}
          shopApPrices={{ 1: 60, 2: 100, 3: 9 }}
        />,
      )

      expect(bodyRows(cardOf('武蔵うどん'))).toEqual([
        'AP 換算なし',
        '|素材9|',
        '|素材8|',
        '効率順',
        '1|素材2|10',
        '2|素材1|4',
        '3|素材3|1.13',
      ])
      expect(screen.queryByRole('button', { name: '効率の良いところまで交換' })).not.toBeInTheDocument()
    })

    it('全品目に AP 換算値の無いカードでは見出しも順位も出さず、元の順に並べる', () => {
      const shopEvent = event({
        shop: [
          shopEntry(1, 94001, { costName: '武蔵うどん' }),
          shopEntry(7, 94002, { costName: '江戸むすび' }),
          shopEntry(6, 94002, { costName: '江戸むすび' }),
        ],
        farmingNodes,
      })
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} shopApPrices={{ 1: 60 }} />)

      const musubi = cardOf('江戸むすび')
      expect(bodyRows(musubi)).toEqual(['|素材7|', '|素材6|'])
      expect(within(cardOf('武蔵うどん')).queryByText('AP 換算なし')).not.toBeInTheDocument()
    })

    it('並べ替えた後も交換回数は品目に付いたままで、その通貨の必要量だけがその品目の対価 × 回数だけ増える', () => {
      const shopEvent = event({
        shop: [
          shopEntry(1, 94001, { costName: '武蔵うどん', costAmount: 30 }),
          shopEntry(2, 94002, { costName: '江戸むすび', costAmount: 20 }),
          shopEntry(3, 94001, { costName: '武蔵うどん', costAmount: 30 }),
          shopEntry(4, 94002, { costName: '江戸むすび', costAmount: 7 }),
          shopEntry(5, 94002, { costName: '江戸むすび', costAmount: 20 }),
        ],
        farmingNodes,
      })
      render(
        <EventHubClient
          summary={summary}
          boxEvent={shopEvent}
          features={['shop']}
          shopApPrices={{ 1: 10, 2: 10, 4: 100, 5: 10 }}
        />,
      )
      const musubi = cardOf('江戸むすび')
      const udon = cardOf('武蔵うどん')
      expect(bodyRows(musubi)[0]).toBe('1|素材4|28.57')

      fireEvent.change(screen.getByLabelText('素材4 の交換回数'), { target: { value: '3' } })

      expect(screen.getByLabelText('素材4 の交換回数')).toHaveValue(3)
      for (const id of [1, 2, 3, 5]) expect(screen.getByLabelText(`素材${id} の交換回数`)).toHaveValue(0)
      expect(within(musubi).getByText('必要量 21')).toBeInTheDocument()
      expect(within(udon).getByText('必要量 0')).toBeInTheDocument()
    })
  })

  describe('育成計画から見た要る・要らない', () => {
    const reload = vi.fn()
    // 育成計画で扱う素材は 6516〜6519（6518 は今の必要数 0）。4001（呼符）と 94100（他のイベントアイテム）は扱わない。
    const catalog = {
      schemaVersion: 1,
      updatedAt: 1,
      servants: [],
      items: [],
      sources: {},
      materials: {
        100: {
          skillMaterials: {
            1: { items: [6516, 6517, 6518, 6519].map(id => ({ item: { id }, amount: 1 })), qp: 0 },
          },
        },
      },
    } as unknown as MaterialCatalogV1
    const readyCatalog: CatalogState = { catalog, failed: false, reload }
    const ready = (need: Record<number, number>): RosterNeed => ({
      status: 'ready',
      chaldeaState: {},
      materialsForServants: {},
      totalNeed: new Map(Object.entries(need).map(([k, v]) => [Number(k), v])),
    })
    const setLs = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))
    const possession = { 6516: 25, 6517: 40 }

    const shop = [
      shopEntry(6516, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 10 }),
      shopEntry(6517, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 10 }),
      shopEntry(6518, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 10 }),
      shopEntry(6519, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 10 }),
      shopEntry(4001, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 5 }),
      shopEntry(94100, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 0 }),
    ]
    const farmingNodes = [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }]
    const renderShop = (overrides: Partial<EventPlannerEvent> = {}) =>
      render(
        <EventHubClient summary={summary} boxEvent={event({ shop, farmingNodes, ...overrides })} features={['shop']} />,
      )
    const cellOf = (name: string) => screen.getByLabelText(`${name} の交換回数`).closest('tr')?.cells[1] as HTMLElement
    const toggleOf = (name: string) => screen.getByRole('radiogroup', { name: `${name} は必要か` })
    const shortfallButton = () => screen.getByRole('button', { name: '不足素材のみ' })

    beforeEach(() => {
      mocks.roster = ready({ 6516: 30, 6517: 30, 6519: 15 })
      mocks.catalog = readyCatalog
      mocks.useMaterialCatalog.mockClear()
      reload.mockClear()
      setLs(STORAGE_KEYS.POSSESSION, possession)
    })
    afterEach(() => {
      mocks.roster = undefined
    })

    it('品目に「あと N 個」「足りている（交換不要）」「使わない」「計画の対象外」が出る', () => {
      renderShop()

      expect(within(cellOf('素材6516')).getByText('あと 5 個')).toBeInTheDocument()
      expect(within(cellOf('素材6517')).getByText('足りている（交換不要）')).toBeInTheDocument()
      expect(within(cellOf('素材6518')).getByText('使わない')).toBeInTheDocument()
      expect(within(cellOf('素材4001')).getByText('計画の対象外')).toBeInTheDocument()
      expect(within(cellOf('素材94100')).getByText('計画の対象外')).toBeInTheDocument()
      expect(within(cellOf('素材6516')).queryByRole('radiogroup')).not.toBeInTheDocument()
    })

    it('計画の対象外の品目の切り替えは初期値「不要」で、「必要」にしても交換回数は変わらない', () => {
      renderShop()

      expect(within(toggleOf('素材4001')).getByRole('radio', { name: '不要' })).toBeChecked()
      expect(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' })).not.toBeChecked()
      fireEvent.click(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' }))
      expect(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' })).toBeChecked()
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(0)
    })

    it('「必要」は描き直しても残り、交換回数は 0 から始まる', () => {
      const { unmount } = renderShop()
      fireEvent.click(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' }))
      fireEvent.click(shortfallButton())
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(5)
      unmount()

      renderShop()
      expect(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' })).toBeChecked()
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(0)
    })

    it('別のイベントでも保存した「必要」を使い、「不要」に戻すと保存からその品目が消える', () => {
      const { unmount } = renderShop()
      fireEvent.click(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' }))
      fireEvent.click(within(toggleOf('素材94100')).getByRole('radio', { name: '必要' }))
      unmount()

      renderShop({ id: 80700, shop: [shopEntry(4001, 94002, { costName: '江戸むすび', qty: 1, limitNum: 3 })] })
      expect(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' })).toBeChecked()

      fireEvent.click(within(toggleOf('素材4001')).getByRole('radio', { name: '不要' }))
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS) ?? 'null')).toEqual({
        94100: true,
      })
    })

    it('「必要」にした品目は品目 ID ごとに true として保存される', () => {
      renderShop()
      fireEvent.click(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' }))
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS) ?? 'null')).toEqual({ 4001: true })

      fireEvent.click(within(toggleOf('素材94100')).getByRole('radio', { name: '必要' }))
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS) ?? 'null')).toEqual({
        4001: true,
        94100: true,
      })
    })

    it('保存済みの値で true の品目だけを「必要」にする', () => {
      setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 94100: true })
      renderShop()
      expect(within(toggleOf('素材94100')).getByRole('radio', { name: '必要' })).toBeChecked()
      expect(within(toggleOf('素材4001')).getByRole('radio', { name: '不要' })).toBeChecked()
    })

    it.each([null, [94100], 'broken'])('保存した要る・要らないが壊れていても（%j）落ちず、全品目を「不要」として出す', stored => {
      setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, stored)
      renderShop()
      expect(within(toggleOf('素材94100')).getByRole('radio', { name: '不要' })).toBeChecked()
      expect(within(toggleOf('素材4001')).getByRole('radio', { name: '不要' })).toBeChecked()
    })

    it.each([null, [25, 40], 'broken'])('保存した実所持数が壊れていても（%j）落ちず、所持 0 として出す', stored => {
      setLs(STORAGE_KEYS.POSSESSION, stored)
      renderShop()
      expect(within(cellOf('素材6516')).getByText('あと 30 個')).toBeInTheDocument()
    })

    it('選んだことの無い端末では、開いただけで要る・要らないの保存を作らない', () => {
      renderShop()
      expect(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS)).toBeNull()
    })

    it('不足素材のみで不足の分と「必要」の在庫上限を入れ、周回の内訳を出し、その後も回数を変えられる', () => {
      renderShop()
      fireEvent.click(within(toggleOf('素材4001')).getByRole('radio', { name: '必要' }))
      fireEvent.click(within(toggleOf('素材94100')).getByRole('radio', { name: '必要' }))
      expect(within(cellOf('素材94100')).queryByText('上限なし: 回数を入れてください')).not.toBeInTheDocument()

      fireEvent.click(shortfallButton())

      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材6517 の交換回数')).toHaveValue(0)
      expect(screen.getByLabelText('素材6518 の交換回数')).toHaveValue(0)
      expect(screen.getByLabelText('素材6519 の交換回数')).toHaveValue(10)
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材94100 の交換回数')).toHaveValue(0)
      expect(within(cellOf('素材94100')).getByText('上限なし: 回数を入れてください')).toBeInTheDocument()
      fireEvent.click(within(toggleOf('素材94100')).getByRole('radio', { name: '不要' }))
      expect(within(cellOf('素材94100')).queryByText('上限なし: 回数を入れてください')).not.toBeInTheDocument()
      fireEvent.click(within(toggleOf('素材94100')).getByRole('radio', { name: '必要' }))
      expect(screen.getByText('必要量 200')).toBeInTheDocument()
      expect(screen.getByText('合計 20 周・AP 800')).toBeInTheDocument()

      fireEvent.click(within(toggleOf('素材4001')).getByRole('radio', { name: '不要' }))
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(5)

      fireEvent.change(screen.getByLabelText('素材94100 の交換回数'), { target: { value: '3' } })
      fireEvent.change(screen.getByLabelText('素材6516 の交換回数'), { target: { value: '1' } })
      expect(screen.getByLabelText('素材94100 の交換回数')).toHaveValue(3)
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(1)
      expect(within(cellOf('素材94100')).queryByText('上限なし: 回数を入れてください')).not.toBeInTheDocument()

      fireEvent.click(shortfallButton())
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(0)
      expect(screen.getByText('合計 15 周・AP 600')).toBeInTheDocument()
    })

    it('在庫上限で埋まらない素材に「交換所では N 個足りない」を出し、要約の数が合う', () => {
      renderShop()

      expect(within(cellOf('素材6519')).getByText('交換所では 5 個足りない')).toBeInTheDocument()
      expect(within(cellOf('素材6516')).queryByText(/交換所では/)).not.toBeInTheDocument()
      expect(screen.getByText('育成計画の不足 2 素材のうち、交換所で埋まるのは 1 素材')).toBeInTheDocument()
    })

    it('育成計画が未設定なら、ラベル・切り替え・要約を出さず、不足素材のみを押せず、設定のリンクを出す', () => {
      mocks.roster = { status: 'empty' }
      renderShop()

      expect(screen.queryByText('あと 5 個')).not.toBeInTheDocument()
      expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByTestId('shop-shortfall-summary')).not.toBeInTheDocument()
      expect(shortfallButton()).toBeDisabled()
      expect(screen.getByRole('link', { name: '育成対象を設定する' })).toHaveAttribute('href', '/material')

      fireEvent.click(screen.getByRole('button', { name: '全部交換' }))
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(10)
      expect(mocks.useMaterialCatalog).not.toHaveBeenCalled()
    })

    it('育成計画の読み込みに失敗したとき・読み込み中は、不足素材のみを押せない', () => {
      mocks.roster = { status: 'error' }
      const { unmount } = renderShop()
      expect(
        screen.getByText('育成素材データの一部を取得できませんでした。時間をおいて再読み込みしてください。'),
      ).toBeInTheDocument()
      expect(screen.queryByText('あと 5 個')).not.toBeInTheDocument()
      expect(shortfallButton()).toBeDisabled()
      unmount()

      mocks.roster = { status: 'loading' }
      renderShop()
      expect(screen.getByText('育成計画を読み込み中...')).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(shortfallButton()).toBeDisabled()
    })

    it('素材の一覧を読み込めないと、必要数のある品目のラベルだけを出し、見分けられないことと再読み込みを出す', () => {
      mocks.catalog = { catalog: null, failed: true, reload }
      renderShop()

      expect(within(cellOf('素材6516')).getByText('あと 5 個')).toBeInTheDocument()
      expect(within(cellOf('素材6517')).getByText('足りている（交換不要）')).toBeInTheDocument()
      expect(screen.queryByText('使わない')).not.toBeInTheDocument()
      expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(
        screen.getByText('素材の一覧を読み込めず、計画の対象外の品目を見分けられません。'),
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '再読み込み' }))
      expect(reload).toHaveBeenCalled()

      fireEvent.click(shortfallButton())
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(5)
    })

    it('素材の一覧を読み込み中は、必要数 0 の品目にラベルと切り替えを出さず、見分けられない旨も出さない', () => {
      mocks.catalog = { catalog: null, failed: false, reload }
      renderShop()

      expect(within(cellOf('素材6516')).getByText('あと 5 個')).toBeInTheDocument()
      expect(screen.queryByText('使わない')).not.toBeInTheDocument()
      expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByText(/見分けられません/)).not.toBeInTheDocument()
    })

    describe('既定で交換する品目（伝承結晶・夢火）', () => {
      // 伝承結晶（6999）は育成計画で扱う素材、夢火（1000）は扱わない。
      const loreCatalog = {
        ...catalog,
        materials: {
          100: { skillMaterials: { 1: { items: [6516, 6999].map(id => ({ item: { id }, amount: 1 })), qp: 0 } } },
        },
      } as unknown as MaterialCatalogV1
      const defaultShop = [
        shopEntry(6999, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 2 }),
        shopEntry(1000, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 1 }),
        shopEntry(6999, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 0 }),
      ]
      const lastLoreCell = () =>
        screen.getAllByLabelText('素材6999 の交換回数')[1].closest('tr')?.cells[1] as HTMLElement

      beforeEach(() => {
        mocks.roster = ready({})
        mocks.catalog = { catalog: loreCatalog, failed: false, reload }
      })

      it('未選択の伝承結晶は「使わない」と「必要」の切り替えで出て、不足素材のみで在庫上限の回数が入る', () => {
        renderShop({ shop: defaultShop })

        const [loreCell] = screen.getAllByLabelText('素材6999 の交換回数').map(input => input.closest('tr')?.cells[1])
        expect(within(loreCell as HTMLElement).getByText('使わない')).toBeInTheDocument()
        const [loreToggle] = screen.getAllByRole('radiogroup', { name: '素材6999 は必要か' })
        expect(within(loreToggle).getByRole('radio', { name: '必要' })).toBeChecked()

        fireEvent.click(shortfallButton())
        const [limited, unlimited] = screen.getAllByLabelText('素材6999 の交換回数')
        expect(limited).toHaveValue(2)
        expect(unlimited).toHaveValue(0)
        expect(within(lastLoreCell()).getByText('上限なし: 回数を入れてください')).toBeInTheDocument()
        expect(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS)).toBeNull()
      })

      it('伝承結晶を「不要」にすると不足素材のみで 0 になり、選択は端末に false で残る', () => {
        const { unmount } = renderShop({ shop: defaultShop })
        fireEvent.click(within(screen.getAllByRole('radiogroup', { name: '素材6999 は必要か' })[0]).getByRole('radio', { name: '不要' }))
        expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS) ?? 'null')).toEqual({
          6999: false,
        })

        fireEvent.click(shortfallButton())
        for (const input of screen.getAllByLabelText('素材6999 の交換回数')) expect(input).toHaveValue(0)
        expect(screen.queryByText('上限なし: 回数を入れてください')).not.toBeInTheDocument()
        unmount()

        renderShop({ id: 80700, shop: [shopEntry(6999, 94002, { costName: '江戸むすび', qty: 1, limitNum: 3 })] })
        expect(within(toggleOf('素材6999')).getByRole('radio', { name: '不要' })).toBeChecked()
      })

      it('未選択の夢火は「計画の対象外」と「必要」で出て、不足素材のみで在庫上限まで入る', () => {
        renderShop({ shop: defaultShop })

        expect(within(cellOf('素材1000')).getByText('計画の対象外')).toBeInTheDocument()
        expect(within(toggleOf('素材1000')).getByRole('radio', { name: '必要' })).toBeChecked()
        fireEvent.click(shortfallButton())
        expect(screen.getByLabelText('素材1000 の交換回数')).toHaveValue(1)
      })

      it('不足のある伝承結晶にも「あと N 個」と切り替えが出る', () => {
        mocks.roster = ready({ 6999: 5 })
        setLs(STORAGE_KEYS.POSSESSION, { 6999: 2 })
        renderShop({ shop: [defaultShop[0]] })

        expect(within(cellOf('素材6999')).getByText('あと 3 個')).toBeInTheDocument()
        expect(within(toggleOf('素材6999')).getByRole('radio', { name: '必要' })).toBeChecked()
      })

      it('素材の一覧を読み込めなくても、伝承結晶は「使わない」、夢火は「計画の対象外」と切り替えで出る', () => {
        mocks.catalog = { catalog: null, failed: true, reload }
        renderShop({ shop: [defaultShop[0], defaultShop[1]] })

        expect(within(cellOf('素材6999')).getByText('使わない')).toBeInTheDocument()
        expect(within(cellOf('素材1000')).getByText('計画の対象外')).toBeInTheDocument()
        expect(toggleOf('素材6999')).toBeInTheDocument()
        expect(toggleOf('素材1000')).toBeInTheDocument()
      })
    })

    describe('サーヴァント扱いの品目', () => {
      const icon = (id: number) => `https://static.atlasacademy.io/JP/Faces/f_${id}0.png`
      const svtEntry = (itemId: number, name: string, limitNum: number, costItemId = 94001): EventShopItem => ({
        itemId,
        kind: 'svt',
        qty: 1,
        costItemId,
        costAmount: 10,
        limitNum,
        name,
        icon: icon(itemId),
        costName: costItemId === 94001 ? '武蔵うどん' : '江戸むすび',
      })
      // 9305420 は礼装とイベントアイテムで番号が同じ。6516 は育成計画で必要数のある素材の番号。
      const svtShop = [
        svtEntry(9770500, '叡智の大火', 100),
        svtEntry(9700300, '星のフォウくん', 40),
        svtEntry(9305420, '完璧なお正月', 2),
        svtEntry(9305420, '完璧なお正月', 1, 94002),
        svtEntry(6516, '番号が素材と同じ礼装', 1),
        shopEntry(9305420, 94001, { name: '同じ番号のアイテム', qty: 1, costAmount: 10, limitNum: 3 }),
      ]
      const renderSvtShop = () => renderShop({ shop: svtShop })

      it('名前とアイコンとともに並び、「計画の対象外」と必要／不要の切り替えが出る', () => {
        renderSvtShop()
        for (const [id, name] of [
          [9770500, '叡智の大火'],
          [9700300, '星のフォウくん'],
          [6516, '番号が素材と同じ礼装'],
        ] as const) {
          expect(cellOf(name).querySelector('img')?.getAttribute('src')).toContain(encodeURIComponent(icon(id)))
          expect(within(cellOf(name)).getByText('計画の対象外')).toBeInTheDocument()
          expect(within(toggleOf(name)).getByRole('radio', { name: '不要' })).toBeChecked()
        }
        expect(screen.getAllByLabelText('完璧なお正月 の交換回数')).toHaveLength(2)
      })

      it('礼装を「必要」にすると svt:<番号> のキーで保存し、同じ番号のアイテムのキーは作らない', () => {
        renderSvtShop()
        const [ce] = screen.getAllByRole('radiogroup', { name: '完璧なお正月 は必要か' })
        fireEvent.click(within(ce).getByRole('radio', { name: '必要' }))

        expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS) ?? 'null')).toEqual({
          'svt:9305420': true,
        })
        for (const group of screen.getAllByRole('radiogroup', { name: '完璧なお正月 は必要か' })) {
          expect(within(group).getByRole('radio', { name: '必要' })).toBeChecked()
        }
        expect(within(toggleOf('同じ番号のアイテム')).getByRole('radio', { name: '不要' })).toBeChecked()

        fireEvent.click(shortfallButton())
        const [ceA, ceB] = screen.getAllByLabelText('完璧なお正月 の交換回数')
        expect(ceA).toHaveValue(2)
        expect(ceB).toHaveValue(1)
        expect(screen.getByLabelText('同じ番号のアイテム の交換回数')).toHaveValue(0)
        expect(screen.getByLabelText('叡智の大火 の交換回数')).toHaveValue(0)
      })

      it('全部交換を押すと在庫上限の回数になる', () => {
        renderSvtShop()
        fireEvent.click(screen.getByRole('button', { name: '全部交換' }))
        expect(screen.getByLabelText('叡智の大火 の交換回数')).toHaveValue(100)
        expect(screen.getByLabelText('星のフォウくん の交換回数')).toHaveValue(40)
        const [ceA, ceB] = screen.getAllByLabelText('完璧なお正月 の交換回数')
        expect(ceA).toHaveValue(2)
        expect(ceB).toHaveValue(1)
      })

      it('育成計画が未設定のとき・素材の一覧を読み込めないときは切り替えを出さない', () => {
        mocks.roster = { status: 'empty' }
        const { unmount } = renderSvtShop()
        expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
        unmount()

        mocks.roster = ready({ 6516: 30 })
        mocks.catalog = { catalog: null, failed: true, reload }
        renderSvtShop()
        expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
        expect(within(cellOf('番号が素材と同じ礼装')).queryByText(/あと/)).not.toBeInTheDocument()
      })

      describe('品目がすべてサーヴァント扱いの交換所', () => {
        const catalogShop = [
          svtEntry(9770500, '叡智の大火', 100),
          { ...svtEntry(9700300, '星のフォウくん', 0), qty: 3 },
          svtEntry(9305420, '完璧なお正月', 2, 94002),
        ]
        const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
        const pointItemId = 94001
        const DESCRIPTION = 'この交換所には礼装などしか並ばないため、周回数は計算せず、品目と対価だけを並べます'
        // 説明文の「周回数」を除いて、周回に関わる表示が無いことを見るため、確かめた後に説明文を外す。
        const takeDescription = () => {
          const description = screen.getByText(DESCRIPTION)
          description.remove()
        }

        const expectCatalogOnly = () => {
          expect(screen.getByRole('heading', { name: '交換所の品目' })).toBeInTheDocument()
          expect(screen.queryByRole('heading', { name: '交換所の周回計算' })).not.toBeInTheDocument()

          const udon = screen.getByRole('heading', { name: '武蔵うどん' }).closest('div.rounded-md') as HTMLElement
          const musubi = screen.getByRole('heading', { name: '江戸むすび' }).closest('div.rounded-md') as HTMLElement
          expect(within(udon).getByText('叡智の大火')).toBeInTheDocument()
          expect(within(udon).getByText('星のフォウくん')).toBeInTheDocument()
          expect(within(musubi).getByText('完璧なお正月')).toBeInTheDocument()
          expect(within(udon).getAllByRole('columnheader').map(th => th.textContent)).toEqual([
            '品目',
            '個数',
            '上限',
            '対価',
          ])

          const fire = within(rowOf('叡智の大火'))
          expect(rowOf('叡智の大火').querySelector('img')?.getAttribute('src')).toContain(
            encodeURIComponent(icon(9770500)),
          )
          expect(fire.getByText('×1')).toBeInTheDocument()
          expect(fire.getByText('100')).toBeInTheDocument()
          expect(fire.getByText('10')).toBeInTheDocument()
          const fou = within(rowOf('星のフォウくん'))
          expect(fou.getByText('×3')).toBeInTheDocument()
          expect(fou.getByText('上限なし')).toBeInTheDocument()

          expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
          expect(screen.queryByRole('button', { name: '全部交換' })).not.toBeInTheDocument()
          expect(screen.queryByRole('button', { name: '不足素材のみ' })).not.toBeInTheDocument()
          expect(screen.queryByLabelText(/の所持数$/)).not.toBeInTheDocument()
          expect(screen.queryByText(/必要量/)).not.toBeInTheDocument()
          expect(screen.queryByLabelText(/のドロップボーナス$/)).not.toBeInTheDocument()
          expect(screen.queryByTestId('shop-per-run')).not.toBeInTheDocument()
          expect(screen.queryByText('1周の獲得量')).not.toBeInTheDocument()
          expect(screen.queryByTestId('shop-plan-summary')).not.toBeInTheDocument()
          expect(screen.queryByText(/周回/)).not.toBeInTheDocument()
          expect(screen.queryByTestId('shop-ap-budget')).not.toBeInTheDocument()
          expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
          expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
          expect(screen.queryByText(/全交換/)).not.toBeInTheDocument()
          expect(screen.queryByText(/上限なし \d+ 品目/)).not.toBeInTheDocument()
          expect(mocks.useMaterialCatalog).not.toHaveBeenCalled()
        }

        it('周回クエストが無いとき、品目の一覧だけを出す', () => {
          render(
            <EventHubClient
              summary={summary}
              boxEvent={event({ shop: catalogShop, farmingNodes: [] })}
              features={['shop']}
              pointItemId={pointItemId}
            />,
          )
          takeDescription()
          expectCatalogOnly()
        })

        it('周回クエストはあるが対価の通貨を落とさないとき、品目の一覧だけを出す', () => {
          render(
            <EventHubClient
              summary={summary}
              boxEvent={event({
                shop: catalogShop,
                farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 6001, perRun: 1 }] }],
              })}
              features={['shop']}
              pointItemId={pointItemId}
            />,
          )
          takeDescription()
          expectCatalogOnly()
        })

        it('礼装とアイテムの品目が混在するときは、今までどおり周回計算を出す', () => {
          renderShop({ shop: [...catalogShop, shopEntry(6516, 94001, { costName: '武蔵うどん' })] })
          expect(screen.getByRole('heading', { name: '交換所の周回計算' })).toBeInTheDocument()
          expect(screen.queryByRole('heading', { name: '交換所の品目' })).not.toBeInTheDocument()
          expect(screen.getByLabelText('叡智の大火 の交換回数')).toBeInTheDocument()
          fireEvent.click(screen.getByRole('button', { name: '全部交換' }))
          expect(screen.getByLabelText('叡智の大火 の交換回数')).toHaveValue(100)
        })
      })
    })

    it('所持数は POSSESSION から読み、ITEMS の値は使わず、POSSESSION を書き換えない', () => {
      setLs(STORAGE_KEYS.ITEMS, { 6516: 0, 6517: 0, 6519: 15 })
      const before = localStorage.getItem(STORAGE_KEYS.POSSESSION)
      renderShop()

      expect(within(cellOf('素材6516')).getByText('あと 5 個')).toBeInTheDocument()
      expect(within(cellOf('素材6517')).getByText('足りている（交換不要）')).toBeInTheDocument()
      expect(within(cellOf('素材6519')).getByText('あと 15 個')).toBeInTheDocument()
      fireEvent.click(shortfallButton())
      expect(localStorage.getItem(STORAGE_KEYS.POSSESSION)).toBe(before)
    })
  })

  describe('ドロップ増加礼装のボーナス', () => {
    const UDON = 94001
    const MUSUBI = 94002
    const DANGO = 94003
    const POINT = 94099
    const bonusEvent = (withCount = true) =>
      event({
        shop: [
          shopEntry(1, UDON, { costName: '武蔵うどん', costAmount: 30, limitNum: 10 }),
          shopEntry(2, MUSUBI, { costName: '江戸むすび' }),
          shopEntry(3, DANGO, { costName: '吉備団子' }),
        ],
        farmingNodes: [
          {
            questId: 1,
            name: '上級',
            ap: 40,
            drops: [
              { itemId: UDON, perRun: 10, ...(withCount ? { countPerRun: 5 } : {}) },
              { itemId: POINT, perRun: 600, ...(withCount ? { countPerRun: 3 } : {}), name: 'うどんポイント' },
            ],
          },
          { questId: 2, name: '素材', ap: 20, drops: [{ itemId: 6001, perRun: 1, countPerRun: 1 }] },
        ],
      })
    const renderShop = (shopEvent: EventPlannerEvent, pointItemId?: number) =>
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} pointItemId={pointItemId} />)
    const bonusInput = (name: string) => screen.getByLabelText(`${name} のドロップボーナス`)
    const bonusCard = () =>
      screen.getByRole('heading', { name: 'ドロップ増加礼装' }).closest('div.rounded-md') as HTMLElement
    const perRunCells = () =>
      Array.from(screen.getByTestId('shop-per-run').querySelectorAll('tbody tr')).map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.textContent),
      )
    const needUdon = (value: string) =>
      fireEvent.change(screen.getByLabelText('素材1 の交換回数'), { target: { value } })
    const NOTE = 'ドロップはイベントのボーナス（ドロップ増加礼装）を含まない統計値です。'

    it('ポイントの品目があるときは通貨とポイントの欄が初期値 0 で出る', () => {
      renderShop(bonusEvent(), POINT)
      for (const name of ['武蔵うどん', '江戸むすび', '吉備団子', 'うどんポイント']) {
        expect(bonusInput(name)).toHaveValue(0)
      }
    })

    it('ポイントの品目が無いときは通貨の欄だけが出る', () => {
      renderShop(bonusEvent())
      for (const name of ['武蔵うどん', '江戸むすび', '吉備団子']) expect(bonusInput(name)).toHaveValue(0)
      expect(screen.queryByLabelText('うどんポイント のドロップボーナス')).not.toBeInTheDocument()
    })

    it('見出しと説明の1行を出し、注記と説明にサーヴァントが出ない', () => {
      renderShop(bonusEvent(), POINT)
      expect(
        within(bonusCard()).getByText(
          '編成した礼装の 1ドロップにつき +N を入れると、1周の獲得量と周回数がボーナス込みになります',
        ),
      ).toBeInTheDocument()
      needUdon('10')
      fireEvent.change(bonusInput('武蔵うどん'), { target: { value: '2' } })
      expect(document.body.textContent).not.toContain('サーヴァント')
    })

    it('ボーナスのカードの直下に1周の獲得量の表があり、通貨ごとのカードより上にある', () => {
      renderShop(bonusEvent(), POINT)
      const perRun = screen.getByTestId('shop-per-run')
      expect(bonusCard().nextElementSibling).toBe(perRun)
      expect(perRun.compareDocumentPosition(cardOf('武蔵うどん')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('通貨もポイントも落ちないクエストは表に出ず、値は小数1桁', () => {
      renderShop(bonusEvent(), POINT)
      expect(perRunCells()).toEqual([['上級AP40', '10.0', '-', '-', '600.0']])
    })

    it('ボーナスを入れると1周の獲得量・周回数・注記が変わる', () => {
      renderShop(bonusEvent(), POINT)
      needUdon('10')
      expect(screen.getByText('30 周')).toBeInTheDocument()
      expect(screen.getByText(NOTE)).toBeInTheDocument()

      fireEvent.change(bonusInput('武蔵うどん'), { target: { value: '2' } })
      fireEvent.change(bonusInput('うどんポイント'), { target: { value: '100' } })

      expect(perRunCells()).toEqual([['上級AP40', '20.0+10.0', '-', '-', '900.0+300.0']])
      expect(screen.getByText('15 周')).toBeInTheDocument()
      expect(
        screen.getByText(`${NOTE}入れたドロップ増加礼装のボーナス（1ドロップにつき +N）を足して計算しています。`),
      ).toBeInTheDocument()
      expect(screen.queryByText(/ボーナスを反映できません/)).not.toBeInTheDocument()
    })

    it('回数を持たないドロップだけのときは反映できない旨を出し、周回の内訳は素の値のまま', () => {
      renderShop(bonusEvent(false), POINT)
      needUdon('10')
      fireEvent.change(bonusInput('武蔵うどん'), { target: { value: '2' } })

      expect(screen.getByText('武蔵うどん はデータの更新前のため、ボーナスを反映できません。')).toBeInTheDocument()
      expect(perRunCells()).toEqual([['上級AP40', '10.0', '-', '-', '600.0']])
      expect(screen.getByText('30 周')).toBeInTheDocument()
    })

    it('-3 と 2.5 は 0 と 2 として扱う', () => {
      renderShop(bonusEvent(), POINT)
      needUdon('10')
      fireEvent.change(bonusInput('武蔵うどん'), { target: { value: '-3' } })
      expect(bonusInput('武蔵うどん')).toHaveValue(0)
      expect(screen.getByText('30 周')).toBeInTheDocument()

      fireEvent.change(bonusInput('武蔵うどん'), { target: { value: '2.5' } })
      expect(bonusInput('武蔵うどん')).toHaveValue(2)
      expect(screen.getByText('15 周')).toBeInTheDocument()
    })
  })
})

const cardOf = (currency: string) =>
  screen.getByRole('heading', { name: currency }).closest('div.rounded-md') as HTMLElement

/** カードの表の行を「順位|品目名|効率」か、見出しの行の文言にする。 */
const bodyRows = (card: HTMLElement) =>
  Array.from(card.querySelectorAll<HTMLTableRowElement>('tbody tr')).map(tr => {
    const input = tr.querySelector('input')
    if (!input) return tr.textContent
    const name = input.getAttribute('aria-label')?.replace(' の交換回数', '')
    return `${tr.cells[0]?.textContent}|${name}|${tr.cells[6]?.textContent}`
  })

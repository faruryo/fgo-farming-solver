// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EventHubClient } from './EventHubClient'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'

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

  it('通貨名を持たない古いデータでは通貨の ID を見出しに出す', () => {
    render(<EventHubClient summary={summary} boxEvent={event({ shop: [shopEntry(1, 94001)] })} features={['shop']} />)

    expect(screen.getByRole('heading', { name: 'ID 94001' })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: '在庫上限まですべて交換する数を入れる' }))
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
    expect(screen.getByText('ドロップはイベントのボーナス（礼装・サーヴァント）を含まない統計値です。')).toBeInTheDocument()

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

  it('「在庫上限まですべて交換する数を入れる」を押すと、交換所の上部の1行に合計の周回数と AP が出る', () => {
    const shopEvent = event({
      shop: [shopEntry(1, 94001, { costName: '武蔵うどん' })],
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }],
    })
    render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

    const line = screen.getByTestId('shop-plan-summary')
    const card = cardOf('武蔵うどん')
    expect(line.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line).toHaveTextContent('周回の合計: 不要')

    fireEvent.click(screen.getByRole('button', { name: '在庫上限まですべて交換する数を入れる' }))
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
      fireEvent.click(screen.getByRole('button', { name: 'すべての通貨で、在庫上限まですべて交換する数を入れる' }))

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
      fireEvent.click(screen.getByRole('button', { name: 'すべての通貨で、在庫上限まですべて交換する数を入れる' }))
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

    it('AP 換算値の無い品目を元の順で前に、AP 換算値のある品目を効率の高い順に順位付きで並べ、区切りを効率順の中に出す', () => {
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
      // 基準は 40 ÷ 10 = 4。効率は 素材1: 2×60÷30=4（基準と等しい）、素材2: 100÷10=10、素材3: 9÷8=1.125。
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
        'ここまで交換すれば効率が良い （基準 1個 4 AP）',
        '3|素材3|1.13',
      ])
    })

    it('全品目に AP 換算値の無いカードでは見出しも順位も区切りも出さず、元の順に並べる', () => {
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
      expect(within(musubi).queryByTestId('shop-cutoff')).not.toBeInTheDocument()
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
})

const cardOf = (currency: string) =>
  screen.getByRole('heading', { name: currency }).closest('div.rounded-md') as HTMLElement

/** カードの表の行を「順位|品目名|効率」か、見出し・区切りの行の文言にする。 */
const bodyRows = (card: HTMLElement) =>
  Array.from(card.querySelectorAll<HTMLTableRowElement>('tbody tr')).map(tr => {
    const input = tr.querySelector('input')
    if (!input) return tr.textContent
    const name = input.getAttribute('aria-label')?.replace(' の交換回数', '')
    return `${tr.cells[0]?.textContent}|${name}|${tr.cells[6]?.textContent}`
  })

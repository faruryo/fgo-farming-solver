// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { EventHubClient } from './EventHubClient'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'
import type { RosterNeed } from '../../hooks/use-roster-need'
import type { MaterialCatalogV1 } from '../../lib/material-catalog'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { shopItemKeys } from '../../lib/event-shop-summary'

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

vi.mock('react-i18next', async () => (await import('../i18n-test-utils')).translationMock())

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

/** 「⋯」のメニューを開く（開いたままなら何もしない）。 */
const openShopMenu = () => {
  if (!screen.queryByRole('menu')) fireEvent.click(screen.getByRole('button', { name: 'その他の操作' }))
}
/** まとめて入れる操作。回数が空のときの行のボタンがあればそれを、無ければ「⋯」のメニューの項目を返す。 */
const bulkAction = (name: string): HTMLElement => {
  const button = screen.queryByRole('button', { name })
  if (button) return button
  openShopMenu()
  return screen.getByRole('menuitem', { name: accessible => accessible.startsWith(name) })
}

describe('EventHubClient', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('ロトの無い交換所イベントでは交換所の品目を1つの一覧に出し、通貨ごとの全交換の合計を一覧の下に出し、ボックス計画は出さない', () => {
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

    const list = screen.getByTestId('shop-item-list')
    expect(bodyRows(list)).toEqual(['|素材1|', '|素材2|', '|素材3|'])
    expect(within(rowOfItem('素材2')).getByText('上限なし')).toBeInTheDocument()
    expect(within(rowOfItem('素材2')).getByText('江戸むすび')).toBeInTheDocument()

    const udon = cardOf('武蔵うどん')
    expect(within(udon).getByText('全交換 350')).toBeInTheDocument()
    expect(within(udon).queryByText('素材1')).not.toBeInTheDocument()

    const musubi = cardOf('江戸むすび')
    expect(within(musubi).getByText('全交換 0')).toBeInTheDocument()
    expect(within(musubi).getByText('＋上限なし 1 品目')).toBeInTheDocument()
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

    fireEvent.click(bulkAction('全部交換'))
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
      screen.getByText('交換したい数を入れると、要る周回数と AP が出ます'),
    ).toBeInTheDocument()
    unmount()

    const boxEvent = event({
      lotteries: [{ boxIndex: 0, costPerBox: 100, contents: [], rareRewards: [] }],
      shop: [shopEntry(1, 94001)],
    })
    render(<EventHubClient summary={summary} boxEvent={boxEvent} features={['box', 'shop']} />)
    expect(screen.getByRole('heading', { name: 'ロト計画' })).toBeInTheDocument()
    expect(screen.queryByText(/^交換したい数を入れると/)).not.toBeInTheDocument()
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

    fireEvent.click(bulkAction('全部交換'))
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
      fireEvent.click(bulkAction('全部交換'))

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
      fireEvent.click(bulkAction('全部交換'))
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

    it('AP 換算値のある品目を効率の高い順に順位付きで並べ、その後に AP 換算値の無い品目を元の順で並べる。区切りの線は出さない', () => {
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

      expect(bodyRows(screen.getByTestId('shop-item-list'))).toEqual([
        '効率順',
        '1|素材2|10',
        '2|素材1|4',
        '3|素材3|1.13',
        'AP 換算なし',
        '|素材9|',
        '|素材8|',
      ])
      expect(screen.queryByRole('button', { name: '効率の良いところまで交換' })).not.toBeInTheDocument()
    })

    it('通貨をまたいで効率の高い順に並べ、AP 換算値の無い品目は通貨によらず交換所の順で後に並べる', () => {
      const shopEvent = event({
        shop: [
          shopEntry(1, 94001, { costName: '武蔵うどん' }),
          shopEntry(7, 94002, { costName: '江戸むすび' }),
          shopEntry(6, 94002, { costName: '江戸むすび' }),
        ],
        farmingNodes,
      })
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} shopApPrices={{ 1: 60 }} />)

      expect(bodyRows(screen.getByTestId('shop-item-list'))).toEqual([
        '効率順',
        '1|素材1|4',
        'AP 換算なし',
        '|素材7|',
        '|素材6|',
      ])
    })

    it('「いらない」の行を除いて順位と見出しを付け、効率 9 の品目を「いらない」にすると次の行が順位 1 になる', () => {
      const shopEvent = event({
        shop: [
          shopEntry(2, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10 }),
          shopEntry(1, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10 }),
          shopEntry(8, 94001, { costName: '武蔵うどん' }),
          shopEntry(3, 94002, { costName: '江戸むすび', qty: 1, costAmount: 10 }),
        ],
        farmingNodes,
      })
      render(
        <EventHubClient
          summary={summary}
          boxEvent={shopEvent}
          features={['shop']}
          shopApPrices={{ 1: 90, 2: 77.2, 3: 76.3 }}
        />,
      )
      const list = () => screen.getByTestId('shop-item-list')
      expect(bodyRows(list())).toEqual(['効率順', '1|素材1|9', '2|素材2|7.72', '3|素材3|7.63', 'AP 換算なし', '|素材8|'])

      chooseWant('素材1', 'いらない')
      expect(bodyRows(list())).toEqual(['効率順', '1|素材2|7.72', '2|素材3|7.63', 'AP 換算なし', '|素材8|'])

      // 効率の無い行がすべて「いらない」なら見出しを出さない。
      chooseWant('素材8', 'いらない')
      expect(bodyRows(list())).toEqual(['1|素材2|7.72', '2|素材3|7.63'])
      expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 2 件')

      // 「欲しい」に戻すと、効率の順で決まる位置に戻る。
      fireEvent.click(unwantedSummary() as HTMLElement)
      chooseWant('素材1', '欲しい')
      expect(bodyRows(list())).toEqual(['1|素材1|9', '2|素材2|7.72', '3|素材3|7.63'])
    })

    it('効率のある品目が無い交換所では見出しも順位も出さず、交換所の順に並べる', () => {
      const shopEvent = event({
        shop: [
          shopEntry(7, 94002, { costName: '江戸むすび' }),
          shopEntry(1, 94001, { costName: '武蔵うどん' }),
          shopEntry(6, 94002, { costName: '江戸むすび' }),
        ],
        farmingNodes,
      })
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} />)

      expect(bodyRows(screen.getByTestId('shop-item-list'))).toEqual(['|素材7|', '|素材1|', '|素材6|'])
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
      expect(bodyRows(screen.getByTestId('shop-item-list'))[1]).toBe('1|素材4|28.57')

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
    const shortfallButton = () => bulkAction('足りない分だけ')
    const storedWant = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS) ?? 'null') as unknown
    const inputNames = () =>
      screen.getAllByLabelText(/ の交換回数$/).map(input => input.getAttribute('aria-label')?.replace(' の交換回数', ''))

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

    it('品目に「育成にあと N 個」「足りている（交換不要）」「使わない」「計画の対象外」が出て、行に切り替えは常には出ない', () => {
      renderShop()

      expect(within(cellOf('素材6516')).getByText('育成にあと 5 個')).toBeInTheDocument()
      expect(within(cellOf('素材6517')).getByText('足りている（交換不要）')).toBeInTheDocument()
      expect(within(cellOf('素材6518')).getByText('使わない')).toBeInTheDocument()
      expect(within(cellOf('素材4001')).getByText('計画の対象外')).toBeInTheDocument()
      expect(within(cellOf('素材94100')).getByText('計画の対象外')).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(unwantedSummary()).not.toBeInTheDocument()
    })

    it('品目名を押すと「欲しい」が選ばれたポップアップが出て、「いらない」を選ぶと行が表から消え「▸ いらない品目 1 件」が出る', () => {
      renderShop()
      fireEvent.click(screen.getByRole('button', { name: '素材4001' }))
      const group = screen.getByRole('radiogroup', { name: '素材4001 は欲しいか' })
      expect(within(group).getByRole('radio', { name: '欲しい' })).toBeChecked()
      expect(within(group).getByRole('radio', { name: 'いらない' })).not.toBeChecked()

      fireEvent.click(within(group).getByRole('radio', { name: 'いらない' }))
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('素材4001 の交換回数')).not.toBeInTheDocument()
      expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 1 件')
      expect(unwantedSummary()).toHaveAttribute('aria-expanded', 'false')
      expect(storedWant()).toEqual({ 4001: false })
    })

    it('畳んだ部分を開くと名前だけが出て、名前を押して「欲しい」を選ぶと行が元の位置に戻り、前に入れた回数が戻る', () => {
      renderShop()
      fireEvent.change(screen.getByLabelText('素材4001 の交換回数'), { target: { value: '3' } })
      chooseWant('素材4001', 'いらない')

      fireEvent.click(unwantedSummary() as HTMLElement)
      expect(unwantedSummary()).toHaveAttribute('aria-expanded', 'true')
      const section = screen.getByTestId('shop-unwanted-items')
      expect(within(section).getByRole('button', { name: '素材4001' })).toBeInTheDocument()
      expect(within(section).queryByRole('spinbutton')).not.toBeInTheDocument()
      expect(within(section).queryByText('計画の対象外')).not.toBeInTheDocument()
      expect(within(section).queryByText('武蔵うどん')).not.toBeInTheDocument()

      fireEvent.click(within(section).getByRole('button', { name: '素材4001' }))
      expect(
        within(screen.getByRole('radiogroup', { name: '素材4001 は欲しいか' })).getByRole('radio', { name: 'いらない' }),
      ).toBeChecked()
      fireEvent.click(screen.getByRole('radio', { name: '欲しい' }))

      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(3)
      // 不足のある 6516・6519 が上のグループ、残りが下のグループで、各グループの中は交換所の順。
      expect(inputNames()).toEqual(['素材6516', '素材6519', '素材6517', '素材6518', '素材4001', '素材94100'])
      expect(unwantedSummary()).not.toBeInTheDocument()
      expect(storedWant()).toEqual({ 4001: true })
    })

    it('「いらない」の品目の回数は、選んだ交換の合計・必要量・周回の合計に入らない。全交換の合計は変えない', () => {
      renderShop()
      fireEvent.change(screen.getByLabelText('素材4001 の交換回数'), { target: { value: '3' } })
      fireEvent.change(screen.getByLabelText('素材6516 の交換回数'), { target: { value: '2' } })
      const udon = cardOf('武蔵うどん')
      expect(within(udon).getByText('選んだ交換 50')).toBeInTheDocument()
      expect(within(udon).getByText('必要量 50')).toBeInTheDocument()
      expect(screen.getByText('合計 5 周・AP 200')).toBeInTheDocument()

      chooseWant('素材4001', 'いらない')
      expect(within(udon).getByText('選んだ交換 20')).toBeInTheDocument()
      expect(within(udon).getByText('必要量 20')).toBeInTheDocument()
      expect(screen.getByText('合計 2 周・AP 80')).toBeInTheDocument()
      expect(screen.getByTestId('shop-plan-summary')).toHaveTextContent('周回の合計 2 周・AP 80')
      expect(within(udon).getByText('全交換 450')).toBeInTheDocument()
    })

    it('全部交換と「足りない分だけ」は「いらない」の品目の保存した回数を変えない', () => {
      const savedCount = () => {
        const saved = JSON.parse(localStorage.getItem('events/shopInputs/80632') ?? '{}') as { counts?: Record<string, number> }
        return Object.entries(saved.counts ?? {}).find(([key]) => key.startsWith('item:4001:'))?.[1]
      }
      renderShop()
      fireEvent.change(screen.getByLabelText('素材4001 の交換回数'), { target: { value: '3' } })
      chooseWant('素材4001', 'いらない')

      fireEvent.click(bulkAction('全部交換'))
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(10)
      expect(savedCount()).toBe(3)
      fireEvent.click(shortfallButton())
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(5)
      expect(savedCount()).toBe(3)
    })

    it('「足りない分だけ」の後に開き直しても、操作の後の回数とその後に変えた回数のまま', () => {
      const { unmount } = renderShop()
      fireEvent.click(shortfallButton())
      fireEvent.change(screen.getByLabelText('素材94100 の交換回数'), { target: { value: '3' } })
      unmount()

      renderShop()
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材6517 の交換回数')).toHaveValue(0)
      expect(screen.getByLabelText('素材6519 の交換回数')).toHaveValue(10)
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材94100 の交換回数')).toHaveValue(3)
    })

    it('「いらない」は開き直しても、別のイベントでも使い、そのイベントで入れていた回数は計算に入らない', () => {
      const { unmount } = renderShop()
      chooseWant('素材4001', 'いらない')
      unmount()

      setLs('events/shopInputs/80700', { counts: { 'item:4001:1:94002:30:0': 2 } })
      renderShop({ id: 80700, shop: [shopEntry(4001, 94002, { costName: '江戸むすび', qty: 1, limitNum: 3 })] })
      expect(screen.queryByLabelText('素材4001 の交換回数')).not.toBeInTheDocument()
      expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 1 件')
      expect(within(cardOf('江戸むすび')).getByText('選んだ交換 0')).toBeInTheDocument()

      chooseWantFromCollapsed('素材4001', '欲しい')
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(2)
      expect(within(cardOf('江戸むすび')).getByText('選んだ交換 60')).toBeInTheDocument()
    })

    it('「いらない」は false、「欲しい」に戻すと true として品目 ID ごとに保存し、キーを消さない', () => {
      renderShop()
      chooseWant('素材4001', 'いらない')
      chooseWant('素材94100', 'いらない')
      expect(storedWant()).toEqual({ 4001: false, 94100: false })

      chooseWantFromCollapsed('素材4001', '欲しい')
      expect(storedWant()).toEqual({ 4001: true, 94100: false })
    })

    it('保存済みの値で false の品目だけを「いらない」にし、true と保存の無い品目は「欲しい」にする', () => {
      setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 94100: false, 4001: true })
      renderShop()
      expect(screen.queryByLabelText('素材94100 の交換回数')).not.toBeInTheDocument()
      expect(screen.getByLabelText('素材4001 の交換回数')).toBeInTheDocument()
      expect(screen.getByLabelText('素材6516 の交換回数')).toBeInTheDocument()
      expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 1 件')
    })

    it('前の版の保存値（伝承結晶 false・呼符 true）で開くと、伝承結晶が畳まれ、呼符が表に出る', () => {
      setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 6999: false, 4001: true })
      renderShop({ shop: [...shop, shopEntry(6999, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 2 })] })
      expect(screen.queryByLabelText('素材6999 の交換回数')).not.toBeInTheDocument()
      expect(screen.getByLabelText('素材4001 の交換回数')).toBeInTheDocument()
      fireEvent.click(unwantedSummary() as HTMLElement)
      expect(within(screen.getByTestId('shop-unwanted-items')).getByRole('button', { name: '素材6999' })).toBeInTheDocument()
    })

    it.each([null, [94100], 'broken'])('保存した欲しい・いらないが壊れていても（%j）落ちず、全品目を「欲しい」として出す', stored => {
      setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, stored)
      renderShop()
      expect(screen.getByLabelText('素材94100 の交換回数')).toBeInTheDocument()
      expect(screen.getByLabelText('素材4001 の交換回数')).toBeInTheDocument()
      expect(unwantedSummary()).not.toBeInTheDocument()
    })

    it.each([null, [25, 40], 'broken'])('保存した実所持数が壊れていても（%j）落ちず、所持 0 として出す', stored => {
      setLs(STORAGE_KEYS.POSSESSION, stored)
      renderShop()
      expect(within(cellOf('素材6516')).getByText('育成にあと 30 個')).toBeInTheDocument()
    })

    it('選んだことの無い端末では、開いただけで要る・要らないの保存を作らない', () => {
      renderShop()
      expect(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS)).toBeNull()
    })

    describe('切り替えたあとのフォーカスの移し先', () => {
      const table = () => screen.getByTestId('shop-item-list').querySelector('table') as HTMLElement
      /** 表の品目名のボタン。 */
      const tableName = (name: string) => within(table()).getByRole('button', { name })
      /** 開いた「いらない品目」の中の名前のボタン。 */
      const collapsedName = (name: string) => {
        const summaryButton = unwantedSummary()
        if (summaryButton?.getAttribute('aria-expanded') === 'false') fireEvent.click(summaryButton)
        return within(screen.getByTestId('shop-unwanted-items')).getByRole('button', { name })
      }
      // ポップアップの閉じたあとの後始末（フォーカスを戻す処理）は microtask やタイマーで走るので待つ。
      const settle = () =>
        act(async () => {
          await new Promise(resolve => setTimeout(resolve, 0))
        })
      /** 品目名にフォーカスしてポップアップを開き、選ぶ。detail 0 はキーボード、1 はタップやクリックの click。 */
      const choose = async (trigger: HTMLElement, choice: '欲しい' | 'いらない', detail = 0) => {
        trigger.focus()
        fireEvent.click(trigger, { detail })
        await settle()
        const group = screen.getByRole('radiogroup')
        fireEvent.click(within(group).getByRole('radio', { name: choice }), { detail })
        await settle()
      }
      const expectFocused = (element: HTMLElement | null) => {
        expect(document.activeElement).not.toBe(document.body)
        expect(document.activeElement).toBe(element)
      }

      it('「いらない」にすると、表で次にあった行の品目名へ移る', async () => {
        renderShop()
        await choose(tableName('素材6517'), 'いらない')
        expect(screen.queryByLabelText('素材6517 の交換回数')).not.toBeInTheDocument()
        expectFocused(tableName('素材6518'))
      })

      it('表の最後の行を「いらない」にすると、すぐ前の行の品目名へ移る', async () => {
        renderShop()
        await choose(tableName('素材94100'), 'いらない')
        expectFocused(tableName('素材4001'))
      })

      it('「効率順」の最後の行を「いらない」にすると、「AP 換算なし」の最初の行の品目名へ移る', async () => {
        render(
          <EventHubClient
            summary={summary}
            boxEvent={event({ shop, farmingNodes })}
            features={['shop']}
            shopApPrices={{ 6516: 20, 6517: 10 }}
          />,
        )
        // 各グループの中が「効率順」と「AP 換算なし」に分かれ、順位はグループに分ける前の番号のまま。
        expect(bodyRows(screen.getByTestId('shop-item-list'))).toEqual([
          '育成に足りない品目',
          '効率順',
          '1|素材6516|2',
          'AP 換算なし',
          '|素材6519|',
          'そのほかの品目',
          '効率順',
          '2|素材6517|1',
          'AP 換算なし',
          '|素材6518|',
          '|素材4001|',
          '|素材94100|',
        ])
        await choose(tableName('素材6517'), 'いらない')
        expectFocused(tableName('素材6518'))
      })

      it('「育成に足りない品目」の最後の行を「いらない」にすると、「そのほかの品目」の最初の行の品目名へ移る', async () => {
        renderShop()
        expect(bodyRows(screen.getByTestId('shop-item-list'))).toEqual([
          '育成に足りない品目',
          '|素材6516|',
          '|素材6519|',
          'そのほかの品目',
          '|素材6517|',
          '|素材6518|',
          '|素材4001|',
          '|素材94100|',
        ])
        await choose(tableName('素材6519'), 'いらない')
        expectFocused(tableName('素材6517'))
      })

      it('最後の「欲しい」の行を「いらない」にすると、「いらない品目」の見出しへ移る', async () => {
        setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 6516: false, 6517: false, 6518: false, 6519: false, 4001: false })
        renderShop()
        await choose(tableName('素材94100'), 'いらない')
        expect(screen.queryAllByLabelText(/ の交換回数$/)).toHaveLength(0)
        expectFocused(unwantedSummary())
      })

      it('「いらない品目」から「欲しい」に戻すと、表に戻った行の品目名へ移る', async () => {
        setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 6517: false, 4001: false })
        renderShop()
        await choose(collapsedName('素材6517'), '欲しい')
        expect(unwantedSummary()).toHaveTextContent('いらない品目 1 件')
        expectFocused(tableName('素材6517'))
      })

      it('最後の1件を「欲しい」に戻して「いらない品目」が消えても、表に戻った行の品目名へ移る', async () => {
        setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 6517: false })
        renderShop()
        await choose(collapsedName('素材6517'), '欲しい')
        expect(unwantedSummary()).not.toBeInTheDocument()
        expectFocused(tableName('素材6517'))
      })

      it('タップで戻すと同じ品目名へ画面をスクロールせずに移り、キーボードではスクロールを止めない', async () => {
        const focus = vi.spyOn(HTMLElement.prototype, 'focus')
        // 選ぶ前に品目名へ合わせた分は数えず、選んだあとにその要素へ移した呼び出しの options。
        const focusOptionsOn = (element: HTMLElement) =>
          focus.mock.calls.filter((_, i) => focus.mock.contexts.at(i) === element).map(([options]) => options ?? {})
        try {
          setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 6517: false, 4001: false })
          renderShop()
          await choose(collapsedName('素材6517'), '欲しい', 1)
          const tapped = tableName('素材6517')
          expectFocused(tapped)
          expect(focusOptionsOn(tapped)).toEqual([{ preventScroll: true }])

          focus.mockClear()
          await choose(collapsedName('素材4001'), '欲しい', 0)
          const typed = tableName('素材4001')
          expectFocused(typed)
          const typedOptions = focusOptionsOn(typed)
          expect(typedOptions).toHaveLength(1)
          expect(typedOptions[0]?.preventScroll).toBeUndefined()
        } finally {
          focus.mockRestore()
        }
      })

      it('今と同じ設定を選ぶと、行は動かず押した品目名へ戻る', async () => {
        renderShop()
        await choose(tableName('素材4001'), '欲しい')
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
        expect(unwantedSummary()).not.toBeInTheDocument()
        expectFocused(tableName('素材4001'))
      })

      it('Esc で閉じると、押した品目名へ戻る', async () => {
        renderShop()
        const trigger = tableName('素材4001')
        trigger.focus()
        fireEvent.click(trigger, { detail: 0 })
        await settle()
        fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
        await settle()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
        expectFocused(tableName('素材4001'))
      })

      it('ポップアップを開いたまま別の行の回数の入力欄を押して閉じると、その入力欄に留まる', async () => {
        renderShop()
        const trigger = tableName('素材4001')
        trigger.focus()
        fireEvent.click(trigger, { detail: 0 })
        await settle()
        expect(screen.getByRole('radiogroup')).toBeInTheDocument()
        const input = screen.getByLabelText('素材6516 の交換回数')
        fireEvent.pointerDown(input)
        fireEvent.mouseDown(input)
        input.focus()
        fireEvent.pointerUp(input)
        fireEvent.mouseUp(input)
        fireEvent.click(input)
        await settle()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
        expectFocused(input)
      })
    })

    it('「足りない分だけ」で不足の分と「欲しい」の計画の対象外の在庫上限を入れ、周回の内訳を出し、その後も回数を変えられる', () => {
      renderShop()
      expect(within(cellOf('素材94100')).queryByText('上限なし: 回数を入れてください')).not.toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('素材94100 の交換回数'), { target: { value: '3' } })

      fireEvent.click(shortfallButton())

      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材6517 の交換回数')).toHaveValue(0)
      expect(screen.getByLabelText('素材6518 の交換回数')).toHaveValue(0)
      expect(screen.getByLabelText('素材6519 の交換回数')).toHaveValue(10)
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材94100 の交換回数')).toHaveValue(0)
      expect(within(cellOf('素材94100')).getByText('上限なし: 回数を入れてください')).toBeInTheDocument()
      expect(screen.getByText('必要量 200')).toBeInTheDocument()
      expect(screen.getByText('合計 20 周・AP 800')).toBeInTheDocument()

      chooseWant('素材4001', 'いらない')
      expect(screen.getByText('必要量 150')).toBeInTheDocument()
      expect(screen.getByText('合計 15 周・AP 600')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('素材94100 の交換回数'), { target: { value: '3' } })
      fireEvent.change(screen.getByLabelText('素材6516 の交換回数'), { target: { value: '1' } })
      expect(screen.getByLabelText('素材94100 の交換回数')).toHaveValue(3)
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(1)
      expect(within(cellOf('素材94100')).queryByText('上限なし: 回数を入れてください')).not.toBeInTheDocument()

      fireEvent.click(shortfallButton())
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(5)
      expect(screen.getByLabelText('素材94100 の交換回数')).toHaveValue(0)
      expect(screen.getByText('合計 15 周・AP 600')).toBeInTheDocument()

      // 「いらない」の間に「足りない分だけ」を押しても、呼符の回数は変わっていない。
      chooseWantFromCollapsed('素材4001', '欲しい')
      expect(screen.getByLabelText('素材4001 の交換回数')).toHaveValue(5)
      expect(screen.getByText('合計 20 周・AP 800')).toBeInTheDocument()
    })

    it('在庫上限で埋まらない素材の行には「育成にあと N 個」だけを出して「交換所では N 個足りない」を出さず、要約で埋まらない素材に数える', () => {
      renderShop()

      expect(within(cellOf('素材6519')).getByText('育成にあと 15 個')).toBeInTheDocument()
      expect(screen.queryByText(/交換所では/)).not.toBeInTheDocument()
      expect(screen.getByText('育成計画の不足 2 素材のうち、交換所で埋まるのは 1 素材')).toBeInTheDocument()

      fireEvent.click(shortfallButton())
      expect(screen.getByLabelText('素材6519 の交換回数')).toHaveValue(10)
      expect(within(cellOf('素材6519')).getByText('育成にあと 15 個')).toBeInTheDocument()
      expect(screen.queryByText(/交換所では/)).not.toBeInTheDocument()
    })

    it('「足りている（交換不要）」「使わない」の行は回数 0 のときだけ薄い文字色で、回数を入れると「育成にあと N 個」の行と同じ色になる', () => {
      renderShop()
      const colorOf = (name: string) => rowOfItem(name).style.color
      const shortColor = colorOf('素材6516')
      expect(shortColor).toBe('var(--text2)')
      expect(colorOf('素材6517')).toBe('var(--text3)')
      expect(colorOf('素材6518')).toBe('var(--text3)')

      fireEvent.change(screen.getByLabelText('素材6518 の交換回数'), { target: { value: '1' } })
      expect(colorOf('素材6518')).toBe(shortColor)
      expect(colorOf('素材6517')).toBe('var(--text3)')

      fireEvent.change(screen.getByLabelText('素材6518 の交換回数'), { target: { value: '0' } })
      expect(colorOf('素材6518')).toBe('var(--text3)')
    })

    describe('不足のある行を上にまとめる並び', () => {
      const list = () => screen.getByTestId('shop-item-list')
      const renderWithPrices = (shopApPrices: Record<number, number>, items: EventShopItem[] = shop) =>
        render(
          <EventHubClient
            summary={summary}
            boxEvent={event({ shop: items, farmingNodes })}
            features={['shop']}
            shopApPrices={shopApPrices}
          />,
        )

      it('「育成にあと N 個」の行を「育成に足りない品目」に、残りを「そのほかの品目」にまとめ、順位は分ける前の番号のまま。回数を入れてもグループは変わらない', () => {
        // 素材6517 は足りている、素材6516 は不足 189、素材6518 は使わない、素材6519 は不足 2。
        mocks.roster = ready({ 6516: 214, 6517: 30, 6519: 2 })
        const items = shop.slice(0, 4)
        renderWithPrices({ 6517: 90, 6516: 77.2, 6518: 76.3, 6519: 50 }, items)
        const expected = [
          '育成に足りない品目',
          '2|素材6516|7.72',
          '4|素材6519|5',
          'そのほかの品目',
          '1|素材6517|9',
          '3|素材6518|7.63',
        ]
        expect(bodyRows(list())).toEqual(expected)
        expect(screen.queryByText('効率順')).not.toBeInTheDocument()
        expect(screen.queryByText('AP 換算なし')).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('素材6517 の交換回数'), { target: { value: '3' } })
        expect(bodyRows(list())).toEqual(expected)
      })

      it('「効率順」「AP 換算なし」はグループごとに、そのグループに効率のある行と無い行の両方があるときだけ出す', () => {
        mocks.roster = ready({ 6516: 30, 6999: 3 })
        const items = [
          shop[0],
          shop[1],
          shopEntry(6999, 94001, { costName: '武蔵うどん', qty: 1, costAmount: 10, limitNum: 2 }),
        ]
        renderWithPrices({ 6516: 20, 6517: 10 }, items)
        expect(bodyRows(list())).toEqual([
          '育成に足りない品目',
          '効率順',
          '1|素材6516|2',
          'AP 換算なし',
          '|素材6999|',
          'そのほかの品目',
          '2|素材6517|1',
        ])
      })

      it('グループの見出しは「効率順」「AP 換算なし」の見出しと見た目が違う', () => {
        renderWithPrices({ 6516: 20, 6517: 10 })
        const heading = (text: string) => within(list()).getAllByText(text)[0]
        expect(heading('育成に足りない品目').className).not.toBe(heading('効率順').className)
        expect(heading('育成に足りない品目').style.color).not.toBe(heading('効率順').style.color)
      })

      it('「育成にあと N 個」の行が無いときは、グループの見出しを出さず、育成計画が未設定のときと同じ並びにする', () => {
        mocks.roster = ready({ 6517: 30 })
        renderWithPrices({ 6516: 20, 6517: 10 })
        expect(bodyRows(list())).toEqual([
          '効率順',
          '1|素材6516|2',
          '2|素材6517|1',
          'AP 換算なし',
          '|素材6518|',
          '|素材6519|',
          '|素材4001|',
          '|素材94100|',
        ])
      })

      it('育成計画が使えないときは、グループに分けず、効率の高い順の後に効率の無い行を交換所の順で並べる', () => {
        mocks.roster = { status: 'empty' }
        renderWithPrices({ 6519: 20, 6517: 10 })
        expect(bodyRows(list())).toEqual([
          '効率順',
          '1|素材6519|2',
          '2|素材6517|1',
          'AP 換算なし',
          '|素材6516|',
          '|素材6518|',
          '|素材4001|',
          '|素材94100|',
        ])
        expect(screen.queryByText('育成に足りない品目')).not.toBeInTheDocument()
        expect(screen.queryByText('そのほかの品目')).not.toBeInTheDocument()
      })
    })

    it('不足のある素材の品目を「いらない」にすると、その素材は埋まらない素材として数え、足りない数はどの行にも出さない', () => {
      renderShop()
      chooseWant('素材6516', 'いらない')
      expect(screen.getByText('育成計画の不足 2 素材のうち、交換所で埋まるのは 0 素材')).toBeInTheDocument()
      fireEvent.click(unwantedSummary() as HTMLElement)
      expect(within(screen.getByTestId('shop-unwanted-items')).queryByText(/あと|交換所では/)).not.toBeInTheDocument()
    })

    it('育成計画が使えるとき、メニューの「足りない分だけ」は押せて、入れる内容を説明する', () => {
      renderShop()
      openShopMenu()
      const item = screen.getByRole('menuitem', { name: '足りない分だけ育成に足りない分を入れる' })
      expect(item).not.toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByRole('link', { name: '育成対象を設定' })).toBeNull()
    })

    it('育成計画が未設定なら、ラベル・要約を出さず、「足りない分だけ」を押せず、設定のリンクを出し、品目名のポップアップは使える', () => {
      mocks.roster = { status: 'empty' }
      renderShop()

      expect(screen.queryByText('育成にあと 5 個')).not.toBeInTheDocument()
      expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByTestId('shop-shortfall-summary')).not.toBeInTheDocument()
      expect(shortfallButton()).toBeDisabled()
      expect(screen.getByRole('link', { name: '育成対象を設定' })).toHaveAttribute('href', '/material')
      expect(screen.queryByText(/育成対象を設定すると、足りている/)).toBeNull()

      fireEvent.click(bulkAction('全部交換'))
      expect(screen.getByLabelText('素材6516 の交換回数')).toHaveValue(10)
      // 回数が入ると行とリンクは消え、メニューの項目は押せず、理由を出す。
      expect(screen.queryByRole('link', { name: '育成対象を設定' })).toBeNull()
      openShopMenu()
      const item = screen.getByRole('menuitem', { name: '足りない分だけ育成対象を設定すると使えます' })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      fireEvent.keyDown(item, { key: 'Escape' })
      expect(mocks.useMaterialCatalog).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: '素材4001' }))
      expect(screen.getByRole('radiogroup', { name: '素材4001 は欲しいか' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('radio', { name: 'いらない' }))
      expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 1 件')
    })

    it('育成計画の読み込みに失敗したとき・読み込み中は、「足りない分だけ」を押せず、品目名のポップアップは使える', () => {
      mocks.roster = { status: 'error' }
      const { unmount } = renderShop()
      expect(
        screen.getByText('育成素材データの一部を取得できませんでした。時間をおいて再読み込みしてください。'),
      ).toBeInTheDocument()
      expect(screen.queryByText('育成にあと 5 個')).not.toBeInTheDocument()
      expect(shortfallButton()).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: '素材4001' }))
      expect(screen.getByRole('radiogroup', { name: '素材4001 は欲しいか' })).toBeInTheDocument()
      unmount()

      mocks.roster = { status: 'loading' }
      renderShop()
      expect(screen.getByText('育成計画を読み込み中...')).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(shortfallButton()).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: '素材4001' }))
      expect(screen.getByRole('radiogroup', { name: '素材4001 は欲しいか' })).toBeInTheDocument()
    })

    it('素材の一覧を読み込めないと、必要数のある品目のラベルだけを出し、見分けられないことと再読み込みを出す', () => {
      mocks.catalog = { catalog: null, failed: true, reload }
      renderShop()

      expect(within(cellOf('素材6516')).getByText('育成にあと 5 個')).toBeInTheDocument()
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

      expect(within(cellOf('素材6516')).getByText('育成にあと 5 個')).toBeInTheDocument()
      expect(screen.queryByText('使わない')).not.toBeInTheDocument()
      expect(screen.queryByText('計画の対象外')).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByText(/見分けられません/)).not.toBeInTheDocument()
    })

    describe('伝承結晶と夢火', () => {
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

      it('使わない伝承結晶は「使わない」で出て「足りない分だけ」で 0、夢火は「計画の対象外」で在庫上限まで入る', () => {
        renderShop({ shop: defaultShop })

        const [loreCell] = screen.getAllByLabelText('素材6999 の交換回数').map(input => input.closest('tr')?.cells[1])
        expect(within(loreCell as HTMLElement).getByText('使わない')).toBeInTheDocument()
        expect(within(cellOf('素材1000')).getByText('計画の対象外')).toBeInTheDocument()

        fireEvent.click(shortfallButton())
        const [limited, unlimited] = screen.getAllByLabelText('素材6999 の交換回数')
        expect(limited).toHaveValue(0)
        expect(unlimited).toHaveValue(0)
        expect(within(lastLoreCell()).queryByText('上限なし: 回数を入れてください')).not.toBeInTheDocument()
        expect(screen.getByLabelText('素材1000 の交換回数')).toHaveValue(1)
        expect(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS)).toBeNull()
      })

      it('不足 1 の伝承結晶（在庫上限 2）には「育成にあと 1 個」が出て、「足りない分だけ」で 1 が入る', () => {
        mocks.roster = ready({ 6999: 3 })
        setLs(STORAGE_KEYS.POSSESSION, { 6999: 2 })
        renderShop({ shop: [defaultShop[0]] })

        expect(within(cellOf('素材6999')).getByText('育成にあと 1 個')).toBeInTheDocument()
        fireEvent.click(shortfallButton())
        expect(screen.getByLabelText('素材6999 の交換回数')).toHaveValue(1)
      })

      it('伝承結晶を「いらない」にすると畳まれ、端末に false で残り、別のイベントでも「いらない」', () => {
        const { unmount } = renderShop({ shop: defaultShop })
        chooseWant('素材6999', 'いらない')
        expect(storedWant()).toEqual({ 6999: false })
        expect(screen.queryByLabelText('素材6999 の交換回数')).not.toBeInTheDocument()
        expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 2 件')
        unmount()

        renderShop({ id: 80700, shop: [shopEntry(6999, 94002, { costName: '江戸むすび', qty: 1, limitNum: 3 })] })
        expect(screen.queryByLabelText('素材6999 の交換回数')).not.toBeInTheDocument()
        expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 1 件')
      })

      it('素材の一覧を読み込めなくても、伝承結晶は「使わない」、夢火は「計画の対象外」と出る', () => {
        mocks.catalog = { catalog: null, failed: true, reload }
        renderShop({ shop: [defaultShop[0], defaultShop[1]] })

        expect(within(cellOf('素材6999')).getByText('使わない')).toBeInTheDocument()
        expect(within(cellOf('素材1000')).getByText('計画の対象外')).toBeInTheDocument()
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

      it('名前とアイコンとともに並び、「計画の対象外」が出て、切り替えは常には出ない', () => {
        renderSvtShop()
        for (const [id, name] of [
          [9770500, '叡智の大火'],
          [9700300, '星のフォウくん'],
          [6516, '番号が素材と同じ礼装'],
        ] as const) {
          expect(cellOf(name).querySelector('img')?.getAttribute('src')).toContain(encodeURIComponent(icon(id)))
          expect(within(cellOf(name)).getByText('計画の対象外')).toBeInTheDocument()
        }
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
        // 2つの通貨で交換できる礼装は1行にまとまる。
        expect(screen.getAllByLabelText('完璧なお正月 の交換回数')).toHaveLength(1)
        expect(within(cellOf('完璧なお正月')).getByText('計画の対象外')).toBeInTheDocument()
      })

      it('「足りない分だけ」で「欲しい」の種火（在庫上限 100）とまとめた礼装は在庫上限になる', () => {
        renderSvtShop()
        fireEvent.click(shortfallButton())
        expect(screen.getByLabelText('叡智の大火 の交換回数')).toHaveValue(100)
        // まとめた行は2つの通貨の在庫上限の合計で、内訳に両方の通貨が出る。
        expect(screen.getByLabelText('完璧なお正月 の交換回数')).toHaveValue(3)
        expect(within(cellOf('完璧なお正月')).getByText('武蔵うどん 2・江戸むすび 1')).toBeInTheDocument()
      })

      it('礼装を「いらない」にすると svt:<番号> のキーで保存してまとめた行ごと畳み、同じ番号のアイテムは「欲しい」のまま', () => {
        renderSvtShop()
        fireEvent.change(screen.getByLabelText('完璧なお正月 の交換回数'), { target: { value: '2' } })
        expect(within(cardOf('武蔵うどん')).getByText('選んだ交換 20')).toBeInTheDocument()
        chooseWant('完璧なお正月', 'いらない')

        expect(storedWant()).toEqual({ 'svt:9305420': false })
        expect(screen.queryByLabelText('完璧なお正月 の交換回数')).not.toBeInTheDocument()
        expect(screen.getByLabelText('同じ番号のアイテム の交換回数')).toBeInTheDocument()
        expect(unwantedSummary()).toHaveTextContent('▸ いらない品目 1 件')
        expect(within(cardOf('武蔵うどん')).getByText('選んだ交換 0')).toBeInTheDocument()

        fireEvent.click(shortfallButton())
        expect(screen.getByLabelText('同じ番号のアイテム の交換回数')).toHaveValue(3)
        expect(screen.getByLabelText('叡智の大火 の交換回数')).toHaveValue(100)
      })

      it('全部交換を押すと在庫上限の回数になる', () => {
        renderSvtShop()
        fireEvent.click(bulkAction('全部交換'))
        expect(screen.getByLabelText('叡智の大火 の交換回数')).toHaveValue(100)
        expect(screen.getByLabelText('星のフォウくん の交換回数')).toHaveValue(40)
        expect(screen.getByLabelText('完璧なお正月 の交換回数')).toHaveValue(3)
      })

      it('育成計画が未設定のとき・素材の一覧を読み込めないときはラベルを出さない', () => {
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

          // 通貨ごとのカードに分けず、交換所の順の1つの一覧に並べる。
          expect(screen.queryByRole('heading', { name: '武蔵うどん' })).not.toBeInTheDocument()
          const list = screen.getByTestId('shop-item-list')
          expect(Array.from(list.querySelectorAll<HTMLTableRowElement>('tbody tr')).map(tr => tr.cells[0]?.textContent)).toEqual([
            '叡智の大火',
            '星のフォウくん',
            '完璧なお正月',
          ])
          expect(within(rowOf('完璧なお正月')).getByText('江戸むすび')).toBeInTheDocument()
          expect(within(list).getAllByRole('columnheader').map(th => th.textContent)).toEqual([
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
          expect(fire.getByText('武蔵うどん')).toBeInTheDocument()
          const fou = within(rowOf('星のフォウくん'))
          expect(fou.getByText('×3')).toBeInTheDocument()
          expect(fou.getByText('上限なし')).toBeInTheDocument()

          expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
          expect(screen.queryByRole('button', { name: '全部交換' })).not.toBeInTheDocument()
          expect(screen.queryByRole('button', { name: '足りない分だけ' })).not.toBeInTheDocument()
          expect(screen.queryByRole('button', { name: '叡智の大火' })).not.toBeInTheDocument()
          expect(unwantedSummary()).not.toBeInTheDocument()
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

        it('周回クエストが無いとき、品目の一覧だけを出し、「いらない」にした品目も畳まない', () => {
          setLs(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, { 'svt:9770500': false })
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
          fireEvent.click(bulkAction('全部交換'))
          expect(screen.getByLabelText('叡智の大火 の交換回数')).toHaveValue(100)
        })
      })
    })

    it('所持数は POSSESSION から読み、ITEMS の値は使わず、POSSESSION を書き換えない', () => {
      setLs(STORAGE_KEYS.ITEMS, { 6516: 0, 6517: 0, 6519: 15 })
      const before = localStorage.getItem(STORAGE_KEYS.POSSESSION)
      renderShop()

      expect(within(cellOf('素材6516')).getByText('育成にあと 5 個')).toBeInTheDocument()
      expect(within(cellOf('素材6517')).getByText('足りている（交換不要）')).toBeInTheDocument()
      expect(within(cellOf('素材6519')).getByText('育成にあと 15 個')).toBeInTheDocument()
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

    it('ボーナスのカードの直下に1周の獲得量の表があり、通貨ごとのカードより下にある', () => {
      renderShop(bonusEvent(), POINT)
      const perRun = screen.getByTestId('shop-per-run')
      expect(bonusCard().nextElementSibling).toBe(perRun)
      expect(bonusCard().compareDocumentPosition(cardOf('武蔵うどん')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
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

    it('交換所のボーナスは開き直しても残り、1周の獲得量と周回数はボーナス込みのまま', () => {
      const { unmount } = renderShop(bonusEvent(), POINT)
      needUdon('10')
      fireEvent.change(bonusInput('武蔵うどん'), { target: { value: '2' } })
      unmount()

      renderShop(bonusEvent(), POINT)
      expect(bonusInput('武蔵うどん')).toHaveValue(2)
      expect(perRunCells()).toEqual([['上級AP40', '20.0+10.0', '-', '-', '600.0']])
      expect(screen.getByText('15 周')).toBeInTheDocument()
    })

    it('☆ と通貨の対応を持たないデータでは、データの更新前の1行とすべての通貨の欄を出す', () => {
      renderShop(bonusEvent(), POINT)
      expect(within(bonusCard()).getByText('データの更新前のため、礼装の枚数を比べられません。')).toBeInTheDocument()
      expect(screen.queryByLabelText('フレンドの礼装')).not.toBeInTheDocument()
    })
  })

  describe('交換所の入力の保存', () => {
    const UDON = 94001
    const MUSUBI = 94002
    const savedKey = (id: number) => `events/shopInputs/${id}`
    const shopEvent = (overrides: Partial<EventPlannerEvent> = {}) =>
      event({
        shop: [
          shopEntry(1, UDON, { costName: '武蔵うどん', costAmount: 10, limitNum: 5 }),
          shopEntry(2, MUSUBI, { costName: '江戸むすび', costAmount: 10, limitNum: 10 }),
          shopEntry(3, UDON, { costName: '武蔵うどん', costAmount: 1, limitNum: 0 }),
        ],
        farmingNodes: [
          {
            questId: 1,
            name: '上級',
            ap: 40,
            drops: [
              { itemId: UDON, perRun: 10, countPerRun: 5 },
              { itemId: MUSUBI, perRun: 10, countPerRun: 5 },
            ],
          },
        ],
        ...overrides,
      })
    const renderShop = (shop = shopEvent()) =>
      render(<EventHubClient summary={summary} boxEvent={shop} features={['shop']} />)
    const countInput = (name: string) => screen.getByLabelText(`${name} の交換回数`)
    const ownedInput = (name: string) => screen.getByLabelText(`${name} の所持数`)
    const bonusInput = (name: string) => screen.getByLabelText(`${name} のドロップボーナス`)
    const enter = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

    it('交換回数・所持数・ボーナスは開き直しても残り、必要量と周回の内訳はその値で出る', () => {
      const { unmount } = renderShop()
      enter(countInput('素材1'), '3')
      enter(ownedInput('武蔵うどん'), '20')
      enter(bonusInput('武蔵うどん'), '2')
      expect(within(cardOf('武蔵うどん')).getByText('必要量 10')).toBeInTheDocument()
      const before = screen.getByText(/^合計 \d+ 周・AP/).textContent
      unmount()

      renderShop()
      expect(countInput('素材1')).toHaveValue(3)
      expect(ownedInput('武蔵うどん')).toHaveValue(20)
      expect(bonusInput('武蔵うどん')).toHaveValue(2)
      expect(within(cardOf('武蔵うどん')).getByText('必要量 10')).toBeInTheDocument()
      expect(screen.getByText(/^合計 \d+ 周・AP/).textContent).toBe(before)
    })

    it('別のイベントの交換所には混ざらない', () => {
      const { unmount } = renderShop()
      enter(countInput('素材1'), '3')
      enter(ownedInput('武蔵うどん'), '20')
      enter(bonusInput('武蔵うどん'), '2')
      unmount()

      renderShop(shopEvent({ id: 80700 }))
      expect(countInput('素材1')).toHaveValue(0)
      expect(ownedInput('武蔵うどん')).toHaveValue(0)
      expect(bonusInput('武蔵うどん')).toHaveValue(0)
    })

    it('同じ画面のまま別のイベントに描き直しても、前のイベントの値を新しいイベントに書かない', () => {
      const { rerender } = renderShop()
      enter(countInput('素材1'), '3')
      const saved = localStorage.getItem(savedKey(80632))
      expect(saved).not.toBeNull()

      rerender(<EventHubClient summary={summary} boxEvent={shopEvent({ id: 80700 })} features={['shop']} />)
      expect(countInput('素材1')).toHaveValue(0)
      expect(localStorage.getItem(savedKey(80700))).toBeNull()
      expect(localStorage.getItem(savedKey(80632))).toBe(saved)
    })

    it('開いただけでは書き込まない', () => {
      renderShop()
      expect(localStorage.getItem(savedKey(80632))).toBeNull()
    })

    it('全部交換の後に開き直しても、在庫上限のある品目は上限、上限の無い品目は操作の前の回数のまま', () => {
      const { unmount } = renderShop()
      enter(countInput('素材3'), '4')
      fireEvent.click(bulkAction('全部交換'))
      unmount()

      renderShop()
      expect(countInput('素材1')).toHaveValue(5)
      expect(countInput('素材2')).toHaveValue(10)
      expect(countInput('素材3')).toHaveValue(4)
    })

    it('取り込み直しで品目が前に加わっても、回数は同じ品目に使う', () => {
      const { unmount } = renderShop()
      enter(countInput('素材2'), '3')
      unmount()

      const base = shopEvent()
      renderShop({ ...base, shop: [shopEntry(9, MUSUBI, { costName: '江戸むすび' }), ...base.shop] })
      expect(countInput('素材2')).toHaveValue(3)
      expect(countInput('素材9')).toHaveValue(0)
    })

    it('保存値が JSON として読めない文字列でも落ちず、すべて 0 で出す', () => {
      localStorage.setItem(savedKey(80632), '{broken')
      renderShop()
      expect(countInput('素材1')).toHaveValue(0)
      expect(ownedInput('武蔵うどん')).toHaveValue(0)
      expect(bonusInput('武蔵うどん')).toHaveValue(0)
    })

    it('一部の値が壊れていても、読める値は使い、壊れた値は 0 として出す', () => {
      localStorage.setItem(
        savedKey(80632),
        JSON.stringify({
          counts: { 'item:1:2:94001:10:0': 'x', 'item:2:2:94002:10:0': 4 },
          owned: { [UDON]: -5, [MUSUBI]: 120 },
          bonus: 'broken',
        }),
      )
      renderShop()
      expect(countInput('素材1')).toHaveValue(0)
      expect(countInput('素材2')).toHaveValue(4)
      expect(ownedInput('武蔵うどん')).toHaveValue(0)
      expect(ownedInput('江戸むすび')).toHaveValue(120)
      expect(bonusInput('武蔵うどん')).toHaveValue(0)
    })
  })

  describe('交換所の残り', () => {
    const UDON = 94001
    const MUSUBI = 94002
    const KAKI = 94003
    const savedKey = 'events/shopInputs/80632'
    const fire = shopEntry(10, KAKI, { name: '叡智の業火', costName: '東干し柿', costAmount: 5, limitNum: 100, qty: 1 })
    const leaf = shopEntry(20, UDON, { name: '巡霊の葉', costName: '武蔵うどん', costAmount: 10, limitNum: 25, qty: 10 })
    const dangoOf = (costItemId: number, costName: string, limitNum: number) =>
      shopEntry(30, costItemId, { name: '月より団子', costName, costIcon: `/${costItemId}.png`, costAmount: 100, limitNum, qty: 1 })
    const dangoUdon = dangoOf(UDON, '武蔵うどん', 2)
    const dangoMusubi = dangoOf(MUSUBI, '江戸むすび', 1)
    const dangoKaki = dangoOf(KAKI, '東干し柿', 1)
    const dango = [dangoUdon, dangoMusubi, dangoKaki]
    const qp = shopEntry(1, UDON, { name: '10,000 QP', costName: '武蔵うどん', costAmount: 2, limitNum: 0, qty: 10000 })
    const itemA = shopEntry(40, UDON, { name: '品目A', costName: '武蔵うどん', costAmount: 10, limitNum: 30 })
    const itemB = shopEntry(41, MUSUBI, { name: '品目B', costName: '江戸むすび', costAmount: 10, limitNum: 10 })
    const shop = [fire, leaf, ...dango, qp, itemA, itemB]
    const keys = shopItemKeys(shop)
    const keyOf = (item: EventShopItem) => keys.at(shop.indexOf(item)) ?? ''
    const renderShop = () => render(<EventHubClient summary={summary} boxEvent={event({ shop })} features={['shop']} />)
    const saved = () =>
      JSON.parse(localStorage.getItem(savedKey) ?? '{}') as {
        counts?: Record<string, number>
        owned?: Record<string, number>
        remaining?: Record<string, number>
      }
    const countInput = (name: string) => screen.getByLabelText(`${name} の交換回数`)
    /** 行の上限の欄の文字（まとめた行は行の上限と通貨ごとの上限が続く）。 */
    const limitCell = (name: string) => (rowOfItem(name) as HTMLTableRowElement).cells.item(4)?.textContent
    const clearItem = (n: number) => {
      openShopMenu()
      return screen.getByRole('menuitem', { name: accessible => accessible.startsWith(`残りを消す（${n} 件）`) })
    }
    const queryClearItem = () => {
      openShopMenu()
      return screen.queryByRole('menuitem', { name: /^残りを消す/ })
    }
    const openPopover = (name: string) => {
      const [button] = within(screen.getByRole('table')).getAllByRole('button', { name })
      if (!button) throw new Error(`no item name button: ${name}`)
      fireEvent.click(button)
    }
    const enter = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

    it('開き直しても残る: 保存した残り 80 を上限に使い、全部交換で 80 回になり、上限の欄に残りと在庫上限を出す', () => {
      localStorage.setItem(savedKey, JSON.stringify({ remaining: { [keyOf(fire)]: 80 } }))
      const { unmount } = renderShop()
      expect(limitCell('叡智の業火')).toBe('残り 80 / 上限 100')
      fireEvent.click(bulkAction('全部交換'))
      expect(countInput('叡智の業火')).toHaveValue(80)
      expect(countInput('叡智の業火')).toHaveAttribute('max', '80')
      unmount()

      renderShop()
      expect(limitCell('叡智の業火')).toBe('残り 80 / 上限 100')
      expect(countInput('叡智の業火')).toHaveValue(80)
      // 残りの無い品目は今までどおり在庫上限だけを出す
      expect(limitCell('巡霊の葉')).toBe('25')
      expect(limitCell('10,000 QP')).toBe('上限なし')
    })

    it('まとめた行は通貨ごとの品目の上限の欄に残りを出し、行の上限は効く上限の合計', () => {
      localStorage.setItem(savedKey, JSON.stringify({ remaining: { [keyOf(dangoUdon)]: 1, [keyOf(dangoMusubi)]: 0 } }))
      renderShop()
      expect(limitCell('月より団子')).toBe('2残り 1 / 上限 2残り 0 / 上限 11')
      fireEvent.click(bulkAction('全部交換'))
      expect(countInput('月より団子')).toHaveValue(2)
      expect(saved().counts).toMatchObject({ [keyOf(dangoUdon)]: 1, [keyOf(dangoMusubi)]: 0, [keyOf(dangoKaki)]: 1 })
    })

    it('残りを消すと前の回数に戻る: 交換回数 20 に残り 5 なら 5 と出し、消すと 20 に戻り、所持数は変わらない', () => {
      localStorage.setItem(
        savedKey,
        JSON.stringify({ counts: { [keyOf(itemA)]: 20 }, owned: { [UDON]: 300 }, remaining: { [keyOf(itemA)]: 5 } }),
      )
      renderShop()
      expect(countInput('品目A')).toHaveValue(5)
      expect(within(cardOf('武蔵うどん')).getByText('選んだ交換 50')).toBeInTheDocument()

      fireEvent.click(clearItem(1))
      expect(countInput('品目A')).toHaveValue(20)
      expect(limitCell('品目A')).toBe('30')
      expect(saved()).toMatchObject({ counts: { [keyOf(itemA)]: 20 }, owned: { [UDON]: 300 }, remaining: {} })
      expect(screen.getByLabelText('武蔵うどん の所持数')).toHaveValue(300)
      expect(queryClearItem()).toBeNull()
      expect(screen.queryByTestId('shop-remaining-applied')).toBeNull()
    })

    it('別の品目を変えても回数を書き換えない: 品目 B を変えたあとも保存値の品目 A は 20 で、残りを消すと 20 と出す', () => {
      localStorage.setItem(savedKey, JSON.stringify({ counts: { [keyOf(itemA)]: 20 }, remaining: { [keyOf(itemA)]: 5 } }))
      renderShop()
      enter(countInput('品目B'), '3')
      expect(saved().counts).toMatchObject({ [keyOf(itemA)]: 20, [keyOf(itemB)]: 3 })
      expect(countInput('品目A')).toHaveValue(5)

      fireEvent.click(clearItem(1))
      expect(countInput('品目A')).toHaveValue(20)
    })

    it('残りを消す: 巡霊の葉の残り 10 を消すと上限は 25 に戻り、交換回数と所持数は変わらない', () => {
      localStorage.setItem(
        savedKey,
        JSON.stringify({ counts: { [keyOf(leaf)]: 7 }, owned: { [UDON]: 50 }, remaining: { [keyOf(leaf)]: 10 } }),
      )
      renderShop()
      expect(limitCell('巡霊の葉')).toBe('残り 10 / 上限 25')
      fireEvent.click(clearItem(1))
      expect(limitCell('巡霊の葉')).toBe('25')
      expect(countInput('巡霊の葉')).toHaveValue(7)
      expect(screen.getByLabelText('武蔵うどん の所持数')).toHaveValue(50)
    })

    it('残りが無いときは、メニューに残りを消す項目も、主ボタンの横の印も出さない', () => {
      renderShop()
      expect(screen.queryByTestId('shop-remaining-applied')).toBeNull()
      expect(queryClearItem()).toBeNull()
      expect(screen.getByRole('menuitem', { name: '全部交換欲しい品目を上限まで入れる' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /^足りない分だけ/ })).toBeInTheDocument()
    })

    it('残りを持つ品目×通貨が 2 件なら、主ボタンの横に「残り 2 件を反映中」、メニューに「残りを消す（2 件）」を出す', () => {
      localStorage.setItem(savedKey, JSON.stringify({ remaining: { [keyOf(dangoUdon)]: 1, [keyOf(dangoMusubi)]: 0 } }))
      renderShop()
      expect(screen.getByTestId('shop-remaining-applied')).toHaveTextContent('残り 2 件を反映中')
      expect(clearItem(2)).toHaveTextContent('上限を在庫上限に戻す')
    })

    it('交換回数がすべて 0 の間だけ「まず回数を入れる」の行を出し、回数が入ると出さない', () => {
      renderShop()
      const row = screen.getByTestId('shop-first-fill')
      expect(row).toHaveTextContent('まず回数を入れる')
      expect(within(row).getByRole('button', { name: '全部交換' })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: '足りない分だけ' })).toBeInTheDocument()

      enter(countInput('叡智の業火'), '1')
      expect(screen.queryByTestId('shop-first-fill')).toBeNull()
      expect(screen.queryByRole('button', { name: '全部交換' })).toBeNull()
      // 回数が入ったあとも、メニューからは全部交換を使える。
      fireEvent.click(bulkAction('全部交換'))
      expect(countInput('叡智の業火')).toHaveValue(100)

      enter(countInput('叡智の業火'), '0')
      fireEvent.click(bulkAction('全部交換'))
    })

    describe('品目名のポップアップの残りの入力', () => {
      it('残りを手で入れる: 叡智の業火に 30 を入れると上限は 30 になり、ポップアップは開いたまま', () => {
        renderShop()
        openPopover('叡智の業火')
        const input = screen.getByLabelText('叡智の業火 の残り')
        expect(input).toHaveValue(null)
        enter(input, '30')
        expect(screen.getByLabelText('叡智の業火 の残り')).toBeInTheDocument()
        expect(screen.getByRole('radiogroup', { name: '叡智の業火 は欲しいか' })).toBeInTheDocument()
        expect(limitCell('叡智の業火')).toBe('残り 30 / 上限 100')
        expect(countInput('叡智の業火')).toHaveAttribute('max', '30')
        expect(saved().remaining).toEqual({ [keyOf(fire)]: 30 })
        // 残りを変えても交換回数は書かない
        expect(saved().counts ?? {}).toEqual({})
      })

      it('読み取った残りを直す: 80 を 60 に直すと上限は 60 になる', () => {
        localStorage.setItem(savedKey, JSON.stringify({ remaining: { [keyOf(fire)]: 80 } }))
        renderShop()
        openPopover('叡智の業火')
        expect(screen.getByLabelText('叡智の業火 の残り')).toHaveValue(80)
        enter(screen.getByLabelText('叡智の業火 の残り'), '60')
        expect(limitCell('叡智の業火')).toBe('残り 60 / 上限 100')
      })

      it('残りを空にする: 残りが無くなり上限は在庫上限の 100 に戻る', () => {
        localStorage.setItem(savedKey, JSON.stringify({ remaining: { [keyOf(fire)]: 80 } }))
        renderShop()
        openPopover('叡智の業火')
        enter(screen.getByLabelText('叡智の業火 の残り'), '')
        expect(limitCell('叡智の業火')).toBe('100')
        expect(saved().remaining).toEqual({})
      })

      it('在庫上限を超える値: 巡霊の葉（在庫上限 25）に 40 を入れると残りは 25、小数は切り捨てる', () => {
        renderShop()
        openPopover('巡霊の葉')
        const input = screen.getByLabelText('巡霊の葉 の残り')
        enter(input, '40')
        expect(saved().remaining).toEqual({ [keyOf(leaf)]: 25 })
        fireEvent.blur(input)
        expect(screen.getByLabelText('巡霊の葉 の残り')).toHaveValue(25)
        enter(screen.getByLabelText('巡霊の葉 の残り'), '4.7')
        expect(saved().remaining).toEqual({ [keyOf(leaf)]: 4 })
      })

      it('負の数を入れても残りにならない', () => {
        renderShop()
        openPopover('叡智の業火')
        enter(screen.getByLabelText('叡智の業火 の残り'), '-1')
        expect(limitCell('叡智の業火')).toBe('100')
        expect(saved().remaining ?? {}).toEqual({})
      })

      it('まとめた行の残り: 通貨ごとの入力が並び、江戸むすびに 0 を入れると江戸むすびの月より団子だけが残り 0 になる', () => {
        renderShop()
        openPopover('月より団子')
        const labels = ['武蔵うどん', '江戸むすび', '東干し柿'].map(currency =>
          screen.getByLabelText(`月より団子（${currency}）の残り`),
        )
        expect(labels).toHaveLength(3)
        enter(screen.getByLabelText('月より団子（江戸むすび）の残り'), '0')
        expect(saved().remaining).toEqual({ [keyOf(dangoMusubi)]: 0 })
        // 行の上限 3（2 + 0 + 1）と、通貨ごとの 2・残り 0 / 上限 1・1
        expect(limitCell('月より団子')).toBe('32残り 0 / 上限 11')
      })

      it('上限の無い品目: 10,000 QP のポップアップには残りの入力を出さない', () => {
        renderShop()
        openPopover('10,000 QP')
        expect(screen.getByRole('radiogroup', { name: '10,000 QP は欲しいか' })).toBeInTheDocument()
        expect(screen.queryByLabelText('10,000 QP の残り')).not.toBeInTheDocument()
      })

      it('手で入れた残りも残る: 30 を入れて開き直すと、入力は 30 で上限も 30 のまま', () => {
        const { unmount } = renderShop()
        openPopover('叡智の業火')
        enter(screen.getByLabelText('叡智の業火 の残り'), '30')
        unmount()

        renderShop()
        expect(limitCell('叡智の業火')).toBe('残り 30 / 上限 100')
        openPopover('叡智の業火')
        expect(screen.getByLabelText('叡智の業火 の残り')).toHaveValue(30)
      })

      it('手で入れた残りも消す: 30 を入れたあと残りを消すと上限は 100 に戻る', () => {
        renderShop()
        openPopover('叡智の業火')
        enter(screen.getByLabelText('叡智の業火 の残り'), '30')
        fireEvent.keyDown(screen.getByLabelText('叡智の業火 の残り'), { key: 'Escape' })
        fireEvent.click(clearItem(1))
        expect(limitCell('叡智の業火')).toBe('100')
      })

      it('「欲しい／いらない」を選ぶと今までどおり閉じ、畳んだ「いらない品目」のポップアップにも残りの入力を出す', () => {
        renderShop()
        openPopover('叡智の業火')
        enter(screen.getByLabelText('叡智の業火 の残り'), '30')
        fireEvent.click(
          within(screen.getByRole('radiogroup', { name: '叡智の業火 は欲しいか' })).getByRole('radio', { name: 'いらない' }),
        )
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()

        const summaryButton = unwantedSummary()
        if (summaryButton) fireEvent.click(summaryButton)
        fireEvent.click(within(screen.getByTestId('shop-unwanted-items')).getByRole('button', { name: '叡智の業火' }))
        const input = screen.getByLabelText('叡智の業火 の残り')
        expect(input).toHaveValue(30)
        enter(input, '12')
        expect(saved().remaining).toEqual({ [keyOf(fire)]: 12 })
      })
    })
  })

  describe('ボーナス礼装の枚数の比較', () => {
    const GOLD = 94101
    const SILVER = 94102
    const BRONZE = 94103
    const MORI = 94104
    const POINT = 94199
    const ceEvent = (overrides: Partial<EventPlannerEvent> = {}) =>
      event({
        shop: [
          shopEntry(1, GOLD, { costName: '金の通貨', costAmount: 30, limitNum: 10 }),
          shopEntry(2, SILVER, { costName: '銀の通貨', costAmount: 10, limitNum: 10 }),
          shopEntry(3, BRONZE, { costName: '銅の通貨' }),
          shopEntry(4, MORI, { costName: '盛りの通貨', costAmount: 25, limitNum: 10 }),
        ],
        farmingNodes: [
          {
            questId: 1,
            name: '金のクエスト',
            ap: 40,
            drops: [
              { itemId: GOLD, perRun: 10, countPerRun: 5 },
              { itemId: POINT, perRun: 600, countPerRun: 3, name: 'ポイント' },
            ],
          },
          { questId: 2, name: '盛りのクエスト', ap: 20, drops: [{ itemId: MORI, perRun: 10, countPerRun: 5 }] },
        ],
        bonusRarities: [
          {
            rarity: 5,
            itemId: GOLD,
            craftEssences: [{ id: 501, name: '金の礼装', face: 'https://static.atlasacademy.io/JP/Faces/f_5010.png' }],
            bonus: { base: 1, max: 2 },
          },
          { rarity: 4, itemId: SILVER, craftEssences: [{ id: 401, name: '銀の礼装A' }, { id: 402, name: '銀の礼装B' }] },
          { rarity: 3, itemId: BRONZE, craftEssences: [{ id: 301, name: '銅の礼装' }] },
        ],
        ...overrides,
      })
    const renderShop = (shopEvent: EventPlannerEvent) =>
      render(<EventHubClient summary={summary} boxEvent={shopEvent} features={['shop']} pointItemId={POINT} />)
    const bonusCard = () =>
      screen.getByRole('heading', { name: 'ドロップ増加礼装' }).closest('div.rounded-md') as HTMLElement
    const setValue = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    const select = (name: string, count: string) => setValue(`${name} の交換回数`, count)
    /** 「枚数ごとの行」の入力（☆5 はデータの凸 +2・無凸 +1、無凸 2 枚、フレンド ☆5）と金の通貨の必要量 300。 */
    const fillStar5 = () => {
      select('素材1', '10')
      setValue('☆5 無凸の所持枚数', '2')
    }
    const friend = (name: string) => screen.getByRole('radio', { name })
    const tableRows = () =>
      Array.from(screen.getByTestId('bonus-comparison').querySelectorAll('tbody tr')).map(row =>
        Array.from(row.querySelectorAll('td'))
          .slice(1)
          // ☆ のセルはアイコンを並べるので、読み上げ用の文字で比べる。
          .map(td => (td.querySelector('.sr-only') ?? td).textContent),
      )
    const radio = (total: number) => screen.getByRole('radio', { name: `合計 ${total} 枚を使う` })

    it('☆ ごとに礼装の名前・通貨の名前と増え方、初期値 0 の所持枚数の欄を出し、+N の欄はデータに +N が無い ☆ だけに出す', () => {
      renderShop(ceEvent())
      const star5 = screen.getByTestId('bonus-rarity-5')
      expect(within(star5).getByText('金の礼装')).toBeInTheDocument()
      expect(within(star5).getByText('金の通貨')).toBeInTheDocument()
      expect(within(star5).getByText('無凸 +1／凸 +2')).toBeInTheDocument()
      expect(within(star5).queryByLabelText('☆5 凸の +N')).not.toBeInTheDocument()
      expect(within(star5).queryByLabelText('☆5 無凸の +N')).not.toBeInTheDocument()
      expect(within(screen.getByTestId('bonus-rarity-4')).getByText('銀の礼装A／銀の礼装B')).toBeInTheDocument()
      for (const [rarity, name] of [
        [4, '銀の通貨'],
        [3, '銅の通貨'],
      ] as const) {
        const fieldset = screen.getByTestId(`bonus-rarity-${rarity}`)
        expect(within(fieldset).getByText(name)).toBeInTheDocument()
        for (const label of ['凸の +N', '無凸の +N']) {
          expect(within(fieldset).getByLabelText(`☆${rarity} ${label}`)).toHaveValue(0)
        }
      }
      for (const rarity of [5, 4, 3]) {
        for (const label of ['凸の所持枚数', '無凸の所持枚数']) {
          expect(screen.getByLabelText(`☆${rarity} ${label}`)).toHaveValue(0)
        }
      }
      const friends = within(screen.getByRole('radiogroup', { name: 'フレンドの礼装' }))
      expect(friends.getAllByRole('radio').map(radio => radio.getAttribute('aria-label'))).toEqual([
        'なし',
        '金の礼装',
        '銀の礼装A／銀の礼装B',
        '銅の礼装',
      ])
      expect(friend('金の礼装')).toBeChecked()
      expect(screen.getByLabelText('盛りの通貨 のドロップボーナス')).toHaveValue(0)
      expect(screen.getByLabelText('ポイント のドロップボーナス')).toHaveValue(0)
      for (const name of ['金の通貨', '銀の通貨', '銅の通貨']) {
        expect(screen.queryByLabelText(`${name} のドロップボーナス`)).not.toBeInTheDocument()
      }
      expect(
        within(bonusCard()).getByText('手持ちの礼装を入れると、枚数ごとの周回数と AP を比べ、選んだ編成で周回数を計算します'),
      ).toBeInTheDocument()
      expect(screen.queryByText('データの更新前のため、礼装の枚数を比べられません。')).not.toBeInTheDocument()
    })

    it('品目を選び ☆5 の値と所持を入れると、合計枚数ごとの行（周回数・AP・AP の減り）が出る', () => {
      renderShop(ceEvent())
      fillStar5()
      expect(tableRows()).toEqual([
        ['1', '☆5 フレンド1枚', '0', '0', '15', '600', '-'],
        ['2', '☆5 無凸1枚・フレンド1枚', '0', '0', '12', '480', '120'],
        ['3', '☆5 無凸2枚・フレンド1枚', '0', '0', '10', '400', '80'],
      ])
    })

    it('フレンドの礼装を選んでいるときは、表の上にフレンドの1枚を含むことを出し、「なし」では出さず ☆ の列も自分の枚数だけにする', () => {
      renderShop(ceEvent())
      fillStar5()
      const NOTE = '合計枚数には、フレンドから借りる ☆5 金の礼装（凸）1枚を含みます'
      expect(within(bonusCard()).getByText(NOTE)).toBeInTheDocument()
      fireEvent.click(friend('銀の礼装A／銀の礼装B'))
      expect(
        within(bonusCard()).getByText('合計枚数には、フレンドから借りる ☆4 銀の礼装A／銀の礼装B（凸）1枚を含みます'),
      ).toBeInTheDocument()
      expect(tableRows()[0].slice(0, 4)).toEqual(['1', '0', '☆4 フレンド1枚', '0'])
      fireEvent.click(friend('なし'))
      expect(within(bonusCard()).queryByText(/^合計枚数には/)).not.toBeInTheDocument()
      expect(tableRows().map(row => row.slice(0, 4))).toEqual([
        ['0', '0', '0', '0'],
        ['1', '☆5 無凸1枚', '0', '0'],
        ['2', '☆5 無凸2枚', '0', '0'],
      ])
    })

    it('☆ の列は使う礼装を1枚ずつアイコンで並べ、凸を先に数えて凸・無凸・フレンドを見分け、表の上に印の凡例を出す', () => {
      renderShop(ceEvent())
      select('素材1', '10')
      setValue('☆5 凸の所持枚数', '1')
      setValue('☆5 無凸の所持枚数', '1')
      expect(tableRows().map(row => row.slice(0, 2))).toEqual([
        ['1', '☆5 フレンド1枚'],
        ['2', '☆5 凸1枚・フレンド1枚'],
        ['3', '☆5 凸1枚・無凸1枚・フレンド1枚'],
      ])
      const star5Cell = screen.getByTestId('bonus-comparison').querySelectorAll('tbody tr')[2].querySelectorAll('td')[2]
      // 凸・無凸・フレンドの順に、印（無凸は印なし）で見分ける。
      expect(Array.from(star5Cell.querySelectorAll('span[aria-hidden]')).map(icon => icon.textContent)).toEqual(['凸', '', 'フ'])
      const card = within(bonusCard())
      for (const label of ['無凸', 'フレンド（凸）']) expect(card.getByText(label)).toBeInTheDocument()
      fireEvent.click(friend('なし'))
      expect(card.queryByText('フレンド（凸）')).not.toBeInTheDocument()
      expect(card.getByText('無凸')).toBeInTheDocument()
    })

    it('品目を選んでいないとき・所持数で足りているときは表を出さず、周回で集める通貨が無いことを出す', () => {
      renderShop(ceEvent())
      const NO_NEED = '周回で集める通貨が無いため、枚数の比較はありません。'
      expect(screen.queryByTestId('bonus-comparison')).not.toBeInTheDocument()
      expect(screen.getByText(NO_NEED)).toBeInTheDocument()

      fillStar5()
      expect(screen.getByTestId('bonus-comparison')).toBeInTheDocument()
      setValue('金の通貨 の所持数', '1000')
      expect(screen.queryByTestId('bonus-comparison')).not.toBeInTheDocument()
      expect(screen.getByText(NO_NEED)).toBeInTheDocument()
    })

    it('周回では集められない通貨があるときは、表の近くにその旨を出す', () => {
      renderShop(ceEvent())
      fillStar5()
      select('素材2', '1')
      expect(tableRows()[0]).toEqual(['1', '☆5 フレンド1枚', '0', '0', '15', '600', '-'])
      expect(
        within(bonusCard()).getByText('銀の通貨 は周回では集められないため、集められる通貨だけで比べています。'),
      ).toBeInTheDocument()
    })

    it('対応が空のイベントでは ☆ ごとの欄もデータの更新前の1行も出さず、通貨ごとの欄を出す', () => {
      renderShop(ceEvent({ bonusRarities: [] }))
      expect(screen.queryByLabelText('フレンドの礼装')).not.toBeInTheDocument()
      expect(screen.queryByText('データの更新前のため、礼装の枚数を比べられません。')).not.toBeInTheDocument()
      for (const name of ['金の通貨', '銀の通貨', '銅の通貨', '盛りの通貨', 'ポイント']) {
        expect(screen.getByLabelText(`${name} のドロップボーナス`)).toHaveValue(0)
      }
    })

    it('AP 最少の行が選ばれ、別の行を選ぶと周回の内訳と合計が変わり、選んだ行が無くなると AP 最少の行に戻る', () => {
      renderShop(ceEvent())
      fillStar5()
      expect(radio(3)).toBeChecked()
      expect(screen.getByText('10 周')).toBeInTheDocument()
      expect(screen.getByText('合計 10 周・AP 400')).toBeInTheDocument()

      fireEvent.click(radio(1))
      expect(radio(1)).toBeChecked()
      expect(screen.getByText('合計 15 周・AP 600')).toBeInTheDocument()

      fireEvent.click(radio(3))
      setValue('☆5 無凸の所持枚数', '1')
      expect(screen.queryByRole('radio', { name: '合計 3 枚を使う' })).not.toBeInTheDocument()
      expect(radio(2)).toBeChecked()
      expect(screen.getByText('合計 12 周・AP 480')).toBeInTheDocument()
    })

    it('対応しない通貨の欄の値を、比較の表の各行と周回の内訳の両方に使う', () => {
      renderShop(ceEvent())
      fillStar5()
      select('素材4', '10')
      setValue('盛りの通貨 のドロップボーナス', '3')
      // 盛りは 10 + 5 × 3 = 25 で 10 周・200 AP。金は各行の編成で解く。
      expect(tableRows().map(row => row.slice(0, 1).concat(row.slice(4, 6)))).toEqual([
        ['1', '25', '800'],
        ['2', '22', '680'],
        ['3', '20', '600'],
      ])
      expect(screen.getByText('合計 20 周・AP 600')).toBeInTheDocument()
    })

    it('☆ ごとの欄に -3 と 2.5 を入れると 0 と 2 として扱う', () => {
      renderShop(ceEvent())
      setValue('☆4 凸の +N', '-3')
      expect(screen.getByLabelText('☆4 凸の +N')).toHaveValue(0)
      setValue('☆5 凸の所持枚数', '2.5')
      expect(screen.getByLabelText('☆5 凸の所持枚数')).toHaveValue(2)
    })

    const savedEntry = () => {
      const key = Object.keys(localStorage).find(k => k.startsWith('events/shopInputs/'))
      return key === undefined ? undefined : { key, json: localStorage.getItem(key) ?? '' }
    }
    const totalLine = () => screen.getByText(/^合計 \d+ 周・AP \d+$/).textContent

    it('☆ ごとの欄・フレンドの礼装・選んだ行は開き直しても残り、周回の内訳はその行の編成のまま', () => {
      const { unmount } = renderShop(ceEvent())
      fillStar5()
      setValue('☆5 凸の所持枚数', '1')
      setValue('☆4 凸の +N', '3')
      fireEvent.click(friend('なし'))
      fireEvent.click(radio(1))
      const before = totalLine()
      unmount()

      renderShop(ceEvent())
      expect(screen.getByLabelText('☆5 凸の所持枚数')).toHaveValue(1)
      expect(screen.getByLabelText('☆5 無凸の所持枚数')).toHaveValue(2)
      expect(screen.getByLabelText('☆4 凸の +N')).toHaveValue(3)
      expect(friend('なし')).toBeChecked()
      expect(radio(1)).toBeChecked()
      expect(totalLine()).toBe(before)
    })

    it('表が消えてまた出ても、選んだ行は残る', () => {
      renderShop(ceEvent())
      fillStar5()
      fireEvent.click(radio(1))
      setValue('金の通貨 の所持数', '1000')
      expect(screen.queryByTestId('bonus-comparison')).not.toBeInTheDocument()
      setValue('金の通貨 の所持数', '0')
      expect(radio(1)).toBeChecked()
      expect(screen.getByText('合計 15 周・AP 600')).toBeInTheDocument()
    })

    it('開いたときに保存した行が表に無ければ AP 最少の行を出し、対応に無いフレンドの ☆ は初期値にし、保存値は書き換えない', () => {
      const { unmount } = renderShop(ceEvent())
      fillStar5()
      unmount()
      const saved = savedEntry()
      if (!saved) throw new Error('交換所の入力が保存されていない')
      const stale = JSON.stringify({ ...JSON.parse(saved.json), selectedTotal: 7, friendRarity: 2 })
      localStorage.setItem(saved.key, stale)

      renderShop(ceEvent())
      expect(radio(3)).toBeChecked()
      expect(friend('金の礼装')).toBeChecked()
      expect(screen.getByText('合計 10 周・AP 400')).toBeInTheDocument()
      expect(localStorage.getItem(saved.key)).toBe(stale)
    })

    it('データに +N がある ☆ は、保存した +N を使わずデータの +N で比べる', () => {
      const { unmount } = renderShop(ceEvent())
      fillStar5()
      unmount()
      const saved = savedEntry()
      if (!saved) throw new Error('交換所の入力が保存されていない')
      const parsed = JSON.parse(saved.json) as { rarity: Record<string, Record<string, number>> }
      localStorage.setItem(
        saved.key,
        JSON.stringify({ ...parsed, rarity: { ...parsed.rarity, 5: { ...parsed.rarity['5'], maxBonus: 9, baseBonus: 9 } } }),
      )

      renderShop(ceEvent())
      expect(tableRows()).toEqual([
        ['1', '☆5 フレンド1枚', '0', '0', '15', '600', '-'],
        ['2', '☆5 無凸1枚・フレンド1枚', '0', '0', '12', '480', '120'],
        ['3', '☆5 無凸2枚・フレンド1枚', '0', '0', '10', '400', '80'],
      ])
    })

    it('ボーナス礼装の入力は、開いただけでは保存しない', () => {
      renderShop(ceEvent())
      expect(savedEntry()).toBeUndefined()
    })
  })
})

/** 一覧の下の通貨ごとの必要量の欄。 */
const cardOf = (currency: string) =>
  screen.getByRole('heading', { name: currency }).closest('div.rounded-md') as HTMLElement

/** 交換回数の入力のある品目の行。 */
const rowOfItem = (name: string) => screen.getByLabelText(`${name} の交換回数`).closest('tr') as HTMLElement

/** 品目名を押してポップアップを出し、「欲しい」か「いらない」を選ぶ。 */
const chooseWant = (name: string, choice: '欲しい' | 'いらない') => {
  // 同じ品目の行が複数あっても設定は1つなので、最初の行の品目名を押す。
  const [button] = screen.getAllByRole('button', { name })
  if (!button) throw new Error(`no item name button: ${name}`)
  fireEvent.click(button)
  const group = screen.getByRole('radiogroup', { name: `${name} は欲しいか` })
  fireEvent.click(within(group).getByRole('radio', { name: choice }))
}

/** 表の最後に畳んだ「いらない品目」の開閉のボタン。 */
const unwantedSummary = () => screen.queryByRole('button', { name: /いらない品目 \d+ 件/ })

/** 畳んだ「いらない品目」を開き（閉じていれば）、その中の名前からポップアップを出して選ぶ。 */
const chooseWantFromCollapsed = (name: string, choice: '欲しい' | 'いらない') => {
  const summaryButton = unwantedSummary()
  if (summaryButton?.getAttribute('aria-expanded') === 'false') fireEvent.click(summaryButton)
  fireEvent.click(within(screen.getByTestId('shop-unwanted-items')).getByRole('button', { name }))
  const group = screen.getByRole('radiogroup', { name: `${name} は欲しいか` })
  fireEvent.click(within(group).getByRole('radio', { name: choice }))
}

/** 一覧の表の行を「順位|品目名|効率」か、見出しの行の文言にする。 */
const bodyRows = (card: HTMLElement) =>
  Array.from(card.querySelectorAll<HTMLTableRowElement>('tbody tr')).map(tr => {
    const input = tr.querySelector('input')
    if (!input) return tr.textContent
    const name = input.getAttribute('aria-label')?.replace(' の交換回数', '')
    return `${tr.cells[0]?.textContent}|${name}|${tr.cells[6]?.textContent}`
  })

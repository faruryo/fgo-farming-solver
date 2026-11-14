// @vitest-environment jsdom
import React, { useLayoutEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { atlasDetailUrl, EventShopCatalog, EventShopList } from './EventShopList'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'
import type { RosterNeed } from '../../hooks/use-roster-need'
import { shopItemKeys } from '../../lib/event-shop-summary'

vi.mock('react-i18next', async () => (await import('./events-i18n-test-utils')).eventsTranslationMock())

const mocks = vi.hoisted(() => ({
  // undefined のときは実フックを使う。
  roster: undefined as RosterNeed | undefined,
  apBudgetUnloaded: false,
}))

vi.mock('../../hooks/use-roster-need', async importOriginal => {
  const actual = await importOriginal<typeof import('../../hooks/use-roster-need')>()
  return { ...actual, useRosterNeed: () => mocks.roster ?? actual.useRosterNeed() }
})

// 素材の一覧は読み込み中のまま（必要数のある素材の状態だけで足りる）。描くたびに同じ値を返す。
const catalogLoading = vi.hoisted(() => ({ catalog: null, failed: false, reload: () => undefined }))
vi.mock('../../hooks/use-material-catalog', () => ({
  useMaterialCatalog: () => catalogLoading,
}))

vi.mock('./ApBudget', async importOriginal => {
  const actual = await importOriginal<typeof import('./ApBudget')>()
  return {
    ...actual,
    useApBudgetProfile: () => {
      const profile = actual.useApBudgetProfile()
      return mocks.apBudgetUnloaded ? { ...profile, loaded: false } : profile
    },
  }
})

const UDON = 94001
const MUSUBI = 94002

const shopEntry = (itemId: number, costItemId: number, extra: Partial<EventShopItem> = {}): EventShopItem => ({
  itemId,
  qty: 2,
  costItemId,
  costAmount: 100,
  limitNum: 5,
  name: `素材${itemId}`,
  ...extra,
})

const shopEvent = (id = 80632): EventPlannerEvent => ({
  id,
  name: 'テストイベント',
  type: 'eventQuest',
  startedAt: 1000,
  endedAt: 2000,
  currency: { id: UDON, name: '武蔵うどん', icon: '' },
  unlimitedBoxes: false,
  lotteries: [],
  shop: [
    shopEntry(1, UDON, { costName: '武蔵うどん' }),
    shopEntry(2, MUSUBI, { costName: '江戸むすび', costAmount: 10, limitNum: 10 }),
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
})

const savedKey = (id: number) => `events/shopInputs/${id}`

/** 素材1 の交換回数 3、武蔵うどんの所持数 200、ボーナス +2 を保存しておく。 */
const seedSaved = (event: EventPlannerEvent) => {
  const [item1] = shopItemKeys(event.shop)
  localStorage.setItem(
    savedKey(event.id),
    JSON.stringify({ counts: { [item1]: 3 }, owned: { [UDON]: 200 }, bonus: { [UDON]: 2 }, rarity: {} }),
  )
}

/** 交換所の入力欄と、保存値から出す表示のどれかがあるか。 */
const shopFieldsIn = (root: HTMLElement) => {
  const scope = within(root)
  return {
    count: scope.queryByLabelText('素材1 の交換回数'),
    owned: scope.queryByLabelText('武蔵うどん の所持数'),
    bonus: scope.queryByLabelText('武蔵うどん のドロップボーナス'),
    summary: scope.queryByText(/周回の合計/),
    perRun: root.querySelector('[data-testid="shop-per-run"]'),
    busy: root.querySelector('[aria-busy="true"]'),
  }
}

const expectLoadingView = (root: HTMLElement) => {
  const fields = shopFieldsIn(root)
  expect(fields.count).toBeNull()
  expect(fields.owned).toBeNull()
  expect(fields.bonus).toBeNull()
  expect(fields.summary).toBeNull()
  expect(fields.perRun).toBeNull()
  expect(fields.busy).not.toBeNull()
  expect(within(root).queryByRole('link', { name: '育成対象を設定' })).toBeNull()
}

/** 最初のクライアント描画（保存値を読む effect の前）の DOM を写し取る。 */
const FirstCommitProbe: React.FC<{ onCommit: (html: string) => void }> = ({ onCommit }) => {
  useLayoutEffect(() => {
    onCommit(document.body.innerHTML)
  }, [onCommit])
  return null
}

const cardOf = (currency: string) =>
  screen.getByRole('heading', { name: currency }).closest('div.rounded-md') as HTMLElement

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

describe('EventShopList の保存値を読み終えるまでの表示', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.roster = undefined
    mocks.apBudgetUnloaded = false
  })
  afterEach(() => {
    localStorage.clear()
    mocks.roster = undefined
    mocks.apBudgetUnloaded = false
  })

  it('サーバー描画では、保存値があっても交換回数・所持数・ボーナスの欄と周回の合計・1周の獲得量を出さず、読み込み中にする', () => {
    const event = shopEvent()
    seedSaved(event)

    const container = document.createElement('div')
    container.innerHTML = renderToString(<EventShopList event={event} />)
    expectLoadingView(container)
  })

  it('最初のクライアント描画も読み込み中で、読み終えると保存値で欄と必要量・周回の内訳を出す', () => {
    const event = shopEvent()
    seedSaved(event)

    let firstCommit = ''
    const onCommit = (html: string) => {
      firstCommit ||= html
    }
    render(
      <>
        <EventShopList event={event} />
        <FirstCommitProbe onCommit={onCommit} />
      </>,
    )
    const first = document.createElement('div')
    first.innerHTML = firstCommit
    expectLoadingView(first)

    expect(screen.getByLabelText('素材1 の交換回数')).toHaveValue(3)
    expect(screen.getByLabelText('武蔵うどん の所持数')).toHaveValue(200)
    expect(screen.getByLabelText('武蔵うどん のドロップボーナス')).toHaveValue(2)
    // 3 回 × 100 − 所持 200 = 100。
    expect(within(cardOf('武蔵うどん')).getByText('必要量 100')).toBeInTheDocument()
    // ボーナス +2 × 回数 5 で 1周 10 → 20。100 ÷ 20 = 5 周、AP 200。
    const perRun = screen.getByTestId('shop-per-run')
    expect(within(perRun).getByText('20.0')).toBeInTheDocument()
    expect(screen.getByText('合計 5 周・AP 200')).toBeInTheDocument()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('「いらない」の品目がある交換所を開き直すと、設定を読み終えるまでその行を入力欄つきで出さず、読み終えると畳む', () => {
    const event = shopEvent()
    seedSaved(event)
    localStorage.setItem('events/shopWantedItems', JSON.stringify({ 1: false }))

    const server = document.createElement('div')
    server.innerHTML = renderToString(<EventShopList event={event} />)
    expect(within(server).queryByLabelText('素材1 の交換回数')).toBeNull()

    let firstCommit = ''
    const onCommit = (html: string) => {
      firstCommit ||= html
    }
    render(
      <>
        <EventShopList event={event} />
        <FirstCommitProbe onCommit={onCommit} />
      </>,
    )
    const first = document.createElement('div')
    first.innerHTML = firstCommit
    expect(within(first).queryByLabelText('素材1 の交換回数')).toBeNull()
    expect(first.querySelector('[aria-busy="true"]')).not.toBeNull()

    expect(screen.queryByLabelText('素材1 の交換回数')).not.toBeInTheDocument()
    expect(screen.getByLabelText('素材2 の交換回数')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /いらない品目 1 件/ })).toBeInTheDocument()
    // 保存した 3 回は計算に入らない。
    expect(within(cardOf('武蔵うどん')).getByText('必要量 0')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('events/shopWantedItems') ?? 'null')).toEqual({ 1: false })
  })

  it('保存値の無いイベントを開いて読み終えると欄は 0 で、端末に書き込まない', () => {
    const event = shopEvent(80700)
    render(<EventShopList event={event} />)

    expect(screen.getByLabelText('素材1 の交換回数')).toHaveValue(0)
    expect(screen.getByLabelText('武蔵うどん の所持数')).toHaveValue(0)
    expect(screen.getByLabelText('武蔵うどん のドロップボーナス')).toHaveValue(0)
    expect(localStorage.getItem(savedKey(80700))).toBeNull()
  })

  it('育成計画の保存値を読む前は「育成対象を設定」のリンクを出さず、読み込み中にする', () => {
    const event = shopEvent()
    mocks.roster = { status: 'unread' }
    const { container, unmount } = render(<EventShopList event={event} />)

    expectLoadingView(container)
    unmount()

    // 保存値の無い端末で育成計画を読み終えたら、未設定のリンクを出す。
    mocks.roster = undefined
    render(<EventShopList event={event} />)
    expect(screen.getByRole('link', { name: '育成対象を設定' })).toBeInTheDocument()
  })

  it('AP 予算の保存値を読む前は、周回の内訳に AP 予算の内訳と欄を出さず、読み込み中にする', () => {
    const event = shopEvent()
    seedSaved(event)
    mocks.apBudgetUnloaded = true
    render(<EventShopList event={event} />)

    expect(screen.getByText('合計 5 周・AP 200')).toBeInTheDocument()
    const budget = screen.getByTestId('shop-ap-budget')
    expect(within(budget).queryByText('AP予算内訳')).toBeNull()
    expect(within(budget).queryByLabelText('マスターレベル')).toBeNull()
    expect(within(budget).queryByLabelText('所持 黄金の果実')).toBeNull()
    expect(budget.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})

const KAKI = 94003
const LEAF = 6521
const DANGO = 9306300

const CURRENCY_NAMES = new Map([
  [UDON, '武蔵うどん'],
  [MUSUBI, '江戸むすび'],
  [KAKI, '東干し柿'],
])

const item80632 = (
  itemId: number,
  name: string,
  costItemId: number,
  costAmount: number,
  limitNum: number,
  extra: Partial<EventShopItem> = {},
) => shopEntry(itemId, costItemId, { name, qty: 1, costAmount, limitNum, costName: CURRENCY_NAMES.get(costItemId), ...extra })

const svt80632 = (itemId: number, name: string, costItemId: number, costAmount: number, limitNum: number) =>
  item80632(itemId, name, costItemId, costAmount, limitNum, { kind: 'svt' })

/** 80632 の形の交換所（ゲーム内の順）。 */
const shop80632 = (): EventShopItem[] => [
  item80632(7001, 'サーヴァントコイン', UDON, 10, 16, { qty: 10 }),
  item80632(7001, 'サーヴァントコイン', MUSUBI, 10, 16, { qty: 10 }),
  item80632(7001, 'サーヴァントコイン', KAKI, 10, 16, { qty: 10 }),
  svt80632(DANGO, '月より団子', UDON, 100, 2),
  svt80632(DANGO, '月より団子', MUSUBI, 100, 1),
  svt80632(DANGO, '月より団子', KAKI, 100, 1),
  item80632(6999, '伝承結晶', UDON, 200, 2),
  item80632(6999, '伝承結晶', MUSUBI, 200, 2),
  item80632(6999, '伝承結晶', KAKI, 200, 1),
  svt80632(9700100, '流星のフォウくん', UDON, 150, 1),
  svt80632(9700100, '流星のフォウくん', KAKI, 150, 1),
  item80632(LEAF, '巡霊の葉', UDON, 10, 25, { qty: 10 }),
  item80632(LEAF, '巡霊の葉', MUSUBI, 10, 25, { qty: 10 }),
  item80632(LEAF, '巡霊の葉', KAKI, 10, 25, { qty: 10 }),
  item80632(6537, '鬼炎鬼灯', UDON, 10, 5),
  item80632(6538, '蛮神の心臓', MUSUBI, 10, 5),
  item80632(6539, '素材X', KAKI, 10, 5),
  svt80632(9770500, '叡智の業火', KAKI, 5, 100),
  item80632(1, 'QP', UDON, 2, 0),
  item80632(1, 'QP', MUSUBI, 50, 0),
  item80632(1, 'QP', KAKI, 50, 0),
]

const event80632 = (): EventPlannerEvent => ({
  ...shopEvent(80632),
  shop: shop80632(),
  farmingNodes: [
    {
      questId: 1,
      name: '上級',
      ap: 40,
      drops: [UDON, MUSUBI, KAKI].map(itemId => ({ itemId, perRun: 10, countPerRun: 5 })),
    },
  ],
})

/** 効率は 素材X 9、鬼炎鬼灯 7.72、蛮神の心臓 7.63。 */
const AP_PRICES_80632 = { 6537: 77.2, 6538: 76.3, 6539: 90 }

/** 一覧の表の行を「順位|品目名|効率」か、見出しの行の文言にする。 */
const bodyRows = () =>
  Array.from(screen.getByTestId('shop-item-list').querySelectorAll<HTMLTableRowElement>('tbody tr')).map(tr => {
    const input = tr.querySelector('input')
    if (!input) return tr.textContent
    const name = input.getAttribute('aria-label')?.replace(' の交換回数', '')
    return `${tr.cells[0]?.textContent}|${name}|${tr.cells[6]?.textContent}`
  })

const countInput = (name: string) => screen.getByLabelText(`${name} の交換回数`)
const rowOf = (name: string) => countInput(name).closest('tr') as HTMLTableRowElement
const enter = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

/** 保存した月より団子の品目ごとの回数（武蔵うどん・江戸むすび・東干し柿の順）。 */
const savedDangoCounts = (event: EventPlannerEvent) => {
  const keys = shopItemKeys(event.shop)
  const saved = JSON.parse(localStorage.getItem(savedKey(event.id)) ?? '{}') as { counts?: Record<string, number> }
  const counts = new Map(Object.entries(saved.counts ?? {}))
  return [3, 4, 5].map(i => counts.get(keys.at(i) ?? '') ?? 0)
}
const DANGO_LIMITS = [2, 1, 1]
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

describe('EventShopList の1つの一覧', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.roster = undefined
  })
  afterEach(() => {
    localStorage.clear()
    mocks.roster = undefined
  })

  const renderShop = (event = event80632(), apPrices: Record<number, number> = AP_PRICES_80632) =>
    render(<EventShopList event={event} apPrices={apPrices} />)

  it('80632 の形の交換所は1つの表に並び、効率のある行が通貨をまたいで効率の高い順、その後に効率の無い行が交換所の順に並ぶ', () => {
    renderShop()
    // 3つの通貨の品目が1つの一覧に並ぶ（通貨ごとの表に分かれない）。
    expect(screen.getAllByTestId('shop-item-list')).toHaveLength(1)
    expect(within(screen.getByTestId('shop-item-list')).getAllByRole('table')).toHaveLength(1)
    expect(bodyRows()).toEqual([
      '効率順',
      '1|素材X|9',
      '2|鬼炎鬼灯|7.72',
      '3|蛮神の心臓|7.63',
      'AP 換算なし',
      '|サーヴァントコイン|',
      '|月より団子|',
      '|伝承結晶|',
      '|流星のフォウくん|',
      '|巡霊の葉|',
      '|叡智の業火|',
      '|QP|',
      '|QP|',
      '|QP|',
    ])
  })

  it('375px で7列が収まるよう、品目名の欄の 8em の最小幅は sm 以上だけに付け、sm 未満はアイコンを名前の上に置く（#240）', () => {
    renderShop()
    // jsdom では幅を測れないので、狭い幅の下限（4em）と広い幅の最小幅（8em）の付け分けを確かめる。
    const itemCell = rowOf('月より団子').cells[1]
    const classes = itemCell?.className.split(/\s+/) ?? []
    expect(classes).toContain('min-w-[4em]')
    expect(classes).toContain('sm:min-w-[8em]')
    expect(classes).not.toContain('min-w-[8em]')
    expect(itemCell?.firstElementChild?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['flex-col', 'sm:flex-row']),
    )
  })

  it('sm 未満では順位の列を隠し、交換回数の入力欄を細くして品目名に幅を回す（#240）', () => {
    renderShop()
    const row = rowOf('月より団子')
    const classesOf = (el: Element | null | undefined) => el?.className.split(/\s+/) ?? []
    const rankHeader = within(screen.getByTestId('shop-item-list')).getAllByRole('columnheader')[0]
    for (const rankCell of [rankHeader, row.cells[0]]) {
      expect(classesOf(rankCell)).toEqual(expect.arrayContaining(['hidden', 'sm:table-cell']))
    }
    const box = countInput('月より団子').parentElement
    expect(classesOf(box)).toEqual(expect.arrayContaining(['w-10', 'sm:w-12']))
    expect(classesOf(box)).not.toContain('w-12')
  })

  it('交換回数の数字は 16px のまま 3/4 に縮めて周りの 12px に揃え、iOS Safari のフォーカス時の拡大を避ける（#240）', () => {
    renderShop()
    const classes = countInput('月より団子').className.split(/\s+/)
    // 16px 未満の文字サイズ（text-sm・text-xs）にすると iOS Safari がフォーカス時に拡大する。
    expect(classes).toEqual(expect.arrayContaining(['text-base', 'md:text-base', 'scale-75', 'origin-top-left']))
    expect(classes).not.toContain('md:text-sm')
    expect(classes).not.toContain('text-xs')
  })

  it('一覧の上に所持数の入力は無く、表より後の通貨ごとのカードに、見出し・所持数と選んだ交換と必要量の段・全交換の段の順で並ぶ', () => {
    renderShop()
    expect(screen.queryByTestId('shop-owned-inputs')).not.toBeInTheDocument()
    const list = screen.getByTestId('shop-item-list')
    const needs = screen.getByTestId('shop-currency-needs')
    expect(list.compareDocumentPosition(needs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const input of screen.getAllByLabelText(/ の所持数$/)) {
      expect(input.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    }
    expect(within(needs).getAllByRole('heading').map(h => h.textContent)).toEqual(['武蔵うどん', '江戸むすび', '東干し柿'])

    const card = cardOf('江戸むすび')
    const [heading, ownedRow, totalRow] = Array.from(card.children)
    expect(heading?.textContent).toBe('江戸むすび')
    expect(within(ownedRow as HTMLElement).getByLabelText('江戸むすび の所持数')).toBeInTheDocument()
    expect(ownedRow?.textContent).toBe('所持数選んだ交換 0必要量 0')
    expect(totalRow?.textContent).toMatch(/^全交換 /)
  })

  it('まとめた行の回数と、カードで入れた所持数から必要量を出す', () => {
    renderShop()
    enter(countInput('月より団子'), '4')
    enter(screen.getByLabelText('武蔵うどん の所持数'), '50')
    expect(within(cardOf('武蔵うどん')).getByText('選んだ交換 200')).toBeInTheDocument()
    expect(within(cardOf('武蔵うどん')).getByText('必要量 150')).toBeInTheDocument()
    expect(within(cardOf('江戸むすび')).getByText('選んだ交換 100')).toBeInTheDocument()
    expect(within(cardOf('東干し柿')).getByText('選んだ交換 100')).toBeInTheDocument()
  })

  it('カードで入れた所持数は読み込み直しても残り、必要量はその値で出る', () => {
    const { unmount } = renderShop()
    enter(screen.getAllByLabelText('QP の交換回数').at(1) as HTMLElement, '6')
    enter(screen.getByLabelText('江戸むすび の所持数'), '200')
    expect(within(cardOf('江戸むすび')).getByText('必要量 100')).toBeInTheDocument()
    unmount()

    renderShop()
    expect(screen.getByLabelText('江戸むすび の所持数')).toHaveValue(200)
    expect(within(cardOf('江戸むすび')).getByText('必要量 100')).toBeInTheDocument()
  })

  it('まとめた行に在庫上限の合計と通貨ごとの在庫上限・対価が出て、1通貨だけの品目の対価には通貨と数が出る', () => {
    renderShop()
    const dango = rowOf('月より団子')
    expect(dango.cells[4]?.textContent).toBe('4武蔵うどん2江戸むすび1東干し柿1')
    expect(dango.cells[5]?.textContent).toBe('武蔵うどん100江戸むすび100東干し柿100')
    expect(countInput('月より団子')).toHaveAttribute('max', '4')
    expect(rowOf('流星のフォウくん').cells[4]?.textContent).toBe('2武蔵うどん1東干し柿1')
    expect(rowOf('叡智の業火').cells[5]?.textContent).toBe('東干し柿5')
  })

  it('月より団子の行に 4 を入れると、表の下の選んだ交換が 200・100・100 になり、行に内訳が出て、品目ごとに 2・1・1 で保存される', () => {
    const event = event80632()
    renderShop(event)
    enter(countInput('月より団子'), '4')

    expect(countInput('月より団子')).toHaveValue(4)
    expect(within(rowOf('月より団子')).getByText('武蔵うどん 2・江戸むすび 1・東干し柿 1')).toBeInTheDocument()
    expect(within(cardOf('武蔵うどん')).getByText('選んだ交換 200')).toBeInTheDocument()
    expect(within(cardOf('江戸むすび')).getByText('選んだ交換 100')).toBeInTheDocument()
    expect(within(cardOf('東干し柿')).getByText('選んだ交換 100')).toBeInTheDocument()
    expect(savedDangoCounts(event)).toEqual([2, 1, 1])
  })

  it('月より団子の行に 3 を入れると、品目ごとの回数の合計が 3 でどれも在庫上限以下。9 は 4 で頭打ち', () => {
    const event = event80632()
    renderShop(event)
    enter(countInput('月より団子'), '3')
    const counts = savedDangoCounts(event)
    expect(sum(counts)).toBe(3)
    counts.forEach((n, k) => expect(n).toBeLessThanOrEqual(DANGO_LIMITS.at(k) ?? 0))

    enter(countInput('月より団子'), '9')
    expect(countInput('月より団子')).toHaveValue(4)
    expect(savedDangoCounts(event)).toEqual([2, 1, 1])
  })

  it('江戸むすびの月より団子だけに 1 を保存して開くと行は 1 で江戸むすびの選んだ交換は 100。行を 2 にすると品目ごとの合計が 2', () => {
    const event = event80632()
    const keys = shopItemKeys(event.shop)
    localStorage.setItem(savedKey(event.id), JSON.stringify({ counts: { [keys.at(4) ?? '']: 1 } }))
    renderShop(event)

    expect(countInput('月より団子')).toHaveValue(1)
    expect(within(rowOf('月より団子')).getByText('江戸むすび 1')).toBeInTheDocument()
    expect(within(cardOf('江戸むすび')).getByText('選んだ交換 100')).toBeInTheDocument()
    expect(within(cardOf('武蔵うどん')).getByText('選んだ交換 0')).toBeInTheDocument()

    enter(countInput('月より団子'), '2')
    expect(sum(savedDangoCounts(event))).toBe(2)
  })

  it('在庫上限の無い QP は通貨ごとに別の行になり、それぞれに回数を入れられる', () => {
    renderShop()
    const inputs = screen.getAllByLabelText('QP の交換回数')
    expect(inputs).toHaveLength(3)
    enter(inputs.at(1) as HTMLElement, '2')
    expect(within(cardOf('江戸むすび')).getByText('選んだ交換 100')).toBeInTheDocument()
    expect(within(cardOf('武蔵うどん')).getByText('選んだ交換 0')).toBeInTheDocument()
  })

  it('「全部交換」を押すと月より団子の行は 4 で内訳に3つの通貨が出て、サーヴァントコインの行は 48', () => {
    renderShop()
    fireEvent.click(bulkAction('全部交換'))
    expect(countInput('月より団子')).toHaveValue(4)
    expect(within(rowOf('月より団子')).getByText('武蔵うどん 2・江戸むすび 1・東干し柿 1')).toBeInTheDocument()
    expect(countInput('サーヴァントコイン')).toHaveValue(48)
  })

  it('巡霊の葉の不足が 800 のとき「足りない分だけ」を押すと、行は 75 で「育成にあと 800 個」だけが出て「交換所では 50 個足りない」は出ない', () => {
    mocks.roster = {
      status: 'ready',
      chaldeaState: {},
      materialsForServants: {},
      totalNeed: new Map([[LEAF, 800]]),
    }
    renderShop()
    fireEvent.click(bulkAction('足りない分だけ'))

    expect(countInput('巡霊の葉')).toHaveValue(75)
    expect(within(rowOf('巡霊の葉')).getByText('育成にあと 800 個')).toBeInTheDocument()
    expect(screen.queryByText(/交換所では/)).not.toBeInTheDocument()
  })

  it('状態は品目のセルに出し、行の下に2段目も切り替えも置かない', () => {
    mocks.roster = {
      status: 'ready',
      chaldeaState: {},
      materialsForServants: {},
      totalNeed: new Map([[LEAF, 800]]),
    }
    renderShop()

    const row = rowOf('巡霊の葉')
    expect(within(row.cells[1] as HTMLElement).getByText('育成にあと 800 個')).toBeInTheDocument()
    expect(row.nextElementSibling?.querySelector('td[colspan]') ?? null).toBeNull()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('まとめた月より団子の品目名から「いらない」を選ぶと、行ごと畳まれて設定は1つだけ保存され、表の下の選んだ交換から外れる', () => {
    renderShop()
    enter(countInput('月より団子'), '4')
    expect(within(cardOf('江戸むすび')).getByText('選んだ交換 100')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '月より団子' }))
    fireEvent.click(screen.getByRole('radio', { name: 'いらない' }))

    expect(screen.queryByLabelText('月より団子 の交換回数')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /いらない品目 1 件/ })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('events/shopWantedItems') ?? 'null')).toEqual({ [`svt:${DANGO}`]: false })
    expect(within(cardOf('江戸むすび')).getByText('選んだ交換 0')).toBeInTheDocument()
    expect(savedDangoCounts(event80632())).toEqual([2, 1, 1])
  })

  it('礼装の品目名を押すと、ポップアップに Atlas Academy DB の礼装のページを新しいタブで開く「アイテム詳細」ボタンが出る', () => {
    const event = event80632()
    event.shop = event.shop?.map(s => (s.itemId === DANGO ? { ...s, collectionNo: 1234 } : s))
    renderShop(event)

    fireEvent.click(screen.getByRole('button', { name: '月より団子' }))
    const link = screen.getByRole('link', { name: '月より団子 のアイテム詳細を Atlas Academy DB で開く（新しいタブ）' })
    expect(link).toHaveTextContent('アイテム詳細')
    expect(link).toHaveAttribute('title', '月より団子 のアイテム詳細を Atlas Academy DB で開く（新しいタブ）')
    expect(link).toHaveAttribute('href', 'https://apps.atlasacademy.io/db/JP/craft-essence/1234')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('図鑑番号を持たない品目（旧データの礼装）のポップアップにはリンクを出さない', () => {
    renderShop()
    fireEvent.click(screen.getByRole('button', { name: '月より団子' }))
    expect(screen.getByRole('radio', { name: 'いらない' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Atlas Academy DB/ })).not.toBeInTheDocument()
  })

  it('「いらない」に畳んだ礼装の品目名のポップアップにもリンクが出る', () => {
    const event = event80632()
    event.shop = event.shop?.map(s => (s.itemId === DANGO ? { ...s, collectionNo: 1234 } : s))
    renderShop(event)
    fireEvent.click(screen.getByRole('button', { name: '月より団子' }))
    fireEvent.click(screen.getByRole('radio', { name: 'いらない' }))

    fireEvent.click(screen.getByRole('button', { name: /いらない品目 1 件/ }))
    fireEvent.click(screen.getByRole('button', { name: '月より団子' }))
    expect(screen.getByRole('link', { name: /Atlas Academy DB/ })).toHaveAttribute(
      'href',
      'https://apps.atlasacademy.io/db/JP/craft-essence/1234',
    )
  })

  it('素材の品目名のポップアップに、Atlas Academy DB のアイテムのページを新しいタブで開く「アイテム詳細」ボタンが出る', () => {
    renderShop()
    fireEvent.click(screen.getByRole('button', { name: '鬼炎鬼灯' }))
    const link = screen.getByRole('link', { name: '鬼炎鬼灯 のアイテム詳細を Atlas Academy DB で開く（新しいタブ）' })
    expect(link).toHaveTextContent('アイテム詳細')
    expect(link).toHaveAttribute('href', 'https://apps.atlasacademy.io/db/JP/item/6537')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('対価が通貨で違うまとめた行は効率 10 が1つだけ出て効率 7 の行より前に並び、効率の無い行が無ければ見出しを出さない', () => {
    const event: EventPlannerEvent = {
      ...shopEvent(80611),
      shop: [
        shopEntry(6601, UDON, { costName: '武蔵うどん', qty: 1, costAmount: 1, limitNum: 3 }),
        shopEntry(6600, UDON, { costName: '武蔵うどん', qty: 1, costAmount: 5, limitNum: 3 }),
        shopEntry(6600, MUSUBI, { costName: '江戸むすび', qty: 1, costAmount: 10, limitNum: 3 }),
      ],
    }
    renderShop(event, { 6600: 50, 6601: 7 })
    expect(bodyRows()).toEqual(['1|素材6600|10', '2|素材6601|7'])
    expect(screen.getAllByLabelText('素材6600 の交換回数')).toHaveLength(1)
    expect(screen.queryByText('効率順')).not.toBeInTheDocument()
    expect(screen.queryByText('AP 換算なし')).not.toBeInTheDocument()
  })
})

describe('atlasDetailUrl', () => {
  it('アイテムは item id、礼装は図鑑番号のページで、図鑑番号の無い svt（種火・フォウくん）はページ無し', () => {
    expect(atlasDetailUrl({ itemId: 6548 })).toBe('https://apps.atlasacademy.io/db/JP/item/6548')
    expect(atlasDetailUrl({ itemId: 9407590, kind: 'svt', collectionNo: 1969 })).toBe(
      'https://apps.atlasacademy.io/db/JP/craft-essence/1969',
    )
    expect(atlasDetailUrl({ itemId: 9570400, kind: 'svt' })).toBeUndefined()
  })
})

describe('EventShopCatalog（品目がすべてサーヴァント扱い）', () => {
  const svt = (itemId: number, name: string, costItemId: number, limitNum: number): EventShopItem => ({
    itemId,
    kind: 'svt',
    qty: 1,
    costItemId,
    costAmount: 100,
    limitNum,
    name,
    costName: CURRENCY_NAMES.get(costItemId),
  })

  it('1つの一覧に入力なしで並び、複数の通貨で交換できる品目は1行で在庫上限の合計と通貨ごとの対価・在庫上限が出る', () => {
    render(
      <EventShopCatalog
        shop={[svt(9770500, '叡智の大火', UDON, 100), svt(DANGO, '月より団子', UDON, 2), svt(DANGO, '月より団子', MUSUBI, 1)]}
      />,
    )
    expect(screen.getAllByRole('table')).toHaveLength(1)
    const rows = Array.from(screen.getByTestId('shop-item-list').querySelectorAll<HTMLTableRowElement>('tbody tr'))
    expect(rows.map(tr => tr.cells[0]?.textContent)).toEqual(['叡智の大火', '月より団子'])
    const dango = rows.at(1)
    expect(dango?.cells[2]?.textContent).toBe('3武蔵うどん2江戸むすび1')
    expect(dango?.cells[3]?.textContent).toBe('武蔵うどん100江戸むすび100')
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByText(/全交換/)).not.toBeInTheDocument()
  })

  it('図鑑番号を持つ礼装は名前の横に Atlas Academy DB を開く「アイテム詳細」ボタンが出て名前は文字のまま、持たない品目にはボタンを出さない', () => {
    render(
      <EventShopCatalog
        shop={[svt(9770500, '叡智の大火', UDON, 100), { ...svt(9311320, '英霊極点：アルトリア・ペンドラゴン', UDON, 1), collectionNo: 2513 }]}
      />,
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAccessibleName('英霊極点：アルトリア・ペンドラゴン のアイテム詳細を Atlas Academy DB で開く（新しいタブ）')
    expect(links[0]).toHaveTextContent('アイテム詳細')
    expect(links[0]).toHaveAttribute('href', 'https://apps.atlasacademy.io/db/JP/craft-essence/2513')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('英霊極点：アルトリア・ペンドラゴン').closest('a')).toBeNull()
  })
})

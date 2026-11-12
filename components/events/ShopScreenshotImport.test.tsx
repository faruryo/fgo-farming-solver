// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { EventHubClient } from './EventHubClient'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'
import type { ShopImportAnalysis } from '../../lib/shop-screenshot-import/analyze'
import { shopItemKeys } from '../../lib/event-shop-summary'

const analyzeMock = vi.hoisted(() => ({ fn: vi.fn() }))

// 文字認識と照合はモックし、確かめの画面と保存値への書き込みだけを見る。
vi.mock('../../lib/shop-screenshot-import/analyze', () => ({
  analyzeShopScreenshots: (...args: unknown[]) => analyzeMock.fn(...args) as unknown,
}))

vi.mock('react-i18next', async () => (await import('../i18n-test-utils')).translationMock())

vi.mock('./EventPlannerClient', () => ({
  EventPlannerClient: () => <div data-testid="box-planner" />,
}))

vi.mock('./EventCraftSection', () => ({
  EventCraftSection: () => <div data-testid="craft-section" />,
}))

const UDON = 94162303
const MUSUBI = 94162302
const KAKI = 94162301
const CURRENCY = new Map([
  [UDON, { costName: '武蔵うどん', costIcon: '/udon.png' }],
  [MUSUBI, { costName: '江戸むすび', costIcon: '/musubi.png' }],
  [KAKI, { costName: '東干し柿', costIcon: '/kaki.png' }],
])
const item = (itemId: number, name: string, costItemId: number, costAmount: number, limitNum: number, qty = 1): EventShopItem => ({
  itemId,
  name,
  qty,
  costItemId,
  costAmount,
  limitNum,
  ...CURRENCY.get(costItemId),
})

const shop: EventShopItem[] = [
  item(9306300, '月より団子', UDON, 100, 2),
  item(9306300, '月より団子', MUSUBI, 100, 1),
  item(9306300, '月より団子', KAKI, 100, 1),
  item(6503, '巡霊の葉', UDON, 10, 25, 10),
  item(6503, '巡霊の葉', MUSUBI, 10, 25, 10),
  item(6503, '巡霊の葉', KAKI, 10, 25, 10),
  item(6999, '叡智の業火', KAKI, 5, 100),
  item(1, '10,000 QP', UDON, 2, 0, 10000),
]
const DANGO_KAKI = 2
const LEAF_UDON = 3
const LEAF_MUSUBI = 4
const LEAF_KAKI = 5
const FIRE = 6
const keys = shopItemKeys(shop)
const keyAt = (index: number) => keys.at(index) ?? ''

const event = (overrides: Partial<EventPlannerEvent> = {}): EventPlannerEvent => ({
  id: 80632,
  name: 'テストイベント',
  type: 'eventQuest',
  startedAt: 1000,
  endedAt: 2000,
  currency: { id: UDON, name: '武蔵うどん', icon: '' },
  unlimitedBoxes: false,
  lotteries: [],
  shop,
  farmingNodes: [],
  ...overrides,
})
const summary = { id: 80632, name: 'テストイベント', startedAt: 1000, endedAt: 2000 }
const savedKey = 'events/shopInputs/80632'
const saved = () =>
  JSON.parse(localStorage.getItem(savedKey) ?? '{}') as {
    counts?: Record<string, number>
    owned?: Record<string, number>
    bonus?: Record<string, number>
    remaining?: Record<string, number>
  }

type RemainingResult = ShopImportAnalysis['remaining'][number]
type OwnedResult = ShopImportAnalysis['owned'][number]
const source = { imageIndex: 0, rowIndex: 0 }
const matched = (shopIndex: number, value: number, extra: Partial<RemainingResult> = {}): RemainingResult => ({
  shopIndex,
  candidates: [shopIndex],
  values: [value],
  review: false,
  viaIcon: false,
  sources: [source],
  ...extra,
})
const leafReview = (value: number): RemainingResult => ({
  candidates: [LEAF_UDON, LEAF_MUSUBI, LEAF_KAKI],
  values: [value],
  review: true,
  reason: 'icon-review',
  viaIcon: true,
  sources: [source],
  rowCropUrl: 'data:image/png;base64,ROW',
})
const ownedOf = (costItemId: number | undefined, values: number[], review = false): OwnedResult => ({
  ...(costItemId === undefined ? {} : { costItemId, matchedCostItemId: costItemId }),
  values,
  review,
  sources: [{ imageIndex: 0, index: 0 }],
  iconCropUrl: 'data:image/png;base64,ICON',
})
const analysisOf = (overrides: Partial<ShopImportAnalysis>): ShopImportAnalysis => ({
  remaining: [],
  owned: [],
  failedIcons: [],
  ...overrides,
})

const image = (name: string) => new File(['x'], name, { type: 'image/png' })
const renderShop = (boxEvent = event()) =>
  render(<EventHubClient summary={summary} boxEvent={boxEvent} features={['shop']} />)
const openButton = () => screen.getByRole('button', { name: 'スクリーンショットから取り込む' })
const chooseFiles = (files: File[]) =>
  fireEvent.change(screen.getByTestId('shop-import-file-input'), { target: { files } })
/** 入口から画像を選んで読み取り、確かめの画面を出す。 */
const importWith = async (analysis: ShopImportAnalysis, files = [image('a.png')]) => {
  analyzeMock.fn.mockResolvedValue(analysis)
  fireEvent.click(openButton())
  chooseFiles(files)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '読み取る' }))
  })
  await screen.findByRole('button', { name: '取り込む' })
}
const confirm = () => fireEvent.click(screen.getByRole('button', { name: '取り込む' }))
/** 確かめの画面の残りの k 番目の行（無ければテストを落とす）。 */
const rowAt = (k: number): HTMLElement => {
  const row = screen.getAllByTestId('shop-import-remaining-row').at(k)
  if (!row) throw new Error(`remaining row ${k} not found`)
  return row
}

describe('スクリーンショットから取り込む', () => {
  beforeEach(() => {
    localStorage.clear()
    analyzeMock.fn.mockReset()
  })
  afterEach(() => localStorage.clear())

  describe('入口', () => {
    it('「全部交換」「優先素材」の並びにあり、文字の前に「残りをまとめて消す」と違うアイコンを持つ', () => {
      renderShop()
      const icon = openButton().querySelector('svg')
      const clearIcon = screen.getByRole('button', { name: '残りをまとめて消す' }).querySelector('svg')
      expect(icon).toHaveClass('lucide-image-up')
      expect(clearIcon).toHaveClass('lucide-eraser')
      expect(openButton().firstElementChild).toBe(icon)
      expect(screen.getByRole('button', { name: '全部交換' }).closest('div.flex-wrap')).toBe(
        openButton().closest('div.flex-wrap'),
      )
    })

    it('画像を選ぶまで読み取りを始めない', () => {
      renderShop()
      fireEvent.click(openButton())
      expect(analyzeMock.fn).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: '読み取る' })).toBeDisabled()
    })

    it('複数枚を選ぶ: 5枚の画像を読み取り、進み具合を出す', async () => {
      let finish: ((value: ShopImportAnalysis) => void) | undefined
      analyzeMock.fn.mockImplementation((_files: File[], _shop: unknown, onProgress: (done: number, total: number) => void) => {
        onProgress(2, 5)
        return new Promise<ShopImportAnalysis>(resolve => {
          finish = resolve
        })
      })
      renderShop()
      fireEvent.click(openButton())
      chooseFiles([1, 2, 3, 4, 5].map(n => image(`${n}.png`)))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '読み取る' }))
      })
      expect(await screen.findByText('読み取り中（2/5）')).toBeInTheDocument()
      const [files] = analyzeMock.fn.mock.calls[0] as [File[]]
      expect(files).toHaveLength(5)
      await act(async () => finish?.(analysisOf({ remaining: [matched(FIRE, 80)] })))
      expect(await screen.findByRole('button', { name: '取り込む' })).toBeInTheDocument()
    })

    it('画像でないファイル: PDF は読み取りから除き、除いたことを出し、4枚の画像は読み取る', async () => {
      renderShop()
      analyzeMock.fn.mockResolvedValue(analysisOf({}))
      fireEvent.click(openButton())
      chooseFiles([image('1.png'), image('2.png'), new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }), image('3.png'), image('4.png')])
      expect(screen.getByText('画像でないファイルを除きました: doc.pdf')).toBeInTheDocument()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '読み取る' }))
      })
      const [files] = analyzeMock.fn.mock.calls[0] as [File[]]
      expect(files.map(f => f.name)).toEqual(['1.png', '2.png', '3.png', '4.png'])
    })

    it('一覧だけの交換所（品目がすべてサーヴァント扱い）と、箱のあるイベントには入口を出さない', () => {
      const svtShop = shop.slice(0, 3).map(entry => ({ ...entry, kind: 'svt' as const }))
      const { unmount } = renderShop(event({ shop: svtShop }))
      expect(screen.queryByRole('button', { name: 'スクリーンショットから取り込む' })).not.toBeInTheDocument()
      unmount()

      render(
        <EventHubClient
          summary={summary}
          boxEvent={event({ lotteries: [{ boxIndex: 0, costPerBox: 100, contents: [], rareRewards: [] }] })}
          features={['box', 'shop']}
        />,
      )
      expect(screen.getByTestId('box-planner')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'スクリーンショットから取り込む' })).not.toBeInTheDocument()
    })
  })

  describe('取り込む前の確かめ', () => {
    it('当てはめた行を確定する: 叡智の業火の残りは 80 になり、交換回数・所持数・ボーナスは変わらない', async () => {
      localStorage.setItem(
        savedKey,
        JSON.stringify({ counts: { [keyAt(FIRE)]: 7 }, owned: { [KAKI]: 30 }, bonus: { [KAKI]: 2 } }),
      )
      renderShop()
      await importWith(analysisOf({ remaining: [matched(FIRE, 80)] }))
      const scope = within(rowAt(0))
      expect(scope.getByText('叡智の業火')).toBeInTheDocument()
      expect(scope.getByText('東干し柿')).toBeInTheDocument()
      expect(scope.getByText('上限 100')).toBeInTheDocument()
      expect(scope.getByText('読み取った残り 80')).toBeInTheDocument()
      expect(scope.getByText('今の残り なし')).toBeInTheDocument()
      confirm()
      expect(saved()).toMatchObject({
        counts: { [keyAt(FIRE)]: 7 },
        owned: { [KAKI]: 30 },
        bonus: { [KAKI]: 2 },
        remaining: { [keyAt(FIRE)]: 80 },
      })
      expect(screen.getByLabelText('叡智の業火 の交換回数')).toHaveValue(7)
      expect(screen.queryByRole('button', { name: '取り込む' })).not.toBeInTheDocument()
    })

    it('要確認の行を選んで入れる: 巡霊の葉の行に江戸むすびの巡霊の葉を選ぶと、その品目の残りが行の値になる', async () => {
      renderShop()
      await importWith(analysisOf({ remaining: [leafReview(12)] }))
      const row = rowAt(0)
      expect(within(row).getByText('要確認')).toBeInTheDocument()
      expect(within(row).getByRole('img', { name: '元の画像の行' })).toBeInTheDocument()
      const select = within(row).getByRole('combobox', { name: '取り込む品目' })
      expect(within(select).getAllByRole('option').map(o => o.textContent)).toEqual([
        '選ばない',
        '巡霊の葉（武蔵うどん）',
        '巡霊の葉（江戸むすび）',
        '巡霊の葉（東干し柿）',
      ])
      fireEvent.change(select, { target: { value: String(LEAF_MUSUBI) } })
      confirm()
      expect(saved().remaining).toEqual({ [keyAt(LEAF_MUSUBI)]: 12 })
    })

    it('要確認のまま確定する: 選ばなかった巡霊の葉の行は入らず、ほかの行だけが入る', async () => {
      renderShop()
      await importWith(analysisOf({ remaining: [leafReview(12), matched(FIRE, 80)] }))
      confirm()
      expect(saved().remaining).toEqual({ [keyAt(FIRE)]: 80 })
    })

    it('食い違った値を選んで入れる: 80 と 60 を出し、60 を選ぶと叡智の業火の残りは 60', async () => {
      renderShop()
      await importWith(
        analysisOf({
          remaining: [matched(FIRE, 80, { values: [80, 60], review: true, reason: 'conflict' })],
        }),
      )
      const row = rowAt(0)
      expect(within(row).getByRole('button', { name: '80' })).toBeInTheDocument()
      // 値を選ぶまでは値が決まっていないので入らない
      expect(within(row).getByLabelText('叡智の業火 の取り込む残り')).toHaveValue(null)
      fireEvent.click(within(row).getByRole('button', { name: '60' }))
      confirm()
      expect(saved().remaining).toEqual({ [keyAt(FIRE)]: 60 })
    })

    it('残りを読めなかった行は、値を入れるまで取り込みに入らない', async () => {
      const unread: RemainingResult = { ...matched(FIRE, 0), values: [], review: true, reason: 'no-remaining' }
      const { unmount } = renderShop()
      await importWith(analysisOf({ remaining: [unread] }))
      expect(within(rowAt(0)).getByText('残りを読めませんでした')).toBeInTheDocument()
      expect(within(rowAt(0)).getByLabelText('叡智の業火 の取り込む残り')).toHaveValue(null)
      confirm()
      expect(localStorage.getItem(savedKey)).toBeNull()
      unmount()

      renderShop()
      await importWith(analysisOf({ remaining: [unread] }))
      fireEvent.change(within(rowAt(0)).getByLabelText('叡智の業火 の取り込む残り'), { target: { value: '30' } })
      confirm()
      expect(saved().remaining).toEqual({ [keyAt(FIRE)]: 30 })
    })

    it('当てはめた行を外す: 外して確定すると叡智の業火の残りは変わらない', async () => {
      localStorage.setItem(savedKey, JSON.stringify({ remaining: { [keyAt(FIRE)]: 50 } }))
      renderShop()
      await importWith(analysisOf({ remaining: [matched(FIRE, 80)] }))
      expect(screen.getByText('今の残り 50')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('checkbox', { name: '叡智の業火 を取り込みに入れる' }))
      confirm()
      expect(saved().remaining).toEqual({ [keyAt(FIRE)]: 50 })
    })

    it('アイコンで当てた行の表示: アイコンで照合したことと、切り抜いたアイコンと東干し柿のアイコンを出す', async () => {
      renderShop()
      await importWith(
        analysisOf({
          remaining: [
            matched(DANGO_KAKI, 1, {
              candidates: [0, 1, DANGO_KAKI],
              viaIcon: true,
              iconCurrency: KAKI,
              iconCropUrl: 'data:image/png;base64,ICON',
            }),
          ],
        }),
      )
      const row = rowAt(0)
      expect(within(row).getByText('アイコンで照合')).toBeInTheDocument()
      expect(within(row).getByRole('img', { name: '画像から切り抜いたアイコン' })).toBeInTheDocument()
      expect(within(row).getByRole('img', { name: '東干し柿' })).toHaveAttribute('src', '/kaki.png')
    })

    it('同じ品目に2つの行を選ぶ: 確定できず、同じ品目に入ることを出す', async () => {
      renderShop()
      await importWith(analysisOf({ remaining: [leafReview(12), leafReview(8)] }))
      const [first, second] = [rowAt(0), rowAt(1)]
      fireEvent.change(within(first).getByRole('combobox', { name: '取り込む品目' }), {
        target: { value: String(LEAF_UDON) },
      })
      fireEvent.change(within(second).getByRole('combobox', { name: '取り込む品目' }), {
        target: { value: String(LEAF_UDON) },
      })
      expect(screen.getByRole('button', { name: '取り込む' })).toBeDisabled()
      expect(screen.getAllByText('ほかの行と同じ品目に入っています')).toHaveLength(2)
      expect(screen.getByText('2つ以上の行が同じ品目か同じ通貨に入っているため、確定できません')).toBeInTheDocument()
    })

    it('在庫上限を超える残りを入れると在庫上限になり、負の数は入らない', async () => {
      renderShop()
      await importWith(analysisOf({ remaining: [matched(LEAF_KAKI, 3), matched(FIRE, 80)] }))
      const [leafRow, fireRow] = [rowAt(0), rowAt(1)]
      fireEvent.change(within(leafRow).getByLabelText('巡霊の葉 の取り込む残り'), { target: { value: '40' } })
      fireEvent.change(within(fireRow).getByLabelText('叡智の業火 の取り込む残り'), { target: { value: '-1' } })
      confirm()
      expect(saved().remaining).toEqual({ [keyAt(LEAF_KAKI)]: 25 })
    })

    it('当てた所持数を確定する: 武蔵うどんは 469 になり、取り込みに入れていない通貨の所持数は変わらない', async () => {
      localStorage.setItem(savedKey, JSON.stringify({ owned: { [MUSUBI]: 100 } }))
      renderShop()
      await importWith(analysisOf({ owned: [ownedOf(UDON, [469])] }))
      const row = screen.getByTestId('shop-import-owned-row')
      expect(within(row).getByRole('img', { name: '画像から切り抜いたアイコン' })).toBeInTheDocument()
      expect(within(row).getByRole('img', { name: '武蔵うどん' })).toHaveAttribute('src', '/udon.png')
      confirm()
      expect(saved().owned).toEqual({ [MUSUBI]: 100, [UDON]: 469 })
      expect(screen.getByLabelText('武蔵うどん の所持数')).toHaveValue(469)
      expect(screen.getByLabelText('江戸むすび の所持数')).toHaveValue(100)
    })

    it('要確認の所持数を選んで入れる: 288 に江戸むすびを選ぶと江戸むすびの所持数は 288', async () => {
      renderShop()
      await importWith(analysisOf({ owned: [ownedOf(undefined, [288], true)] }))
      const row = screen.getByTestId('shop-import-owned-row')
      expect(within(row).getByText('要確認')).toBeInTheDocument()
      fireEvent.change(within(row).getByRole('combobox', { name: '取り込む通貨' }), {
        target: { value: String(MUSUBI) },
      })
      confirm()
      expect(saved().owned).toEqual({ [MUSUBI]: 288 })
    })

    it('アイコンを読み込めない: 読み込めなかったことを出す', async () => {
      renderShop()
      await importWith(analysisOf({ remaining: [matched(FIRE, 80), leafReview(3)], failedIcons: [KAKI] }))
      expect(
        screen.getByText('東干し柿 のアイコンを読み込めなかったため、アイコンで見分ける行と所持数を要確認にしました'),
      ).toBeInTheDocument()
    })

    it('閉じる: 確定せずに閉じると、どの品目の残りも通貨の所持数も変わらない', async () => {
      renderShop()
      await importWith(analysisOf({ remaining: [matched(FIRE, 80)], owned: [ownedOf(UDON, [469])] }))
      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
      expect(localStorage.getItem(savedKey)).toBeNull()
      expect(screen.getByLabelText('武蔵うどん の所持数')).toHaveValue(0)
    })
  })
})

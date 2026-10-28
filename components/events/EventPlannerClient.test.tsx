// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EventPlannerClient } from './EventPlannerClient'
import { EventPlanResultCard } from './EventPlanResultCard'
import type { EventPlannerEvent } from '../../lib/master-data/types'
import { allocateShop, calcBoxLayer, runEventSolver } from '../../lib/event-plan'
import { computeApBudget } from '../../lib/ap-budget'

vi.mock('react-i18next', async () => (await import('./events-i18n-test-utils')).eventsTranslationMock())

// 1箱 250 通貨、1周 AP40 で 10 個落ちる → 25 周・AP 1,000。
const boxEvent: EventPlannerEvent = {
  id: 80001,
  name: 'テストイベント',
  type: 'eventQuest',
  startedAt: 1000,
  endedAt: 2000,
  currency: { id: 94001, name: '武蔵うどん', icon: '' },
  unlimitedBoxes: false,
  lotteries: [{ boxIndex: 0, costPerBox: 250, contents: [], rareRewards: [] }],
  shop: [],
  farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }],
}

const breakdownOf = () => screen.getByText('AP予算内訳').closest('div.flex-col') as HTMLElement

const renderCard = (needCurrency: number) => {
  const boxLayer = calcBoxLayer(boxEvent, 1, 250 - needCurrency, 0)
  const solverResult = needCurrency > 0 ? runEventSolver(boxEvent, boxLayer.remainingCurrency, new Map()) : null
  const apBudget = computeApBudget(solverResult?.result.total_ap ?? 0, 144, 3)
  render(
    <EventPlanResultCard
      event={boxEvent}
      boxLayer={boxLayer}
      shopAllocation={allocateShop([], new Map())}
      solverResult={solverResult}
      apBudget={apBudget}
      dropSource="atlas"
    />,
  )
}

describe('箱計画の AP 予算', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('内訳は交換所と同じく回復の回数・黄金の果実・必要聖晶石・課金額目安の4項目を出す #167', () => {
    renderCard(250)

    const breakdown = breakdownOf()
    expect(screen.getByText('最大AP 144 基準')).toBeInTheDocument()
    expect(within(breakdown).getByText('黄金の果実')).toBeInTheDocument()
    expect(within(breakdown).getByText('3')).toBeInTheDocument()
    expect(within(breakdown).getByText('所持 3')).toBeInTheDocument()
    expect(within(breakdown).getByText('必要聖晶石')).toBeInTheDocument()
    expect(within(breakdown).getByText('4')).toBeInTheDocument()
    expect(within(breakdown).getByText('課金額目安')).toBeInTheDocument()
    expect(within(breakdown).getByText('¥238')).toBeInTheDocument()
    expect(within(breakdown).getByText('回復の回数').nextElementSibling?.textContent).toBe('7')
    expect(breakdown.querySelector('.grid')?.children).toHaveLength(4)
  })

  it('合計 AP が 0 のときは内訳が出ない', () => {
    renderCard(0)

    expect(screen.queryByText('AP予算内訳')).not.toBeInTheDocument()
    expect(screen.queryByText(/^最大AP .* 基準$/)).not.toBeInTheDocument()
  })

  it('箱計画の画面にマスターレベルと所持黄金の果実の入力欄があり、保存先の値で内訳を出す', async () => {
    localStorage.setItem('masterLevel', '157')
    localStorage.setItem('events/goldenFruit', '3')
    render(<EventPlannerClient event={boxEvent} />)

    expect(await screen.findByText('最大AP 144')).toBeInTheDocument()
    expect(screen.getByText('マスターレベル')).toBeInTheDocument()
    expect(screen.getByDisplayValue('157')).toBeInTheDocument()
    expect(screen.getByText('所持 黄金の果実')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()

    expect(screen.getByText('最大AP 144 基準')).toBeInTheDocument()
    const breakdown = breakdownOf()
    expect(within(breakdown).getByText('所持 3')).toBeInTheDocument()
    expect(within(breakdown).getByText('¥238')).toBeInTheDocument()
    expect(within(breakdown).getByText('回復の回数')).toBeInTheDocument()
  })

  it('箱計画の画面で所持黄金の果実を変えると、内訳がその値に追いつく', async () => {
    localStorage.setItem('masterLevel', '157')
    localStorage.setItem('events/goldenFruit', '3')
    render(<EventPlannerClient event={boxEvent} />)
    await screen.findByText('最大AP 144')

    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '5' } })

    const breakdown = breakdownOf()
    expect(await within(breakdown).findByText('所持 5')).toBeInTheDocument()
    expect(within(breakdown).getByText('¥119')).toBeInTheDocument()
  })
})

// 1箱 300 通貨。箱の通貨を落とすクエストは1つ（素の 10.0・回数 5.0、AP40）。交換所の対価の通貨は別に2種。
const bonusEvent: EventPlannerEvent = {
  ...boxEvent,
  lotteries: [{ boxIndex: 0, costPerBox: 300, contents: [{ itemId: 6501, num: 5, name: '英雄の証' }], rareRewards: [] }],
  shop: [
    { itemId: 6502, qty: 1, costItemId: 94002, costAmount: 10, limitNum: 5, name: '虚影の塵', costName: '金の団子' },
    { itemId: 6503, qty: 1, costItemId: 94003, costAmount: 10, limitNum: 5, name: '竜の牙', costName: '銀の団子' },
  ],
  farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10, countPerRun: 5 }] }],
}

const bonusLabel = (name: string) => `${name} のドロップボーナス`
const bonusInputOf = (name: string) => screen.queryByLabelText<HTMLInputElement>(bonusLabel(name))
const setBonus = (value: string) =>
  fireEvent.change(screen.getByLabelText(bonusLabel('武蔵うどん')), { target: { value } })

describe('箱計画のドロップ増加礼装のボーナス', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('箱を開ける通貨の初期値 0 の欄だけを、見出しと周回数と AP の説明とともに出す', () => {
    render(<EventPlannerClient event={bonusEvent} />)

    expect(screen.getByText('ドロップ増加礼装')).toBeInTheDocument()
    expect(
      screen.getByText('編成した礼装の 1ドロップにつき +N を入れると、周回数と AP がボーナス込みになります'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/1周の獲得量/)).not.toBeInTheDocument()
    expect(bonusInputOf('武蔵うどん')?.value).toBe('0')
    expect(bonusInputOf('金の団子')).toBeNull()
    expect(bonusInputOf('銀の団子')).toBeNull()
    expect(screen.getAllByLabelText(/のドロップボーナス$/)).toHaveLength(1)
  })

  it('ボーナスを入れると周回数と合計 AP がボーナス込みになり、注記が出る', () => {
    render(<EventPlannerClient event={bonusEvent} />)
    expect(screen.getByText('30 周 / 1,200 AP')).toBeInTheDocument()

    setBonus('2')

    expect(screen.getByText('15 周 / 600 AP')).toBeInTheDocument()
    expect(screen.getByText('入れたドロップ増加礼装のボーナス（1ドロップにつき +N）を足して計算しています。')).toBeInTheDocument()
  })

  it('すべてのボーナスが 0 のときは素の周回数と合計 AP のままで、注記が出ない', () => {
    render(<EventPlannerClient event={bonusEvent} />)
    setBonus('2')
    setBonus('0')

    expect(runEventSolver(bonusEvent, 300, new Map()).result.total_ap).toBe(1200)
    expect(screen.getByText('30 周 / 1,200 AP')).toBeInTheDocument()
    expect(screen.queryByText(/を足して計算しています/)).not.toBeInTheDocument()
  })

  it('入力モードを欲しいアイテムへ切り替えても、ボーナスの値と計算が保たれる', () => {
    render(<EventPlannerClient event={bonusEvent} />)
    setBonus('2')

    fireEvent.click(screen.getByText('欲しい素材で指定'))
    const row = screen
      .getAllByText('英雄の証')
      .map(el => el.closest('div.justify-between'))
      .find(el => el?.querySelector('input')) as HTMLElement
    fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '5' } })

    expect(bonusInputOf('武蔵うどん')?.value).toBe('2')
    expect(screen.getByText('15 周 / 600 AP')).toBeInTheDocument()
  })

  it('回数を持たないドロップだけのイベントでは、反映できない旨を出し、素の周回数のままにする', () => {
    const legacy: EventPlannerEvent = {
      ...bonusEvent,
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [{ itemId: 94001, perRun: 10 }] }],
    }
    render(<EventPlannerClient event={legacy} />)
    setBonus('2')

    expect(screen.getByText('武蔵うどん はデータの更新前のため、ボーナスを反映できません。')).toBeInTheDocument()
    expect(screen.getByText('30 周 / 1,200 AP')).toBeInTheDocument()
  })

  it('ドロップの統計が無いイベントではボーナスの欄を出さない', () => {
    const noDrops: EventPlannerEvent = {
      ...bonusEvent,
      farmingNodes: [{ questId: 1, name: '上級', ap: 40, drops: [] }],
    }
    render(<EventPlannerClient event={noDrops} />)

    expect(screen.queryByText('ドロップ増加礼装')).not.toBeInTheDocument()
    expect(bonusInputOf('武蔵うどん')).toBeNull()
  })

  it('-3 と 2.5 はそれぞれ 0 と 2 として扱う', () => {
    render(<EventPlannerClient event={bonusEvent} />)

    setBonus('-3')
    expect(bonusInputOf('武蔵うどん')?.value).toBe('0')
    expect(screen.getByText('30 周 / 1,200 AP')).toBeInTheDocument()

    setBonus('2.5')
    expect(bonusInputOf('武蔵うどん')?.value).toBe('2')
    expect(screen.getByText('15 周 / 600 AP')).toBeInTheDocument()
  })
})

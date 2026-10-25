// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ja from '../../locales/ja.json'
import { EventPlannerClient } from './EventPlannerClient'
import { EventPlanResultCard } from './EventPlanResultCard'
import type { EventPlannerEvent } from '../../lib/master-data/types'
import { allocateShop, calcBoxLayer, runEventSolver } from '../../lib/event-plan'
import { computeApBudget } from '../../lib/ap-budget'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const translated: unknown = Reflect.get(ja.events, key)
      const untranslated = typeof fallback === 'string' ? fallback : key
      const template = typeof translated === 'string' ? translated : untranslated
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

  it('内訳は黄金の果実消費・必要聖晶石・課金額目安の3項目で、回復の回数は出ない', () => {
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
    expect(breakdown.querySelector('.grid')?.children).toHaveLength(3)
    expect(screen.queryByText('回復の回数')).not.toBeInTheDocument()
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
    expect(breakdown.querySelector('.grid')?.children).toHaveLength(3)
    expect(screen.queryByText('回復の回数')).not.toBeInTheDocument()
  })
})

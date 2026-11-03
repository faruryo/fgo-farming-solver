// @vitest-environment jsdom
import React, { useLayoutEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { EventShopList } from './EventShopList'
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
  expect(within(root).queryByText(/育成対象を設定すると/)).toBeNull()
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

  it('保存値の無いイベントを開いて読み終えると欄は 0 で、端末に書き込まない', () => {
    const event = shopEvent(80700)
    render(<EventShopList event={event} />)

    expect(screen.getByLabelText('素材1 の交換回数')).toHaveValue(0)
    expect(screen.getByLabelText('武蔵うどん の所持数')).toHaveValue(0)
    expect(screen.getByLabelText('武蔵うどん のドロップボーナス')).toHaveValue(0)
    expect(localStorage.getItem(savedKey(80700))).toBeNull()
  })

  it('育成計画の保存値を読む前は「育成対象を設定すると…」の案内を出さず、読み込み中にする', () => {
    const event = shopEvent()
    mocks.roster = { status: 'unread' }
    const { container, unmount } = render(<EventShopList event={event} />)

    expectLoadingView(container)
    unmount()

    // 保存値の無い端末で育成計画を読み終えたら、未設定の案内を出す。
    mocks.roster = undefined
    render(<EventShopList event={event} />)
    expect(screen.getByText('育成対象を設定すると、足りている品目と要る分が分かります。')).toBeInTheDocument()
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

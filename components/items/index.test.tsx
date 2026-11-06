// @vitest-environment jsdom
import React, { useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Index } from './index'
import { EventShopList } from '../events/EventShopList'
import type { Item } from '../../interfaces/fgodrop'
import type { Localized } from '../../lib/get-local-items'
import type { EventPlannerEvent } from '../../lib/master-data/types'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'

vi.mock('react-i18next', async () => (await import('../i18n-test-utils')).translationMock())

const item = (id: string, name: string, atlasId?: number): Localized<Item> => ({
  id,
  name,
  category: '銅素材',
  largeCategory: '強化素材',
  shortName: name,
  ...(atlasId !== undefined ? { atlasId } : {}),
})

const items = [item('101', '凶骨', 6503), item('102', '伝承結晶', 6999), item('900', '番号の無い品目')]

const toggleOf = (name: string) => screen.getByRole('radiogroup', { name: `${name} は欲しいか` })
const storedWant = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS) ?? 'null') as unknown

/** 最初のクライアント描画（保存値を読む effect の前）の DOM を写し取る。 */
const FirstCommitProbe: React.FC<{ onCommit: (html: string) => void }> = ({ onCommit }) => {
  useLayoutEffect(() => {
    onCommit(document.body.innerHTML)
  }, [onCommit])
  return null
}

describe('アイテム一覧の欲しい・いらない', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('番号の分かる各行に切り替えが出て、未設定は「欲しい」。番号の無い行には出ず、リンクはそのまま', () => {
    render(<Index items={items} />)

    expect(within(toggleOf('凶骨')).getByRole('radio', { name: '欲しい' })).toBeChecked()
    expect(within(toggleOf('凶骨')).getByRole('radio', { name: 'いらない' })).not.toBeChecked()
    expect(within(toggleOf('伝承結晶')).getByRole('radio', { name: '欲しい' })).toBeChecked()
    expect(screen.queryByRole('radiogroup', { name: '番号の無い品目 は欲しいか' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '番号の無い品目' })).toHaveAttribute('href', '/items/900')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2)
    // 開いただけでは書き込まない。
    expect(localStorage.getItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS)).toBeNull()
  })

  it('「いらない」を押すとその番号が false で保存され、切り替えはリンクの外にあって詳細へ移らない', () => {
    const { unmount } = render(<Index items={items} />)
    const link = screen.getByRole('link', { name: '凶骨' })
    const unwanted = within(toggleOf('凶骨')).getByRole('radio', { name: 'いらない' })
    expect(link).not.toContainElement(unwanted)
    expect(unwanted.closest('a')).toBeNull()

    // 既定の動作を止めない押下でも、リンクの外なので詳細へは移らない。
    expect(fireEvent.click(unwanted)).toBe(true)
    expect(window.location.pathname).toBe('/')

    expect(within(toggleOf('凶骨')).getByRole('radio', { name: 'いらない' })).toBeChecked()
    expect(storedWant()).toEqual({ 6503: false })
    unmount()

    render(<Index items={items} />)
    expect(within(toggleOf('凶骨')).getByRole('radio', { name: 'いらない' })).toBeChecked()
    fireEvent.click(within(toggleOf('凶骨')).getByRole('radio', { name: '欲しい' }))
    expect(storedWant()).toEqual({ 6503: true })
  })

  it('「いらない」を保存した状態で開くと、読み込み前に「欲しい」と表示しない', () => {
    localStorage.setItem(STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS, JSON.stringify({ 6503: false }))
    let firstCommit = ''
    const onCommit = (html: string) => {
      firstCommit ||= html
    }
    render(
      <>
        <Index items={items} />
        <FirstCommitProbe onCommit={onCommit} />
      </>,
    )
    const first = document.createElement('div')
    first.innerHTML = firstCommit
    expect(first.querySelector('a[href="/items/101"]')).not.toBeNull()
    expect(first.querySelector('[role="radio"][aria-checked="true"]')).toBeNull()

    expect(within(toggleOf('凶骨')).getByRole('radio', { name: 'いらない' })).toBeChecked()
  })

  it('アイテム一覧で「いらない」にした品目は、同じ端末で開いた交換所で「いらない品目」に畳まれる', () => {
    const shopEvent: EventPlannerEvent = {
      id: 80632,
      name: 'テストイベント',
      type: 'eventQuest',
      startedAt: 1000,
      endedAt: 2000,
      currency: { id: 94001, name: '武蔵うどん', icon: '' },
      unlimitedBoxes: false,
      lotteries: [],
      shop: [
        { itemId: 6999, qty: 1, costItemId: 94001, costAmount: 200, limitNum: 2, name: '伝承結晶', costName: '武蔵うどん' },
        { itemId: 4001, qty: 1, costItemId: 94001, costAmount: 20, limitNum: 10, name: '呼符', costName: '武蔵うどん' },
      ],
      farmingNodes: [],
    }
    const { unmount } = render(<Index items={items} />)
    fireEvent.click(within(toggleOf('伝承結晶')).getByRole('radio', { name: 'いらない' }))
    unmount()

    render(<EventShopList event={shopEvent} />)
    expect(screen.queryByLabelText('伝承結晶 の交換回数')).not.toBeInTheDocument()
    expect(screen.getByLabelText('呼符 の交換回数')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /いらない品目 1 件/ }))
    expect(within(screen.getByTestId('shop-unwanted-items')).getByRole('button', { name: '伝承結晶' })).toBeInTheDocument()
  })
})

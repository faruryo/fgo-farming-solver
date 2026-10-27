// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ApBudgetBreakdown, ApBudgetInputs } from './ApBudget'
import { computeApBudget } from '../../lib/ap-budget'

vi.mock('react-i18next', async () => (await import('./events-i18n-test-utils')).eventsTranslationMock())

describe('ApBudgetInputs', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('マスターレベルと黄金の果実の入力が保存先の値を変える', () => {
    render(<ApBudgetInputs />)

    fireEvent.change(screen.getByLabelText('マスターレベル'), { target: { value: '157' } })
    fireEvent.change(screen.getByLabelText('所持 黄金の果実'), { target: { value: '5' } })

    expect(localStorage.getItem('masterLevel')).toBe('157')
    expect(localStorage.getItem('events/goldenFruit')).toBe('5')
    expect(screen.getByText('最大AP 144')).toBeInTheDocument()
  })

  it('片方の入力欄で変えた所持数が、もう片方の入力欄にも同じ値で出る', () => {
    render(
      <>
        <div data-testid="a"><ApBudgetInputs /></div>
        <div data-testid="b"><ApBudgetInputs /></div>
      </>,
    )
    const a = within(screen.getByTestId('a'))
    const b = within(screen.getByTestId('b'))

    fireEvent.change(a.getByLabelText('所持 黄金の果実'), { target: { value: '5' } })
    expect(b.getByLabelText('所持 黄金の果実')).toHaveValue(5)

    fireEvent.change(b.getByLabelText('マスターレベル'), { target: { value: '157' } })
    expect(a.getByLabelText('マスターレベル')).toHaveValue(157)
  })

  it('アンマウントして描画し直しても、保存した値が出る', async () => {
    const { unmount } = render(<ApBudgetInputs />)
    fireEvent.change(screen.getByLabelText('所持 黄金の果実'), { target: { value: '5' } })
    unmount()

    render(<ApBudgetInputs />)
    expect(await screen.findByDisplayValue('5')).toBe(screen.getByLabelText('所持 黄金の果実'))
  })
})

describe('ApBudgetBreakdown', () => {
  const budget = computeApBudget(1000, 144, 3)

  it('computeApBudget の結果どおりに回復の回数・黄金の果実・聖晶石・課金額を出す', () => {
    render(<ApBudgetBreakdown apBudget={budget} showRestores />)

    expect(budget).toMatchObject({ totalRestores: 7, goldenFruitUsed: 3, quartzCount: 4, yen: 238 })
    const value = (label: string) => screen.getByText(label).nextElementSibling?.textContent
    expect(value('回復の回数')).toBe('7')
    expect(value('黄金の果実')).toBe('3')
    expect(screen.getByText('所持 3')).toBeInTheDocument()
    expect(value('必要聖晶石')).toBe('4')
    expect(value('課金額目安')).toBe('¥238')
  })

  it('回復の回数を出さない指定では3項目だけを出す', () => {
    render(<ApBudgetBreakdown apBudget={budget} />)

    expect(screen.queryByText('回復の回数')).not.toBeInTheDocument()
    expect(screen.getByText('黄金の果実').closest('.grid')?.children).toHaveLength(3)
  })
})

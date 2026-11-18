// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServantLevelDialog } from './servant-level-dialog'
import type { ServantLevel } from '../../lib/servant-levels'

vi.mock('react-i18next', async () => (await import('../i18n-test-utils')).translationMock())

const servant = { id: 100100, name: 'サーヴァントA' }

const renderDialog = (level: ServantLevel | undefined) => {
  const onSave = vi.fn()
  const onOpenChange = vi.fn()
  const onMarkUnowned = vi.fn()
  const utils = render(
    <ServantLevelDialog
      open
      servant={servant}
      level={level}
      onOpenChange={onOpenChange}
      onSave={onSave}
      onMarkUnowned={onMarkUnowned}
    />,
  )
  return { onSave, onOpenChange, onMarkUnowned, ...utils }
}

const lvInput = () => screen.getByLabelText('Lv')
const npLvInput = () => screen.getByLabelText('宝具Lv')
const saveButton = () => screen.getByRole('button', { name: '保存' })

describe('ServantLevelDialog', () => {
  it('開いたときの欄の初めの値: 保存されている値を入れ、見出しにサーヴァント名を出す', async () => {
    renderDialog({ lv: 90, npLv: 2 })
    expect(await screen.findByRole('dialog', { name: 'サーヴァントA' })).toBeInTheDocument()
    expect(lvInput()).toHaveValue('90')
    expect(npLvInput()).toHaveValue('2')
    expect(screen.getByText('空にして保存すると消えます')).toBeInTheDocument()
  })

  it('値の無い欄は空にする', async () => {
    renderDialog({ lv: 100 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    expect(lvInput()).toHaveValue('100')
    expect(npLvInput()).toHaveValue('')
  })

  it('開いたときは Lv の欄にフォーカスがある', async () => {
    renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
  })

  it('× ボタンを出さない: ボタンは未所持に戻す・キャンセル・保存だけ', async () => {
    renderDialog(undefined)
    const dialog = await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect([...dialog.querySelectorAll('button')].map(b => b.textContent)).toEqual(['未所持に戻す', 'キャンセル', '保存'])
  })

  it('「未所持に戻す」を押すと未所持の通知が1回出て、保存の通知は出ずに閉じる', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange, onMarkUnowned } = renderDialog({ lv: 90, npLv: 2 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.click(screen.getByRole('button', { name: '未所持に戻す' }))
    expect(onMarkUnowned).toHaveBeenCalledTimes(1)
    expect(onMarkUnowned).toHaveBeenCalledWith(100100)
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it.each([['100'], ['121']])('書きかけの Lv（%s）があっても「未所持に戻す」では保存しない', async raw => {
    const user = userEvent.setup()
    const { onSave, onMarkUnowned } = renderDialog({ lv: 90 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(lvInput())
    await user.type(lvInput(), raw)
    await user.click(screen.getByRole('button', { name: '未所持に戻す' }))
    expect(onMarkUnowned).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('保存で setter を欄のとおりの値で1回呼び、閉じる', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ lv: 90, npLv: 2 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(lvInput())
    await user.type(lvInput(), '100')
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(100100, { lv: 100, npLv: 2 })
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('Enter で保存する', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.keyboard('80')
    await user.click(npLvInput())
    await user.keyboard('1{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(100100, { lv: 80, npLv: 1 })
  })

  it('空の欄は null で渡る', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog({ lv: 90, npLv: 2 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(npLvInput())
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(100100, { lv: 90, npLv: null })

    onSave.mockClear()
    await user.clear(lvInput())
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(100100, { lv: null, npLv: null })
  })

  it('レア度や聖杯の刻みで弾かない: 途中の Lv 73 も通す', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.type(lvInput(), '73')
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(100100, { lv: 73, npLv: null })
  })

  it.each([
    ['Lv', '121'],
    ['Lv', '0'],
    ['Lv', '1.5'],
    ['宝具Lv', '6'],
  ])('範囲に無い値（%s に %s）: その欄に aria-invalid を付けて保存できない', async (label, raw) => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ lv: 90, npLv: 2 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    const input = screen.getByLabelText(label)
    const other = label === 'Lv' ? npLvInput() : lvInput()
    await user.clear(input)
    await user.type(input, raw)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(other).not.toHaveAttribute('aria-invalid')
    expect(saveButton()).toBeDisabled()
    await user.click(saveButton())
    await user.type(input, '{Enter}')
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('欄は数字のキーボードが出る文字の欄', async () => {
    renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    expect(lvInput()).toHaveAttribute('inputmode', 'numeric')
    expect(npLvInput()).toHaveAttribute('inputmode', 'numeric')
    expect(lvInput()).toHaveAttribute('type', 'text')
  })

  it('全角の数字を打つと半角の数として保存する', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.type(lvInput(), '９０')
    expect(lvInput()).not.toHaveAttribute('aria-invalid')
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(100100, { lv: 90, npLv: null })
  })

  it('全角の数字を貼ると半角の数として保存する', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.paste('９０')
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(100100, { lv: 90, npLv: null })
  })

  it('値 90 の欄に「Lv 90」を貼っても 90 のまま', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ lv: 90 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.paste('Lv 90')
    expect(lvInput()).toHaveValue('90')
    await user.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('値 90 の欄で英字を打っても 90 のまま', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog({ lv: 90 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.type(lvInput(), 'lv')
    expect(lvInput()).toHaveValue('90')
    await user.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('値 90 の欄で Home・End・上下の矢印を押しても 90 のまま（min/max に寄せない）', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog({ lv: 90 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.keyboard('{Home}{End}{ArrowUp}{ArrowDown}')
    expect(lvInput()).toHaveValue('90')
    await user.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('値 90 の欄で「九」を確定すると範囲に無い値になり、保存できない', async () => {
    const { onSave } = renderDialog({ lv: 90 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    fireEvent.change(lvInput(), { target: { value: '90九' } })
    expect(lvInput()).toHaveAttribute('aria-invalid', 'true')
    expect(saveButton()).toBeDisabled()
    fireEvent.submit(saveButton())
    expect(onSave).not.toHaveBeenCalled()
  })

  it.each([
    ['Lv', '121'],
    ['Lv', '0'],
    ['宝具Lv', '6'],
  ])('範囲に無い値は丸めない（%s に %s を打って Enter）: 欄はそのまま', async (label, raw) => {
    const user = userEvent.setup()
    const { onSave } = renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    const input = screen.getByLabelText(label)
    await user.click(input)
    await user.keyboard(`${raw}{Enter}`)
    expect(input).toHaveValue(raw)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('値が同じなら setter を呼ばずに閉じる', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ lv: 90, npLv: 2 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('保存値が無いまま両方を空で保存しても setter を呼ばない', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog(undefined)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.click(saveButton())
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('キャンセルで setter を呼ばずに閉じる', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ lv: 90 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(lvInput())
    await user.type(lvInput(), '100')
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('Escape で setter を呼ばずに閉じる', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ lv: 90 })
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(lvInput())
    await user.type(lvInput(), '100')
    await user.keyboard('{Escape}')
    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('開いている間に保存値が変わっても、欄は開いたときのまま', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const props = { open: true, servant, onOpenChange: vi.fn(), onSave }
    const { rerender } = render(<ServantLevelDialog {...props} level={{ lv: 90 }} />)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(lvInput())
    await user.type(lvInput(), '95')
    rerender(<ServantLevelDialog {...props} level={{ lv: 110, npLv: 3 }} />)
    expect(lvInput()).toHaveValue('95')
    expect(npLvInput()).toHaveValue('')
    await user.click(saveButton())
    expect(onSave).toHaveBeenCalledWith(100100, { lv: 95, npLv: null })
  })

  it('開き直すとその時の保存値で欄を始める', async () => {
    const user = userEvent.setup()
    const props = { servant, onOpenChange: vi.fn(), onSave: vi.fn() }
    const { rerender } = render(<ServantLevelDialog {...props} open level={{ lv: 90 }} />)
    await waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(lvInput())
    await user.type(lvInput(), '95')
    rerender(<ServantLevelDialog {...props} open={false} level={{ lv: 90 }} />)
    rerender(<ServantLevelDialog {...props} open level={{ lv: 100 }} />)
    await waitFor(() => expect(lvInput()).toHaveValue('100'))
  })
})

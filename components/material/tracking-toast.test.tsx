// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  TrackingToast,
  BlockedToast,
  TrackingToastItem,
  BlockedToastItem,
} from './tracking-toast'

const trackingItems: TrackingToastItem[] = [
  { itemId: '100', name: '灯火の焔', icon: 'Item100', amount: 8 },
  { itemId: '1', name: 'QP', icon: undefined, amount: 100000 },
]

describe('TrackingToast', () => {
  it('renders a 消費 (consume) label, title, and each item with its amount', () => {
    render(
      <TrackingToast
        title="サーヴァントA 再臨 1→2"
        direction="consume"
        items={trackingItems}
      />
    )

    expect(screen.getByText('消費')).toBeInTheDocument()
    expect(screen.getByText('サーヴァントA 再臨 1→2')).toBeInTheDocument()
    expect(screen.getByText('灯火の焔')).toBeInTheDocument()
    expect(screen.getByText('×8')).toBeInTheDocument()
    expect(screen.getByText('QP')).toBeInTheDocument()
    expect(screen.getByText('×100000')).toBeInTheDocument()
  })

  it('renders a 返還 (return) label for the return direction', () => {
    render(
      <TrackingToast
        title="サーヴァントA 再臨 2→1"
        direction="return"
        items={trackingItems}
      />
    )

    expect(screen.getByText('返還')).toBeInTheDocument()
    expect(screen.queryByText('消費')).not.toBeInTheDocument()
  })

  it('invokes onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <TrackingToast
        title="t"
        direction="consume"
        items={trackingItems}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole('button', { name: '閉じる' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('omits the close button when onClose is not provided', () => {
    render(<TrackingToast title="t" direction="consume" items={trackingItems} />)
    expect(screen.queryByRole('button', { name: '閉じる' })).not.toBeInTheDocument()
  })
})

const shortageItems: BlockedToastItem[] = [
  { itemId: '100', name: '灯火の焔', icon: 'Item100', owned: 1, required: 4 },
  { itemId: '200', name: '蛮神の心臓', icon: 'Item200', owned: 0, required: 1 },
]

describe('BlockedToast', () => {
  it('shows an inline "消費前の所持数" input pre-filled with the current owned amount for each shortage item', () => {
    render(
      <BlockedToast
        title="サーヴァントA 再臨 1→2"
        items={shortageItems}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('材料不足')).toBeInTheDocument()
    const inputs = screen.getAllByPlaceholderText('所持数') as HTMLInputElement[]
    expect(inputs).toHaveLength(2)
    expect(inputs[0].value).toBe('1')
    expect(inputs[1].value).toBe('0')
    expect(screen.getByText('必要 4')).toBeInTheDocument()
    expect(screen.getByText('必要 1')).toBeInTheDocument()
  })

  it('calls onConfirm with possession[itemId] = max(0, V) for each edited field and shows the ✓ confirmation state', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <BlockedToast
        title="t"
        items={shortageItems}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    )

    const inputs = screen.getAllByPlaceholderText('所持数')
    await user.clear(inputs[0])
    await user.type(inputs[0], '10')

    await user.click(screen.getByRole('button', { name: '所持数を更新する' }))

    expect(onConfirm).toHaveBeenCalledWith({ '100': 10, '200': 0 })
    expect(
      screen.getByText('✓ 更新しました。もう一度クリックしてください。')
    ).toBeInTheDocument()
  })

  it('clamps a negative or non-numeric input to 0 on confirm', async () => {
    const onConfirm = vi.fn()
    render(
      <BlockedToast
        title="t"
        items={[shortageItems[0]]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    )

    const [input] = screen.getAllByPlaceholderText('所持数')
    fireEvent.change(input, { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: '所持数を更新する' }))

    expect(onConfirm).toHaveBeenCalledWith({ '100': 0 })
  })

  it('invokes onClose when cancel is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <BlockedToast
        title="t"
        items={shortageItems}
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

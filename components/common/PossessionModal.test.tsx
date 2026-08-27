// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PossessionModal, type PossessionItemLike } from './PossessionModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('./StockTargetSettings', () => ({
  StockTargetSettings: () => <div data-testid="stock-target-settings">StockTargetSettings</div>,
}))

vi.mock('./possession-import/PossessionImportDialog', () => ({
  PossessionImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog">PossessionImportDialog</div> : null,
}))

const mockItems: PossessionItemLike[] = [
  { id: 'item-1', name: '竜の牙', category: '銅素材', atlasId: 6501 },
  { id: 'item-2', name: '虚影の塵', category: '銅素材', atlasId: 6502 },
  { id: 'item-3', name: '英雄の証', category: '銀素材', atlasId: 6503 },
]

describe('PossessionModal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders modal content when open is true', () => {
    const onOpenChange = vi.fn()
    render(
      <PossessionModal
        items={mockItems}
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    expect(screen.getByText('所持数を登録')).toBeInTheDocument()
    expect(screen.getByText('銅素材')).toBeInTheDocument()
    expect(screen.getByText('銀素材')).toBeInTheDocument()
    expect(screen.getByText('竜の牙')).toBeInTheDocument()
    expect(screen.getByText('虚影の塵')).toBeInTheDocument()
    expect(screen.getByText('英雄の証')).toBeInTheDocument()
    expect(screen.getByTestId('stock-target-settings')).toBeInTheDocument()
  })

  it('allows updating possession count for an item', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PossessionModal
        items={mockItems}
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs).toHaveLength(3)

    // Type 42 into the first item input (竜の牙, atlasId 6501)
    await user.type(inputs[0], '42')
    expect(inputs[0]).toHaveValue(42)
  })

  it('opens import dialog when clicking screenshot import button', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PossessionModal
        items={mockItems}
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const importButton = screen.getByRole('button', { name: /スクリーンショットから取り込む/ })
    await user.click(importButton)

    expect(screen.getByTestId('import-dialog')).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PossessionModal, type PossessionItemLike } from './PossessionModal'
import { PossessionModal as QuestsPossessionModal } from '../quests/PossessionModal'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('./StockTargetSettings', () => ({
  StockTargetSettings: () => <div data-testid="stock-target-settings">StockTargetSettings</div>,
}))

vi.mock('./possession-import/PossessionImportDialog', () => ({
  PossessionImportDialog: ({ open, onConfirm }: { open: boolean; onConfirm?: (updates: Record<string, number>) => void }) =>
    open ? (
      <div data-testid="import-dialog">
        PossessionImportDialog
        <button
          data-testid="simulate-confirm"
          onClick={() => onConfirm?.({ '6501': 99 })}
        >
          Confirm Import
        </button>
      </div>
    ) : null,
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

  it('allows updating possession count for an item and writes to localStorage', async () => {
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

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSSESSION) ?? '{}') as Record<string, number>
    expect(stored['6501']).toBe(42)
  })

  it('disables import button when items list is empty', () => {
    const onOpenChange = vi.fn()
    render(
      <PossessionModal
        items={[]}
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const importButton = screen.getByRole('button', { name: /スクリーンショットから取り込む/ })
    expect(importButton).toBeDisabled()
  })

  it('opens import dialog and updates possession on confirm', async () => {
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
    expect(importButton).not.toBeDisabled()
    await user.click(importButton)

    expect(screen.getByTestId('import-dialog')).toBeInTheDocument()

    // Simulate import confirmation
    await user.click(screen.getByTestId('simulate-confirm'))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSSESSION) ?? '{}') as Record<string, number>
    expect(stored['6501']).toBe(99)
  })

  it('updates input value when ls-sync event is dispatched', () => {
    const onOpenChange = vi.fn()
    render(
      <PossessionModal
        items={mockItems}
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[0]).toHaveValue(null)

    act(() => {
      localStorage.setItem(STORAGE_KEYS.POSSESSION, JSON.stringify({ '6501': 77 }))
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: STORAGE_KEYS.POSSESSION } }))
    })

    expect(inputs[0]).toHaveValue(77)
  })

  it('re-exports cleanly from components/quests/PossessionModal for backward compatibility', () => {
    expect(QuestsPossessionModal).toBe(PossessionModal)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShrinkGuardDialog } from './shrink-guard-dialog'
import type { PendingShrink } from '../../hooks/use-cloud-sync'

const push = vi.fn()

// t(key, fallback) の fallback をそのまま返し、実際に出る日本語で検証する。
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const pending = (overrides: Partial<PendingShrink> = {}): PendingShrink => ({
  next: { servants: 0, possessions: 0 },
  cloud: { servants: 461, possessions: 104 },
  missingKeys: [],
  force: false,
  ...overrides,
})

const handlers = () => ({
  onRestore: vi.fn(),
  onForceSave: vi.fn(),
  onDismiss: vi.fn(),
})

describe('ShrinkGuardDialog', () => {
  beforeEach(() => {
    push.mockReset()
  })

  it('shows what would be saved next to what the cloud currently holds', () => {
    render(<ShrinkGuardDialog pending={pending()} {...handlers()} />)

    expect(screen.getByText('クラウドのデータが大きく減ります')).toBeInTheDocument()
    expect(screen.getByText('サーヴァント 0 / 所持素材の種類 0')).toBeInTheDocument()
    expect(screen.getByText('サーヴァント 461 / 所持素材の種類 104')).toBeInTheDocument()
  })

  it('renders nothing while there is no blocked save', () => {
    render(<ShrinkGuardDialog pending={null} {...handlers()} />)

    expect(
      screen.queryByText('クラウドのデータが大きく減ります'),
    ).not.toBeInTheDocument()
  })

  // 既定は取り返しのつく「クラウドから復元」。上書きは destructive で最後に置く。
  it('offers restore, compare and save-anyway in that order', () => {
    render(<ShrinkGuardDialog pending={pending()} {...handlers()} />)

    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.trim())
      .filter(Boolean)
    expect(labels).toEqual(['クラウドから復元', '見比べる', 'このまま保存する'])
  })

  it('restores from the cloud', async () => {
    const props = handlers()
    render(<ShrinkGuardDialog pending={pending()} {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'クラウドから復元' }))

    expect(props.onRestore).toHaveBeenCalledTimes(1)
    expect(props.onForceSave).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('closes and sends the user to the comparison screen', async () => {
    const props = handlers()
    render(<ShrinkGuardDialog pending={pending()} {...props} />)

    await userEvent.click(screen.getByRole('button', { name: '見比べる' }))

    expect(push).toHaveBeenCalledWith('/cloud')
    expect(props.onDismiss).toHaveBeenCalled()
    expect(props.onRestore).not.toHaveBeenCalled()
    expect(props.onForceSave).not.toHaveBeenCalled()
  })

  it('lets the user push the save through', async () => {
    const props = handlers()
    render(<ShrinkGuardDialog pending={pending()} {...props} />)

    await userEvent.click(screen.getByRole('button', { name: 'このまま保存する' }))

    expect(props.onForceSave).toHaveBeenCalledTimes(1)
    expect(props.onRestore).not.toHaveBeenCalled()
  })

  it('reports missing entries only when there are any', () => {
    const { unmount } = render(<ShrinkGuardDialog pending={pending()} {...handlers()} />)
    expect(screen.queryByText(/保存内容から消えている項目/)).not.toBeInTheDocument()
    unmount()

    render(
      <ShrinkGuardDialog
        pending={pending({ missingKeys: ['todoState', 'quests'] })}
        {...handlers()}
      />,
    )
    expect(screen.getByText(/保存内容から消えている項目\s*2/)).toBeInTheDocument()
  })
})

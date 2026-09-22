// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CollapsibleSection } from './collapsible-section'

const renderSection = (
  props: Partial<ComponentProps<typeof CollapsibleSection>> = {},
) =>
  render(
    <CollapsibleSection title="セクション" {...props}>
      <p>本文</p>
    </CollapsibleSection>,
  )

describe('CollapsibleSection', () => {
  it('defaultOpen が true なら本文を開いて表示する', () => {
    renderSection({ defaultOpen: true })
    expect(screen.getByText('本文')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'セクション' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('defaultOpen が false なら本文を出さない', () => {
    renderSection({ defaultOpen: false })
    expect(screen.queryByText('本文')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'セクション' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('ヘッダーのクリックで開閉する', () => {
    renderSection({ defaultOpen: true })
    fireEvent.click(screen.getByRole('button', { name: 'セクション' }))
    expect(screen.queryByText('本文')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'セクション' }))
    expect(screen.getByText('本文')).toBeInTheDocument()
  })

  it('Enter と Space で開閉する', async () => {
    const user = userEvent.setup()
    renderSection({ defaultOpen: false })
    const trigger = screen.getByRole('button', { name: 'セクション' })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('本文')).toBeInTheDocument()
    await user.keyboard(' ')
    expect(screen.queryByText('本文')).not.toBeInTheDocument()
  })

  it('headerActions のクリックでは開閉しない', () => {
    const onAction = vi.fn()
    renderSection({
      defaultOpen: true,
      headerActions: (
        <button type="button" onClick={onAction}>
          操作
        </button>
      ),
    })
    fireEvent.click(screen.getByRole('button', { name: '操作' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.getByText('本文')).toBeInTheDocument()
  })

  it('controlled の open に従う', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <CollapsibleSection
        title="セクション"
        open={false}
        onOpenChange={onOpenChange}
      >
        <p>本文</p>
      </CollapsibleSection>,
    )
    expect(screen.queryByText('本文')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'セクション' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    rerender(
      <CollapsibleSection title="セクション" open onOpenChange={onOpenChange}>
        <p>本文</p>
      </CollapsibleSection>,
    )
    expect(screen.getByText('本文')).toBeInTheDocument()
  })
})

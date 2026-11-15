// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

import GlobalError from './error'

describe('app/error', () => {
  // #264: ChunkLoadError 以外で何も描かず、画面が真っ白になっていた
  it('shows a way out instead of a blank page for a runtime error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<GlobalError error={new SyntaxError('broken JSON')} reset={vi.fn()} />)

    expect(screen.getByText('問題が発生しました')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'トップページへ戻る' })).toHaveAttribute('href', '/')
  })
})

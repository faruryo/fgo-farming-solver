// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { LocalSection } from './local-section'

describe('LocalSection', () => {
  // 2つのボタンは縮まないので、横に並べるとスマホ幅で横スクロールが出る (#141)
  it('stacks the export and import buttons below the sm breakpoint', () => {
    render(<LocalSection exportLocal={vi.fn()} />)
    const exportButton = screen.getByRole('button', { name: /export-to-file/ })
    const row = exportButton.parentElement as HTMLElement
    expect(row.className.split(' ')).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']))
    // 縦に並べたときに flex-1 が効くと、ボタンの高さが潰れる
    expect(exportButton.className.split(' ')).not.toContain('flex-1')
    expect(screen.getByText('import-from-file').closest('label')?.parentElement?.className).toBe('relative sm:flex-1')
  })
})

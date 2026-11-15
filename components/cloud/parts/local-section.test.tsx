// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { LocalSection } from './local-section'

describe('LocalSection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

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

  // #264: 旧形式のバックアップの在庫設定を、クラウド復元と同じく育成目的へ移す
  it('migrates a legacy stock setting in an imported backup like a cloud restore', async () => {
    localStorage.setItem('efficiency/farmingPurpose', '"training"')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<LocalSection exportLocal={vi.fn()} />)
    const backup = {
      metadata: { app: 'fgo-farming-solver', version: '1.0', exportedAt: '2025-01-01T00:00:00.000Z' },
      storage: { 'efficiency/stockEnabled': 'true', servantLevels: '{"100100":{"lv":90}}' },
    }
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })

    fireEvent.change(screen.getByLabelText(/import-from-file/), { target: { files: [file] } })

    await waitFor(() => expect(alert).toHaveBeenCalledWith('import-success'))
    expect(localStorage.getItem('efficiency/farmingPurpose')).toBe('"reserve"')
    expect(localStorage.getItem('efficiency/stockEnabled')).toBe('true')
    expect(localStorage.getItem('servantLevels')).toBe('{"100100":{"lv":90}}')
  })
})

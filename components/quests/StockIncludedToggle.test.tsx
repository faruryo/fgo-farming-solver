// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockIncludedToggle } from './StockIncludedToggle'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

describe('StockIncludedToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('controlled mode', () => {
    it('checked=false のときは非アクティブ状態でレンダリングされ、クリックで onCheckedChange(true) が呼ばれる', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()

      render(<StockIncludedToggle checked={false} onCheckedChange={onCheckedChange} />)

      const button = screen.getByRole('switch', { name: 'ストック込み目標切り替え' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-checked', 'false')
      expect(button).toHaveAttribute('title', '余剰ストックを目標に含めません（クリックでストック込みに切替）')
      expect(button).toHaveTextContent('ストック込み')

      await user.click(button)
      expect(onCheckedChange).toHaveBeenCalledTimes(1)
      expect(onCheckedChange).toHaveBeenCalledWith(true)
    })

    it('checked=true のときはアクティブ状態でレンダリングされ、クリックで onCheckedChange(false) が呼ばれる', async () => {
      const user = userEvent.setup()
      const onCheckedChange = vi.fn()

      render(<StockIncludedToggle checked={true} onCheckedChange={onCheckedChange} />)

      const button = screen.getByRole('switch', { name: 'ストック込み目標切り替え' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-checked', 'true')
      expect(button).toHaveAttribute('title', '余剰ストックを目標に含めています（クリックで通常モードに切替）')

      await user.click(button)
      expect(onCheckedChange).toHaveBeenCalledTimes(1)
      expect(onCheckedChange).toHaveBeenCalledWith(false)
    })

    it('size="sm" や custom className が反映される', () => {
      render(<StockIncludedToggle checked={false} size="sm" className="custom-class" />)
      const button = screen.getByRole('switch')
      expect(button.className).toContain('text-[9px]')
      expect(button.className).toContain('custom-class')
    })
  })

  describe('uncontrolled mode (useStockTarget / localStorage 連動)', () => {
    it('デフォルト(未設定)時は OFF 状態でレンダリングされ、クリックで localStorage が更新される', async () => {
      const user = userEvent.setup()

      render(<StockIncludedToggle />)

      const button = screen.getByRole('switch', { name: 'ストック込み目標切り替え' })
      expect(button).toHaveAttribute('aria-checked', 'false')

      await user.click(button)
      expect(localStorage.getItem(STORAGE_KEYS.STOCK_ENABLED)).toBe('true')
    })

    it('localStorage に true が保存されているときは ON 状態で初期表示される', () => {
      localStorage.setItem(STORAGE_KEYS.STOCK_ENABLED, 'true')

      render(<StockIncludedToggle />)

      const button = screen.getByRole('switch', { name: 'ストック込み目標切り替え' })
      expect(button).toHaveAttribute('aria-checked', 'true')
    })
  })
})

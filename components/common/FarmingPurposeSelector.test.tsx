// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { FarmingPurposeSelector } from './FarmingPurposeSelector'

describe('FarmingPurposeSelector', () => {
  beforeEach(() => localStorage.clear())

  it('目的を変更し、計算方法を開ける', async () => {
    render(<FarmingPurposeSelector />)
    fireEvent.click(
      screen.getByRole('radio', { name: '新規サーヴァントに備える' }),
    )
    expect(
      screen.getByRole('radio', { name: '新規サーヴァントに備える' }),
    ).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: '計算方法を見る' }))
    expect(
      await screen.findByText('周回効率ポイントの計算方法'),
    ).toBeInTheDocument()
  })
})

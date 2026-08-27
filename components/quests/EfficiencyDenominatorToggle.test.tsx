// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EfficiencyDenominatorToggle } from './EfficiencyDenominatorToggle'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

describe('EfficiencyDenominatorToggle', () => {
  it('AP効率が選択されているとき周回効率を押すと onChange("turn") が呼ばれる', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EfficiencyDenominatorToggle value="ap" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '周回効率' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('turn')
  })

  it('周回効率が選択されているとき AP効率を押すと onChange("ap") が呼ばれる', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<EfficiencyDenominatorToggle value="turn" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'AP効率' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('ap')
  })
})

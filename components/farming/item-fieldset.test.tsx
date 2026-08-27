// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemFieldset } from './item-fieldset'
import { ItemInput } from './item-input'
import type { Item } from '../../interfaces/fgodrop'
import type { Localized } from '../../lib/get-local-items'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ItemInput', () => {
  it('renders item name, icon, and numeric input', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ItemInput
        id="item-1"
        name="竜の牙"
        icon="dragon-fang"
        inputValues={{ 'item-1': '5' }}
        handleChange={handleChange}
      />
    )

    expect(screen.getByText('竜の牙')).toBeInTheDocument()
    const input = screen.getByRole('spinbutton', { name: /竜の牙/ })
    expect(input).toHaveValue(5)

    await user.type(input, '0')
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders fallback placeholder when icon is missing', () => {
    render(
      <ItemInput
        id="item-2"
        name="謎の素材"
        inputValues={{}}
        handleChange={vi.fn()}
      />
    )

    expect(screen.getByText('謎の素材')).toBeInTheDocument()
    const input = screen.getByRole('spinbutton', { name: /謎の素材/ })
    expect(input).toHaveValue(null)
  })
})

describe('ItemFieldset', () => {
  const itemGroups: [string, [string, Localized<Item>[]][]][] = [
    [
      'スキル強化＆霊基再臨素材',
      [
        [
          '銅素材',
          [
            { id: 'item-1', name: '竜の牙', category: '銅素材', largeCategory: 'スキル強化＆霊基再臨素材', shortName: '竜の牙' },
            { id: 'item-2', name: '虚影の塵', category: '銅素材', largeCategory: 'スキル強化＆霊基再臨素材', shortName: '虚影の塵' },
          ],
        ],
      ],
    ],
  ]

  it('renders accordion categories and contained item inputs', () => {
    render(
      <ItemFieldset
        itemGroups={itemGroups}
        inputItems={{ 'item-1': '10', 'item-2': '' }}
        handleChange={vi.fn()}
      />
    )

    expect(screen.getByText('スキル強化＆霊基再臨素材')).toBeInTheDocument()
    expect(screen.getByText('銅素材')).toBeInTheDocument()
    expect(screen.getByText('竜の牙')).toBeInTheDocument()
    expect(screen.getByText('虚影の塵')).toBeInTheDocument()

    expect(screen.getByRole('spinbutton', { name: /竜の牙/ })).toHaveValue(10)
    expect(screen.getByRole('spinbutton', { name: /虚影の塵/ })).toHaveValue(null)
  })
})

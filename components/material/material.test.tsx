// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Material } from './material'
import { makeMaterialCatalogServant, makeMaterials } from './test-fixtures'
import { createChaldeaState } from '../../hooks/create-chaldea-state'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ja' },
  }),
}))

const servant = makeMaterialCatalogServant({ id: 1, collectionNo: 1, name: 'サーヴァントA', className: 'saber' })
const materials = { '1': makeMaterials() }

const readServantResult = (): Record<string, number> | null =>
  JSON.parse(localStorage.getItem('material/servant-result') ?? 'null')

describe('Material（クラス別ページ）の育成ぶん', () => {
  beforeEach(() => localStorage.clear())

  it('サーヴァントの目標を変えると、素材計算を実行しなくても育成ぶんが書き直される', async () => {
    const state = createChaldeaState(['1'])
    state['1'].disabled = false
    state['1'].targets.skill.disabled = true
    state['1'].targets.appendSkill.disabled = true
    localStorage.setItem('material', JSON.stringify(state))
    localStorage.setItem('material/result', JSON.stringify({ '100': 999 }))

    render(<Material servants={[servant]} materials={materials} className="saber" />)
    // 再臨 0→4 は 100 を 4+8+12 個
    await vi.waitFor(() => expect(readServantResult()?.['100']).toBe(24))

    // 再臨を目標から外す
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'ascension' }))
    await vi.waitFor(() => expect(readServantResult()).toEqual({}))
    expect(JSON.parse(localStorage.getItem('material/result') ?? 'null')).toEqual({ '100': 999 })
  })
})

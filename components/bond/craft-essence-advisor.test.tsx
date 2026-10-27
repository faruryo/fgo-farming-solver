// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Quest } from '../../interfaces/fgodrop'
import { bondQuestCandidates } from '../../lib/bond/quest-candidates'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import type { MaterialCatalogServant, MaterialCatalogV1 } from '../../lib/material-catalog'
import { makeBondUpCraftEssence, makeMaterialCatalogServant } from '../material/test-fixtures'
import { CraftEssenceAdvisor, type AdvisorServant } from './craft-essence-advisor'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, values?: Record<string, string | number>) => {
      const params = new Map(Object.entries(values ?? {}))
      return (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params.get(name) ?? ''))
    },
    i18n: { language: 'ja' },
  }),
}))

const QUESTS: Quest[] = [
  { id: 'ordeal', section: 'Free', area: 'オーディール・コール', name: '月光採掘場', ap: 40, bondPoints: 3797 },
  { id: 'daily', section: 'Free', area: '修練場（月）', name: '弓極級', ap: 40, bondPoints: 815 },
]

const servant = (id: number): MaterialCatalogServant =>
  makeMaterialCatalogServant({ id, collectionNo: id, name: `サーヴァント${id}`, cost: 16 })

const registeredServants = (count: number, questId = 'ordeal'): AdvisorServant[] =>
  Array.from({ length: count }, (_, i) => ({
    servant: servant(i + 1),
    candidates: bondQuestCandidates(QUESTS, [], 'saber'),
    questId,
  }))

const essences = [makeBondUpCraftEssence({ cost: 12, rate: 200, name: 'カルデアの者' })]

// 名前は label の中身(クラスアイコンの alt + サーヴァント名)になる
const checkbox = (name: string) => screen.getByRole('checkbox', { name: accessibleName => accessibleName.endsWith(name) })
const checkedNames = () =>
  screen
    .getAllByRole('checkbox')
    .filter(box => box.getAttribute('aria-checked') === 'true')
    .map(box => box.closest('label')?.textContent)

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('CraftEssenceAdvisor', () => {
  it('selects the first five registered servants when opened', () => {
    render(<CraftEssenceAdvisor registered={registeredServants(7)} essences={essences} />)
    expect(checkedNames()).toEqual(['サーヴァント1', 'サーヴァント2', 'サーヴァント3', 'サーヴァント4', 'サーヴァント5'])
  })

  it('does not let a sixth servant be selected', async () => {
    const user = userEvent.setup()
    render(<CraftEssenceAdvisor registered={registeredServants(7)} essences={essences} />)
    await user.click(checkbox('サーヴァント6'))
    expect(checkedNames()).toHaveLength(5)
    expect(checkbox('サーヴァント6').getAttribute('aria-checked')).toBe('false')
  })

  it('asks to select servants and hides the quest when every selection is cleared', async () => {
    const user = userEvent.setup()
    render(<CraftEssenceAdvisor registered={registeredServants(2)} essences={essences} />)
    await user.click(checkbox('サーヴァント1'))
    await user.click(checkbox('サーヴァント2'))
    expect(screen.getByText('提案するサーヴァントを選んでください')).toBeTruthy()
    expect(screen.queryByLabelText('周回クエスト')).toBeNull()
    expect(screen.queryByTestId('bond-advisor-result')).toBeNull()
  })

  it('asks to select servants when none is registered', () => {
    render(<CraftEssenceAdvisor registered={[]} essences={essences} />)
    expect(screen.getByText('提案するサーヴァントを選んでください')).toBeTruthy()
  })

  it('saves a changed master level', async () => {
    render(<CraftEssenceAdvisor registered={registeredServants(3)} essences={essences} />)
    fireEvent.change(screen.getByLabelText('マスターレベル'), { target: { value: '120' } })
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEYS.MASTER_LEVEL)).toBe('120'))
  })

  it('defaults the quest to the first servant quest and shows the suggestion', () => {
    render(<CraftEssenceAdvisor registered={registeredServants(3, 'daily')} essences={essences} />)
    expect(screen.getByLabelText('周回クエスト')).toHaveProperty('value', 'daily')
    // 815 × 1.2 = 978 を3体。コスト 48 + 12 は上限 118 以内
    expect(screen.getByText('2,934')).toBeTruthy()
    expect(screen.getByText('60 / 118')).toBeTruthy()
  })

  it('says no shared quest exists when the servants have no common candidate', () => {
    const registered = registeredServants(2).map((r, i) => (i === 1 ? { ...r, candidates: [] } : r))
    render(<CraftEssenceAdvisor registered={registered} essences={essences} />)
    expect(screen.getByText('選んだサーヴァントで一緒に回せるクエストがありません')).toBeTruthy()
  })

  it('reports servants without a cost and servants over the cost limit', () => {
    const unknown = registeredServants(2)
    unknown[1] = { ...unknown[1], servant: { ...unknown[1].servant, cost: undefined } }
    const { unmount } = render(<CraftEssenceAdvisor registered={unknown} essences={essences} />)
    expect(screen.getByText('サーヴァント2のコストが分からないため提案できません')).toBeTruthy()
    unmount()

    localStorage.setItem(STORAGE_KEYS.MASTER_LEVEL, '1')
    render(<CraftEssenceAdvisor registered={registeredServants(4)} essences={essences} />)
    return waitFor(() => expect(screen.getByText(/コストの合計64が上限56を超えています/)).toBeTruthy())
  })
})

describe('BondTracker without bond-up craft essences', () => {
  it('shows that the essence data cannot be loaded and still renders the estimate tab', async () => {
    vi.resetModules()
    const catalog = { schemaVersion: 1, servants: [], items: [], materials: {}, sources: {}, updatedAt: 1 } as unknown as MaterialCatalogV1
    vi.doMock('../../hooks/use-material-catalog', () => ({
      useMaterialCatalog: () => ({ catalog, failed: false, reload: vi.fn() }),
    }))
    vi.doMock('./use-bond-tracker', () => ({
      useBondTracker: () => ({
        isLoading: false,
        state: { entries: [], teapot: { enabled: false, stock: 0 }, useApples: false },
        cards: [],
        summary: { groups: [], total: {} },
        questsById: new Map(),
        plannedLaps: new Map(),
        podFreeQuestIds: new Set(),
      }),
    }))
    vi.doMock('./estimate-table', () => ({ BondEstimateTable: () => <div>見積もりの表</div> }))
    const { BondTracker } = await import('./index')
    const user = userEvent.setup()
    render(<BondTracker />)

    await user.click(screen.getByRole('tab', { name: '礼装の提案' }))
    expect(screen.getByText('礼装のデータを読み込めないため提案できません')).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: '見積もり' }))
    expect(screen.getByText('見積もりの表')).toBeTruthy()
  })
})

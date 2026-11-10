// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

describe('CraftEssenceAdvisor conditions', () => {
  const CASTER = 104
  const SABER = 100
  const BEAST = 2821
  const withTraits = (id: number, traits: number[], ascensionTraits?: number[][]): AdvisorServant => ({
    servant: { ...servant(id), traits, ...(ascensionTraits ? { ascensionTraits } : {}) },
    candidates: bondQuestCandidates(QUESTS, [], 'saber'),
    questId: 'ordeal',
  })
  const casterOnly = makeBondUpCraftEssence({
    id: 1, collectionNo: 2124, cost: 12, rate: 200, name: '手稿の翼', appliesTo: [[CASTER]], appliesToLabel: '〔キャスター〕',
  })
  const lunch = makeBondUpCraftEssence({ id: 2, collectionNo: 330, cost: 12, rate: 100, name: 'カルデア・ランチタイム' })
  const beastOnly = makeBondUpCraftEssence({
    id: 3, collectionNo: 1949, cost: 12, rate: 200, name: 'ＮＦＦから愛をこめて', appliesTo: [[BEAST]], appliesToLabel: '〔ケモノ科のサーヴァント〕',
  })
  const portrait = makeBondUpCraftEssence({ id: 4, collectionNo: 99, cost: 5, rate: 0, add: 50, name: '英霊肖像' })
  const darius = makeBondUpCraftEssence({ id: 5, collectionNo: 108, cost: 5, rate: 0, add: 50, target: 'self', name: 'ダレイオス' })
  // 自分の組み合わせの一覧(フレンドの上位3つは別の一覧)
  const own = () => within(screen.getByTestId('bond-advisor-result').querySelector('ul') as HTMLElement)

  it('does not show an essence for casters when only a saber is selected', () => {
    render(<CraftEssenceAdvisor registered={[withTraits(1, [SABER])]} essences={[casterOnly, lunch]} />)
    expect(own().getByText('カルデア・ランチタイム')).toBeTruthy()
    expect(screen.queryByText(/手稿の翼/)).toBeNull()
  })

  it('shows who each essence applies to and its effect, without stages when they do not matter', () => {
    render(<CraftEssenceAdvisor registered={[withTraits(1, [CASTER]), withTraits(2, [CASTER])]} essences={[casterOnly, lunch]} />)
    expect(own().getByText('〔キャスター〕に +20%')).toBeTruthy()
    expect(own().getByText('全員に +10%')).toBeTruthy()
    expect(own().queryByText(/で効く/)).toBeNull()
    expect(own().queryByText(/で数えた/)).toBeNull()
  })

  it('shows fixed amounts for everyone and for the servant itself', () => {
    render(<CraftEssenceAdvisor registered={[withTraits(1, [SABER]), withTraits(2, [SABER])]} essences={[portrait, darius]} />)
    expect(own().getByText('全員に +50')).toBeTruthy()
    expect(screen.getByText('自身に +50')).toBeTruthy()
  })

  it('shows the stages an essence applies at and the stage the servant was counted at', () => {
    const stageServant = withTraits(1, [SABER], [[SABER], [SABER], [SABER, BEAST], [SABER, BEAST]])
    render(<CraftEssenceAdvisor registered={[stageServant, withTraits(2, [SABER])]} essences={[beastOnly, lunch]} />)
    expect(own().getByText('〔ケモノ科のサーヴァント〕に +20%')).toBeTruthy()
    expect(own().getByText('サーヴァント1は第3再臨・最終再臨で効く')).toBeTruthy()
    expect(own().getAllByText('第3再臨で数えた')).toHaveLength(1)
    expect(own().getAllByText(/で効く/)).toHaveLength(1)
  })

  describe('friend support', () => {
    const tea = makeBondUpCraftEssence({ id: 6, collectionNo: 910, cost: 12, rate: 50, supportRate: 150, name: 'カルデア・ティータイム' })
    const casters = [1, 2, 3].map(id => withTraits(id, [CASTER]))

    it('shows the top three for a friend support below the own combination', () => {
      render(<CraftEssenceAdvisor registered={casters} essences={[casterOnly, lunch, tea]} />)
      const section = within(screen.getByTestId('bond-advisor-friend'))
      expect(section.getByText('フレンドのサポートに付いていてほしい礼装')).toBeTruthy()
      expect(section.getAllByRole('listitem').map(li => li.textContent)).toEqual([
        '1.手稿の翼〔キャスター〕に +20%1周 +2,280(合計 17,655)',
        '2.カルデア・ティータイム全員に +15%(サポート時)1周 +1,710(合計 17,085)',
        '3.カルデア・ランチタイム全員に +10%1周 +1,140(合計 16,515)',
      ])
      expect(section.getByText('フレンドのサーヴァントと礼装のコストは数えていません')).toBeTruthy()
      // 自分の組み合わせと同じ礼装でも重なるかの注記は出さない
      expect(screen.queryByText(/重な/)).toBeNull()
    })

    it('shows the stages a friend essence applies at and the stage it was counted at', () => {
      const stageServant = withTraits(1, [SABER], [[SABER], [SABER], [SABER, BEAST], [SABER, BEAST]])
      render(<CraftEssenceAdvisor registered={[stageServant, withTraits(2, [SABER])]} essences={[beastOnly, lunch]} />)
      const section = within(screen.getByTestId('bond-advisor-friend'))
      expect(section.getByText(/サーヴァント1は第3再臨・最終再臨で効く/).textContent).toContain('(サーヴァント1は第3再臨で数えた)')
    })

    it('does not show the friend suggestion when servants exceed the cost limit', async () => {
      localStorage.setItem(STORAGE_KEYS.MASTER_LEVEL, '1')
      render(<CraftEssenceAdvisor registered={[1, 2, 3, 4].map(id => withTraits(id, [CASTER]))} essences={[casterOnly, lunch, tea]} />)
      await waitFor(() => expect(screen.getByText(/コストの合計64が上限56を超えています/)).toBeTruthy())
      expect(screen.queryByTestId('bond-advisor-friend')).toBeNull()
    })
  })
})

describe('BondTracker without usable bond-up craft essences', () => {
  it.each([
    ['no bond-up craft essences', undefined],
    ['bond-up craft essences without a condition', [makeBondUpCraftEssence({ appliesTo: undefined })]],
  ])('shows that the essence data cannot be loaded with %s and still renders the estimate tab', async (_label, bondUpCraftEssences) => {
    vi.resetModules()
    const catalog = {
      schemaVersion: 1, servants: [], items: [], materials: {}, sources: {}, updatedAt: 1,
      ...(bondUpCraftEssences ? { bondUpCraftEssences } : {}),
    } as unknown as MaterialCatalogV1
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

// @vitest-environment jsdom
//
// Integration tests for the "育成記録モード" (tracking mode) behavior that
// components/material/index.tsx owns: gating possession updates on the
// mode toggle, the consume/shortage decision (checkStartChange /
// applyStartChange), and the mode-suggestion banner's visibility rules.
//
// lib/tracking-toast's diff math is already covered exhaustively by
// lib/diff-materials.test.ts; here we mock showTrackingToast/showBlockedToast
// so we can assert *when* and *with what* they're invoked, and drive the
// shortage recovery callback directly instead of rendering the real Sonner
// toast tree (which lives outside this component, at the layout level).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Index } from './index'
import { makeMaterialCatalogServant, makeItem, makeMaterials } from './test-fixtures'
import type { ShowBlockedToastParams, ShowTrackingToastParams } from '../../lib/tracking-toast'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, params?: Record<string, unknown>) =>
      fallback.replace(/{{(\w+)}}/g, (_, name: string) => String(new Map(Object.entries(params ?? {})).get(name))),
  }),
}))

const showTrackingToast = vi.fn<(p: ShowTrackingToastParams) => void>()
const showBlockedToast = vi.fn<(p: ShowBlockedToastParams) => void>()

vi.mock('../../lib/tracking-toast', () => ({
  showTrackingToast: (p: ShowTrackingToastParams) => showTrackingToast(p),
  showBlockedToast: (p: ShowBlockedToastParams) => showBlockedToast(p),
}))

const servant = makeMaterialCatalogServant({ id: 1, collectionNo: 1, name: 'サーヴァントA' })
const items = [
  makeItem({ id: 100, name: '灯火の焔' }),
  makeItem({ id: 200, name: '蛮神の心臓' }),
]
const materials = { '1': makeMaterials() }

const getPossession = (): Record<string, number | undefined> =>
  JSON.parse(localStorage.getItem('posession') ?? '{}')

const setLocalStorage = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value))

/** Ascension pips are rendered in DOM order; index 0 = target start value 1. */
const getPips = () => document.querySelectorAll('.c-sum-pip')

/**
 * Servants default to unowned (`disabled: true`), which hides the
 * ascension/skill/append pips entirely. Tests that click pips must mark
 * the card owned first via the "未所持" toggle button, unless a `material`
 * localStorage fixture already sets `disabled: false`.
 */
const makeOwned = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '未所持' }))
}

const expandGlobalPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText('COMMON TARGET — 共通目標設定'))
}

const getTrackingSwitch = () => screen.getByRole('switch', { name: '育成記録モード' })

beforeEach(() => {
  localStorage.clear()
  showTrackingToast.mockClear()
  showBlockedToast.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Index - tracking mode OFF (default)', () => {
  it('updates chaldeaState on pip click but leaves possession and toasts untouched', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    const pips = getPips()
    expect(pips).toHaveLength(4)
    await user.click(pips[0])

    // start advanced (pip 0 now lit)
    expect(pips[0]).toHaveClass('lit')
    expect(getPossession()).toEqual({})
    expect(showTrackingToast).not.toHaveBeenCalled()
    expect(showBlockedToast).not.toHaveBeenCalled()
  })
})

describe('Index - tracking mode ON, sufficient possession', () => {
  it('consumes the corresponding materials from possession and fires the tracking toast', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 10, '200': 5, '1': 1000000 })
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    const pips = getPips()
    await user.click(pips[0]) // ascension start 0 -> 1, step 0 costs 4x100 + 1x200 + 50000 QP

    expect(getPossession()).toEqual({ '100': 6, '200': 4, '1': 950000 })
    expect(showBlockedToast).not.toHaveBeenCalled()
    expect(showTrackingToast).toHaveBeenCalledTimes(1)
    const call = showTrackingToast.mock.calls[0][0]
    expect(call.servantId).toBe('1')
    expect(call.target).toBe('ascension')
    expect(call.prevStart).toBe(0)
    expect(call.newStart).toBe(1)
  })

  it('returns (adds back) materials when start is decremented, uncapped by shortage checks', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('material', {
      all: { disabled: true, targets: { ascension: { disabled: false, ranges: [{ start: 0, end: 4 }] }, skill: { disabled: false, ranges: [{ start: 1, end: 10 }, { start: 1, end: 10 }, { start: 1, end: 10 }] }, appendSkill: { disabled: false, ranges: [{ start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }] } } },
      '1': { disabled: false, targets: { ascension: { disabled: false, ranges: [{ start: 2, end: 4 }] }, skill: { disabled: false, ranges: [{ start: 1, end: 10 }, { start: 1, end: 10 }, { start: 1, end: 10 }] }, appendSkill: { disabled: false, ranges: [{ start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }, { start: 0, end: 10 }] } } },
    })
    setLocalStorage('posession', { '100': 0 })
    render(<Index servants={[servant]} materials={materials} items={items} />)

    const pips = getPips()
    // start is 2; right-click (contextmenu) decrements to 1 -> returns step 1's materials (8x item 100 + 100000 QP)
    await act(async () => {
      pips[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })

    expect(getPossession()).toEqual({ '100': 8, '1': 100000 })
    expect(showTrackingToast).toHaveBeenCalledTimes(1)
    expect(showTrackingToast.mock.calls[0][0].prevStart).toBe(2)
    expect(showTrackingToast.mock.calls[0][0].newStart).toBe(1)
  })
})

describe('Index - tracking mode ON, insufficient possession (shortage)', () => {
  it('blocks the start change entirely and shows the blocked toast instead of clamping to 0', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 1, '200': 5, '1': 1000000 }) // need 4x100, have 1
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    const pips = getPips()
    await user.click(pips[0])

    // Blocked: chaldeaState (pip) and possession stay unchanged.
    expect(pips[0]).not.toHaveClass('lit')
    expect(getPossession()).toEqual({ '100': 1, '200': 5, '1': 1000000 })
    expect(showTrackingToast).not.toHaveBeenCalled()
    expect(showBlockedToast).toHaveBeenCalledTimes(1)

    const call = showBlockedToast.mock.calls[0][0]
    expect(call.shortageItems).toEqual([
      { itemId: '100', owned: 1, required: 4, name: '灯火の焔', icon: 'Item100' },
    ])
  })

  it('lets the shortage-recovery callback correct possession directly (no subtraction, since nothing was consumed)', async () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 1 })
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)

    await user.click(getPips()[0])
    expect(showBlockedToast).toHaveBeenCalledTimes(1)

    // Simulate the BlockedToast's "所持数を更新する" confirmation.
    const { onSetPossession } = showBlockedToast.mock.calls[0][0]
    act(() => {
      onSetPossession({ '100': 12 })
    })

    expect(getPossession()).toEqual({ '100': 12 })
  })
})

describe('Index - tracking mode toggle UI', () => {
  it('persists the toggle to localStorage and shows/hides the ● REC indicator when the panel is collapsed', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)

    expect(screen.queryByText('● REC')).not.toBeInTheDocument()

    await expandGlobalPanel(user)
    const toggle = getTrackingSwitch()
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(JSON.parse(localStorage.getItem('material/tracking-mode')!)).toBe(true)

    // Collapse the panel again; the REC indicator should now be visible.
    await expandGlobalPanel(user)
    expect(screen.getByText('● REC')).toBeInTheDocument()
  })
})

describe('Index - tracking-mode suggestion banner', () => {
  const bannerText =
    'セットアップが進んでいるようです。今後の現在値変更で所持数を自動で増減する「育成記録モード」をオンにしますか？'

  it('stays hidden while possession has never been non-zero', () => {
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
  })

  it('appears once possession becomes non-zero (e.g. synced in from /material/result), and "ON にする" enables tracking mode and dismisses it', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)

    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()

    // Simulate another tab/page writing to the shared 'posession' key.
    act(() => {
      localStorage.setItem('posession', JSON.stringify({ '100': 3 }))
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'posession' } }))
    })

    expect(await screen.findByText(bannerText)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ON にする' }))

    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('material/tracking-mode')!)).toBe(true)
    expect(JSON.parse(localStorage.getItem('material/tracking-suggest-dismissed')!)).toBe(true)
  })

  it('"今はやめておく" dismisses the banner without enabling tracking mode', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)

    act(() => {
      localStorage.setItem('posession', JSON.stringify({ '100': 3 }))
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: 'posession' } }))
    })
    await screen.findByText(bannerText)

    await user.click(screen.getByRole('button', { name: '今はやめておく' }))

    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('material/tracking-suggest-dismissed')!)).toBe(true)
    // Tracking mode itself was never toggled on, only initialized to its
    // default (false) by useLocalStorage's first-write effect.
    expect(JSON.parse(localStorage.getItem('material/tracking-mode') ?? 'null')).toBe(false)
  })

  it('never shows once already dismissed, even with non-zero possession', () => {
    setLocalStorage('material/tracking-suggest-dismissed', true)
    setLocalStorage('posession', { '100': 3 })
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
  })

  it('never shows once tracking mode is already ON', () => {
    setLocalStorage('material/tracking-mode', true)
    setLocalStorage('posession', { '100': 3 })
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(screen.queryByText(bannerText)).not.toBeInTheDocument()
  })
})

describe('Index - permanent gesture hint', () => {
  const hintText = 'タップ:+1 ／ 右クリック・長押し:-1'

  it('shows the hint above the grid when the filtered servant list is non-empty', () => {
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(screen.getByText(hintText)).toBeInTheDocument()
  })

  it('hides the hint in the empty-filter state', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)

    // レアリティ1でフィルタするとservant(デフォルトのレアリティは5)が除外され0件になる
    await user.click(screen.getByRole('button', { name: '★' }))

    expect(screen.getByText('条件に一致するサーヴァントはいません')).toBeInTheDocument()
    expect(screen.queryByText(hintText)).not.toBeInTheDocument()
  })
})

describe('Index - event bonus filter', () => {
  const now = Math.floor(Date.now() / 1000)
  const bonus = (damage: number | undefined, bond: number, endedAt = now + 3600) =>
    [{ eventId: 80627, startedAt: now - 60, endedAt, ...(damage ? { damage } : {}), bond }]
  const servantB = makeMaterialCatalogServant({ id: 2, collectionNo: 2, name: 'サーヴァントB', rarity: 4, eventBonuses: bonus(30, 20) })
  const servantC = makeMaterialCatalogServant({ id: 3, collectionNo: 3, name: 'サーヴァントC', rarity: 5, eventBonuses: bonus(100, 50) })
  const servantD = makeMaterialCatalogServant({ id: 4, collectionNo: 4, name: 'サーヴァントD', rarity: 5, eventBonuses: bonus(undefined, 20) })
  const allMaterials = { ...materials, '2': makeMaterials(), '3': makeMaterials(), '4': makeMaterials() }
  const select = () => screen.getByRole('combobox', { name: 'イベント対象' })
  const shown = () => ['サーヴァントA', 'サーヴァントB', 'サーヴァントC', 'サーヴァントD'].filter(name => screen.queryByText(name))

  it('builds options from the active bonus groups and narrows the list, combined with the rarity filter', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant, servantB, servantC, servantD]} materials={allMaterials} items={items} />)

    expect([...select().querySelectorAll('option')].map(o => o.textContent)).toEqual([
      'イベント対象',
      'ボーナス対象すべて（3）',
      '特攻100%・絆+50%（1）',
      '特攻30%・絆+20%（1）',
      '絆+20%（1）',
    ])
    expect(shown()).toEqual(['サーヴァントA', 'サーヴァントB', 'サーヴァントC', 'サーヴァントD'])

    await user.selectOptions(select(), 'all')
    expect(shown()).toEqual(['サーヴァントB', 'サーヴァントC', 'サーヴァントD'])

    await user.selectOptions(select(), '80627:0:20')
    expect(shown()).toEqual(['サーヴァントD'])

    await user.selectOptions(select(), 'all')
    await user.click(screen.getByRole('button', { name: '★★★★★' }))
    expect(shown()).toEqual(['サーヴァントC', 'サーヴァントD'])

    await user.selectOptions(select(), '')
    expect(shown()).toEqual(['サーヴァントA', 'サーヴァントC', 'サーヴァントD'])
  })

  it('hides the select when no servant has an active event bonus', () => {
    const ended = makeMaterialCatalogServant({ id: 2, collectionNo: 2, name: 'サーヴァントB', eventBonuses: bonus(30, 20, now - 1) })
    render(<Index servants={[servant, ended]} materials={allMaterials} items={items} />)
    expect(screen.queryByRole('combobox', { name: 'イベント対象' })).not.toBeInTheDocument()
  })

  it('separates concurrent events under their names so same-rate groups are not merged', async () => {
    const user = userEvent.setup()
    const allQuests = { eventId: 80513, eventName: '期間限定で第1弾～第9弾で召喚可能となったイベント限定サーヴァントはすべてのクエストで攻撃威力50%アップ！', startedAt: now - 60, endedAt: now + 3600, damage: 50 }
    const mainEvent = (damage: number) => ({ eventId: 80511, eventName: '育て！ マイ・リトル・ドラゴン\n～鱗ある者たちの見る幻想～', startedAt: now - 30, endedAt: now + 3600, damage, bond: 20 })
    const b = makeMaterialCatalogServant({ id: 2, collectionNo: 2, name: 'サーヴァントB', eventBonuses: [mainEvent(50), allQuests] })
    const c = makeMaterialCatalogServant({ id: 3, collectionNo: 3, name: 'サーヴァントC', eventBonuses: [allQuests] })
    const d = makeMaterialCatalogServant({ id: 4, collectionNo: 4, name: 'サーヴァントD', eventBonuses: [mainEvent(30)] })
    render(<Index servants={[servant, b, c, d]} materials={allMaterials} items={items} />)

    expect([...select().querySelectorAll('optgroup')].map(g => g.label)).toEqual([
      '期間限定で第1弾～第9弾で召喚可能となったイベン…',
      '育て！ マイ・リトル・ドラゴン',
    ])
    expect([...select().querySelectorAll('option')].map(o => o.textContent)).toEqual([
      'イベント対象',
      'ボーナス対象すべて（3）',
      'このイベントの対象すべて（2）',
      '特攻50%（2）',
      'このイベントの対象すべて（2）',
      '特攻50%・絆+20%（1）',
      '特攻30%・絆+20%（1）',
    ])

    await user.selectOptions(select(), 'event:80511')
    expect(shown()).toEqual(['サーヴァントB', 'サーヴァントD'])
    await user.selectOptions(select(), '80513:50:0')
    expect(shown()).toEqual(['サーヴァントB', 'サーヴァントC'])
  })

  it('rebuilds the options when a bonus period starts or ends while the page stays open', () => {
    vi.useFakeTimers()
    try {
      const start = Math.floor(Date.now() / 1000)
      const later = makeMaterialCatalogServant({
        id: 2, collectionNo: 2, name: 'サーヴァントB',
        eventBonuses: [{ eventId: 80627, startedAt: start + 60, endedAt: start + 120, damage: 30, bond: 20 }],
      })
      render(<Index servants={[servant, later]} materials={allMaterials} items={items} />)
      expect(screen.queryByRole('combobox', { name: 'イベント対象' })).not.toBeInTheDocument()

      act(() => { vi.advanceTimersByTime(60_000) })
      expect(screen.getByRole('combobox', { name: 'イベント対象' })).toBeInTheDocument()

      act(() => { vi.advanceTimersByTime(60_000) })
      expect(screen.queryByRole('combobox', { name: 'イベント対象' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to no filter when the selected "all" outlives the last event', () => {
    vi.useFakeTimers()
    try {
      const start = Math.floor(Date.now() / 1000)
      const ending = makeMaterialCatalogServant({
        id: 2, collectionNo: 2, name: 'サーヴァントB',
        eventBonuses: [
          { eventId: 80627, startedAt: start - 60, endedAt: start + 60, damage: 30, bond: 20 },
          { eventId: 80628, startedAt: start + 120, endedAt: start + 600, bond: 20 },
        ],
      })
      render(<Index servants={[servant, ending]} materials={allMaterials} items={items} />)
      fireEvent.change(select(), { target: { value: 'all' } })
      expect(shown()).toEqual(['サーヴァントB'])

      act(() => { vi.advanceTimersByTime(60_000) })
      expect(screen.queryByRole('combobox', { name: 'イベント対象' })).not.toBeInTheDocument()
      expect(shown()).toEqual(['サーヴァントA', 'サーヴァントB'])

      act(() => { vi.advanceTimersByTime(60_000) })
      expect(select()).toHaveValue('')
      expect(shown()).toEqual(['サーヴァントA', 'サーヴァントB'])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Index - 保存されている Lv・宝具Lv のカードの表示', () => {
  const LEVELS_KEY = 'servantLevels'
  const level = () => screen.queryByTestId('servant-card-level')

  it('保存値の無い状態で一覧を描いても、Lv・宝具Lv の保存値のキーを作らない。値の無い所持のカードには「Lv –」を出す', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)
    expect(level()).toHaveTextContent(/^Lv –$/)
    expect(localStorage.getItem(LEVELS_KEY)).toBeNull()
  })

  it('未所持に戻したカード: Lv は出ず保存値は消えない。所持に戻すとまた出る', async () => {
    setLocalStorage(LEVELS_KEY, { '1': { lv: 90 } })
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    expect(level()).not.toBeInTheDocument()
    await makeOwned(user)
    expect(level()).toHaveTextContent(/^Lv 90$/)

    await user.click(screen.getByRole('button', { name: '✓ 所持' }))
    expect(level()).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(LEVELS_KEY) ?? 'null')).toEqual({ '1': { lv: 90 } })

    await user.click(screen.getByRole('button', { name: '未所持' }))
    expect(level()).toHaveTextContent(/^Lv 90$/)
  })

  it('別の端末で取り込んだ値を PC で見る: 保存値が書き換わりキーを指定した通知が出ると、開き直さずにカードに出る', async () => {
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await makeOwned(user)
    expect(level()).toHaveTextContent(/^Lv –$/)

    act(() => {
      setLocalStorage(LEVELS_KEY, { '1': { lv: 100, npLv: 3 } })
      window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: LEVELS_KEY } }))
    })
    expect(level()).toHaveTextContent('Lv 100・宝具 3')
  })
})

describe('Index - カードから Lv・宝具Lv を手で入れる', () => {
  const LEVELS_KEY = 'servantLevels'
  const servantB = makeMaterialCatalogServant({ id: 2, collectionNo: 2, name: 'サーヴァントB' })
  const bothMaterials = { ...materials, '2': makeMaterials() }
  const ownedTargets = (skillEnd: number) => ({
    ascension: { disabled: false, ranges: [{ start: 1, end: 4 }] },
    skill: { disabled: false, ranges: [{ start: 2, end: skillEnd }, { start: 1, end: skillEnd }, { start: 1, end: skillEnd }] },
    appendSkill: { disabled: false, ranges: Array.from({ length: 5 }, () => ({ start: 0, end: 10 })) },
  })
  const setOwned = () =>
    setLocalStorage('material', {
      all: { disabled: true, targets: ownedTargets(10) },
      '1': { disabled: false, targets: ownedTargets(10) },
      '2': { disabled: false, targets: ownedTargets(10) },
    })
  const cardLevel = (id: number): HTMLButtonElement => {
    const button = document.getElementById(`svt-${id}`)?.querySelector<HTMLButtonElement>('[data-testid="servant-card-level"]')
    if (!button) throw new Error(`no level button for ${id}`)
    return button
  }
  const storedLevels = () => JSON.parse(localStorage.getItem(LEVELS_KEY) ?? 'null')
  const dialog = () => screen.queryByRole('dialog')
  const lvInput = () => screen.getByLabelText('Lv')
  const npLvInput = () => screen.getByLabelText('宝具Lv')
  const openFor = async (user: ReturnType<typeof userEvent.setup>, id: number) => {
    await user.click(cardLevel(id))
    await vi.waitFor(() => expect(lvInput()).toHaveFocus())
  }

  it('小窓を開く前は一覧に Lv・宝具Lv の入力欄が無い', () => {
    setOwned()
    render(<Index servants={[servant, servantB]} materials={bothMaterials} items={items} />)
    expect(cardLevel(1)).toBeInTheDocument()
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Lv')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('宝具Lv')).not.toBeInTheDocument()
    expect(document.querySelector('.c-servant-grid input')).toBeNull()
  })

  it('カードのボタンで小窓が開き、保存するとそのカードの表示が開き直さずに変わる。ほかの値は変えない', async () => {
    setOwned()
    setLocalStorage(LEVELS_KEY, { '1': { lv: 90, npLv: 2 }, '2': { lv: 70 }, '999': { lv: 50, x: 1 } })
    const materialBefore = localStorage.getItem('material')
    const user = userEvent.setup()
    render(<Index servants={[servant, servantB]} materials={bothMaterials} items={items} />)
    expect(cardLevel(1)).toHaveTextContent('Lv 90・宝具 2')

    await openFor(user, 1)
    expect(screen.getByRole('dialog', { name: 'サーヴァントA' })).toBeInTheDocument()
    expect(lvInput()).toHaveValue('90')
    expect(npLvInput()).toHaveValue('2')
    await user.clear(lvInput())
    await user.type(lvInput(), '100')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await vi.waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(cardLevel(1)).toHaveTextContent('Lv 100・宝具 2')
    expect(cardLevel(2)).toHaveTextContent(/^Lv 70$/)
    expect(storedLevels()).toEqual({ '1': { lv: 100, npLv: 2 }, '2': { lv: 70 }, '999': { lv: 50, x: 1 } })
    expect(localStorage.getItem('material')).toBe(materialBefore)
  })

  it('両方を空にして保存すると「Lv –」になる', async () => {
    setOwned()
    setLocalStorage(LEVELS_KEY, { '1': { lv: 90, npLv: 2 } })
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await openFor(user, 1)
    await user.clear(lvInput())
    await user.clear(npLvInput())
    await user.click(screen.getByRole('button', { name: '保存' }))
    await vi.waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(cardLevel(1)).toHaveTextContent(/^Lv –$/)
    expect(storedLevels()).toEqual({})
  })

  it('キャンセルと Escape では書かず、閉じたあとフォーカスが開いたボタンにある', async () => {
    setOwned()
    setLocalStorage(LEVELS_KEY, { '1': { lv: 90 } })
    const user = userEvent.setup()
    render(<Index servants={[servant, servantB]} materials={bothMaterials} items={items} />)

    await openFor(user, 1)
    await user.type(lvInput(), '5')
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    await vi.waitFor(() => expect(dialog()).not.toBeInTheDocument())
    await vi.waitFor(() => expect(cardLevel(1)).toHaveFocus())

    await openFor(user, 2)
    await user.type(lvInput(), '80')
    await user.keyboard('{Escape}')
    await vi.waitFor(() => expect(dialog()).not.toBeInTheDocument())
    await vi.waitFor(() => expect(cardLevel(2)).toHaveFocus())

    expect(storedLevels()).toEqual({ '1': { lv: 90 } })
    expect(cardLevel(1)).toHaveTextContent(/^Lv 90$/)
    expect(cardLevel(2)).toHaveTextContent(/^Lv –$/)
  })

  it('値の無い所持のカードで、両方を空のまま保存しても保存値を作らない', async () => {
    setOwned()
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    await openFor(user, 1)
    await user.click(screen.getByRole('button', { name: '保存' }))
    await vi.waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(localStorage.getItem(LEVELS_KEY)).toBeNull()
  })

  it('キーボードで「Lv –」から保存して値が出たあとも、両方を空にして「Lv –」に戻ったあとも、フォーカスが同じボタンにある', async () => {
    setOwned()
    const user = userEvent.setup()
    render(<Index servants={[servant]} materials={materials} items={items} />)
    const button = cardLevel(1)
    expect(button).toHaveTextContent(/^Lv –$/)

    button.focus()
    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(lvInput()).toHaveFocus())
    await user.keyboard('80')
    await user.tab()
    await user.keyboard('1{Enter}')
    await vi.waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(cardLevel(1)).toBe(button)
    expect(button).toHaveTextContent('Lv 80・宝具 1')
    await vi.waitFor(() => expect(button).toHaveFocus())
    expect(storedLevels()).toEqual({ '1': { lv: 80, npLv: 1 } })

    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(lvInput()).toHaveFocus())
    await user.clear(lvInput())
    await user.clear(npLvInput())
    await user.keyboard('{Enter}')
    await vi.waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(cardLevel(1)).toBe(button)
    expect(button).toHaveTextContent(/^Lv –$/)
    await vi.waitFor(() => expect(button).toHaveFocus())
  })
})

describe('Index - #svt- hash jump', () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView
  afterEach(() => {
    window.location.hash = ''
    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  // #126: smooth だと途中の数百枚を描かせて iOS のタブが落ちる
  it('jumps to the hashed servant card without smooth scrolling', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    window.location.hash = '#svt-1'
    render(<Index servants={[servant]} materials={materials} items={items} />)

    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('svt-1'))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })
})

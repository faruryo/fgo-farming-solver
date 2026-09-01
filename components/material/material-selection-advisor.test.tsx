// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MaterialSelectionAdvisor } from './material-selection-advisor'
import { INGREDIENT_COMMIT_DELAY_MS } from './event-craft-advisor'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { Item } from '../../interfaces/atlas-academy'
import { Drops } from '../../lib/get-drops'
import { DEFAULT_STOCK_BUFFER } from '../../lib/quest-efficiency'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: Record<string, unknown>) => {
      let str = fallback ?? _key
      if (options) {
        Object.entries(options).forEach(([k, v]) => {
          str = str.replace(`{{${k}}}`, String(v))
        })
      }
      return str
    },
  }),
}))

const mockDrops: Drops = {
  items: [
    {
      id: '07',
      category: '銅素材',
      largeCategory: '強化素材',
      shortName: '鉄杭',
      name: '宵哭きの鉄杭',
      icon: 'https://static.atlasacademy.io/JP/Items/6533.png',
      atlasId: 6533,
    },
    {
      id: '04',
      category: '銅素材',
      largeCategory: '強化素材',
      shortName: '鎖',
      name: '愚者の鎖',
      icon: 'https://static.atlasacademy.io/JP/Items/6522.png',
      atlasId: 6522,
    },
  ],
  quests: [
    {
      id: 'Q1',
      section: 'Free',
      area: 'Area1',
      name: 'Quest 1',
      ap: 20,
    },
  ],
  drop_rates: [
    {
      quest_id: 'Q1',
      item_id: '07',
      drop_rate: 1.0,
    },
    {
      quest_id: 'Q1',
      item_id: '04',
      drop_rate: 0.5,
    },
  ],
  campaigns: [],
}

let currentMockDrops: Drops & { isLoading?: boolean } = {
  ...mockDrops,
  isLoading: false,
}

vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => currentMockDrops,
}))

const mockItems: Item[] = [
  {
    id: 6533,
    name: '宵哭きの鉄杭',
    type: 'skillLvUp',
    uses: 'skill',
    detail: '',
    icon: 'https://static.atlasacademy.io/JP/Items/6533.png',
    background: 'bronze',
    priority: 100,
    dropPriority: 100,
  },
  {
    id: 6522,
    name: '愚者の鎖',
    type: 'skillLvUp',
    uses: 'skill',
    detail: '',
    icon: 'https://static.atlasacademy.io/JP/Items/6522.png',
    background: 'bronze',
    priority: 101,
    dropPriority: 101,
  },
]

const renderSummer2026Advisor = (
  amounts: Record<string, number> = { '6533': 1 },
  possession: Record<string, number> = { '6533': 0 },
) => {
  localStorage.setItem(
    STORAGE_KEYS.MATERIAL_ADVISOR_TAB,
    JSON.stringify('summer-2026'),
  )
  return render(
    <MaterialSelectionAdvisor
      items={mockItems}
      amounts={amounts}
      possession={possession}
    />,
  )
}

describe('MaterialSelectionAdvisor Component', () => {
  beforeEach(() => {
    localStorage.clear()
    currentMockDrops = { ...mockDrops, isLoading: false }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders tab switcher and switches between ticket advisor and event craft advisor', async () => {
    const user = userEvent.setup()

    render(
      <MaterialSelectionAdvisor
        items={mockItems}
        amounts={{ '6533': 10 }}
        possession={{ '6533': 0 }}
      />,
    )

    // Initial tab is ticket advisor
    expect(screen.getByText('毎月の交換券・配布')).toBeInTheDocument()
    expect(screen.getByText('水着2026 料理作成')).toBeInTheDocument()
    expect(screen.getByText('獲得可能総数')).toBeInTheDocument()

    // Switch to summer 2026 cooking tab
    await user.click(screen.getByText('水着2026 料理作成'))

    expect(screen.getByText('イベント食材所持数')).toBeInTheDocument()
    expect(screen.getByText('うちなー海鮮盛り')).toBeInTheDocument()
    expect(screen.getByText('うちなーお肉盛り')).toBeInTheDocument()
    expect(screen.getByText('うちなー野菜盛り')).toBeInTheDocument()
    expect(screen.getByText('食材を使い切る')).toBeInTheDocument()

    // Persisted tab in localStorage
    expect(localStorage.getItem(STORAGE_KEYS.MATERIAL_ADVISOR_TAB)).toBe(
      JSON.stringify('summer-2026'),
    )
  })

  it('shows effective required (training + stock buffer) and its breakdown when stock target is ON', async () => {
    localStorage.setItem(STORAGE_KEYS.STOCK_ENABLED, JSON.stringify(true))
    localStorage.setItem(
      STORAGE_KEYS.MATERIAL_SELECTION_ADVISOR,
      JSON.stringify({ candidateIds: ['6533'], total: 0, mode: 'ap' }),
    )

    // 本番では items = EnrichedItem[](category/largeCategory 付き)が渡される。
    // ここでも同じ形で渡し、mockDrops の '07'(銅素材/強化素材)と一致させる。
    const itemsWithCategory = mockItems.map(it => ({
      ...it,
      category: '銅素材',
      largeCategory: '強化素材',
    })) as unknown as Item[]

    render(
      <MaterialSelectionAdvisor
        items={itemsWithCategory}
        amounts={{ '6533': 100 }}
        possession={{ '6533': 50 }}
      />,
    )

    const bronzeBuffer = DEFAULT_STOCK_BUFFER.normal.bronze // 300
    expect(bronzeBuffer).toBe(300)
    const effectiveRequired = 100 + bronzeBuffer

    await waitFor(() => {
      expect(screen.getByText(`必要 ${effectiveRequired}`)).toBeInTheDocument()
      expect(
        screen.getByText(`(育成 100 + ストック ${bronzeBuffer})`),
      ).toBeInTheDocument()
    })
  })

  it('calculates event craft allocation when ingredients are entered', async () => {
    renderSummer2026Advisor({ '6533': 5 }, { '6533': 0 })

    // Initially 0 ingredients
    expect(screen.getByText(/お持ちのイベント食材数/)).toBeInTheDocument()

    // Enter ingredients for Goya Champuru (meat: 20, veg: 40)
    const inputs = screen.getAllByRole('spinbutton')
    // inputs: [seafood, meat, vegetable]
    vi.useFakeTimers()
    fireEvent.change(inputs[1], { target: { value: '60' } })
    fireEvent.change(inputs[2], { target: { value: '120' } })
    act(() => {
      vi.advanceTimersByTime(INGREDIENT_COMMIT_DELAY_MS)
    })
    vi.useRealTimers()

    await waitFor(() => {
      const runsCard = screen.getByRole('radio', { name: '周回を減らす' })
      expect(
        within(runsCard).getByText('ゴーヤーチャンプルー'),
      ).toBeInTheDocument()
      expect(within(runsCard).getByText('推奨 +3')).toBeInTheDocument()
      expect(
        screen.getByText(/最優先は「ゴーヤーチャンプルー」です/),
      ).toBeInTheDocument()
    })
  })

  it('shows surplus badges on the exhaust pattern card', async () => {
    renderSummer2026Advisor()

    // Enter enough ingredients for 2 Goya Champuru (meat: 40, veg: 80)
    const inputs = screen.getAllByRole('spinbutton')
    vi.useFakeTimers()
    fireEvent.change(inputs[1], { target: { value: '80' } })
    fireEvent.change(inputs[2], { target: { value: '160' } })
    act(() => {
      vi.advanceTimersByTime(INGREDIENT_COMMIT_DELAY_MS)
    })
    vi.useRealTimers()

    await waitFor(() => {
      const exhaustCard = screen.getByRole('radio', {
        name: '食材を使い切る',
      })
      expect(within(exhaustCard).getByText('推奨 +3')).toBeInTheDocument()
      expect(within(exhaustCard).getByText('余剰 +1')).toBeInTheDocument()
    })
  })

  it('renders target material names using translation keys in recipe cards', async () => {
    renderSummer2026Advisor()
    const inputs = screen.getAllByRole('spinbutton')
    vi.useFakeTimers()
    fireEvent.change(inputs[1], { target: { value: '60' } })
    fireEvent.change(inputs[2], { target: { value: '120' } })
    act(() => {
      vi.advanceTimersByTime(INGREDIENT_COMMIT_DELAY_MS)
    })
    vi.useRealTimers()

    await waitFor(() => {
      const runsCard = screen.getByRole('radio', { name: '周回を減らす' })
      expect(
        within(runsCard).getByText('(宵哭きの鉄杭)'),
      ).toBeInTheDocument()
      expect(
        within(runsCard).getByText('ゴーヤーチャンプルー'),
      ).toBeInTheDocument()
    })
  })

  it('renders loading message when drop data is loading', () => {
    currentMockDrops = { ...mockDrops, isLoading: true }
    renderSummer2026Advisor()

    expect(screen.getByText('ドロップデータを読み込み中です、先輩...')).toBeInTheDocument()
  })

  it('renders unavailable message when quests are empty', () => {
    currentMockDrops = { ...mockDrops, isLoading: false, quests: [] }
    renderSummer2026Advisor()

    expect(screen.getByText(/ドロップデータを取得できませんでした/)).toBeInTheDocument()
  })

  it('renders deficit savings formatted with unit', async () => {
    renderSummer2026Advisor()

    const inputs = screen.getAllByRole('spinbutton')
    vi.useFakeTimers()
    fireEvent.change(inputs[1], { target: { value: '60' } })
    fireEvent.change(inputs[2], { target: { value: '120' } })
    act(() => {
      vi.advanceTimersByTime(INGREDIENT_COMMIT_DELAY_MS)
    })
    vi.useRealTimers()

    await waitFor(() => {
      const runsCard = screen.getByRole('radio', { name: '周回を減らす' })
      expect(within(runsCard).getByText('−1 周')).toBeInTheDocument()
    })
  })
})

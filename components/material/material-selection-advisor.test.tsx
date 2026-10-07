// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MaterialSelectionAdvisor } from './material-selection-advisor'
import { latestCraftEventId } from '../../lib/event-features'
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

describe('MaterialSelectionAdvisor Component', () => {
  beforeEach(() => {
    localStorage.clear()
    currentMockDrops = { ...mockDrops, isLoading: false }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders only the ticket advisor with a link to the craft event page (no tabs)', () => {
    render(
      <MaterialSelectionAdvisor
        items={mockItems}
        amounts={{ '6533': 10 }}
        possession={{ '6533': 0 }}
      />,
    )

    expect(screen.getByText('獲得可能総数')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByText('イベント食材所持数')).toBeNull()

    const link = screen.getByRole('link', {
      name: '水着2026の料理作成はイベントページへ',
    })
    expect(link).toHaveAttribute('href', `/events/${latestCraftEventId()}`)
    expect(latestCraftEventId()).toBeDefined()
  })

  it('ignores a legacy summer-2026 tab value left in localStorage', () => {
    localStorage.setItem(
      'material/advisor-active-tab',
      JSON.stringify('summer-2026'),
    )

    render(
      <MaterialSelectionAdvisor
        items={mockItems}
        amounts={{ '6533': 10 }}
        possession={{ '6533': 0 }}
      />,
    )

    expect(screen.getByText('獲得可能総数')).toBeInTheDocument()
    expect(screen.queryByText('イベント食材所持数')).toBeNull()
    expect(localStorage.getItem('material/advisor-active-tab')).toBe(
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
    const itemsWithCategory = mockItems.map((it) => ({
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
    const effectiveRequired = Math.max(100, bronzeBuffer)

    await waitFor(() => {
      expect(screen.getByText(`必要 ${effectiveRequired}`)).toBeInTheDocument()
      expect(
        screen.getByText(`(育成 100 / 在庫基準 ${bronzeBuffer} の大きい方)`),
      ).toBeInTheDocument()
    })
  })
})

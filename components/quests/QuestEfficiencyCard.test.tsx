// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestEfficiencyCard } from './QuestEfficiencyCard'
import type { Drops } from '../../lib/get-drops'
import type { EfficiencyDenominator } from '../../lib/quest-efficiency'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

const mockDrops: Drops = {
  items: [
    {
      id: 'item1',
      name: '英雄の証',
      shortName: '証',
      category: '銅素材',
      largeCategory: '強化素材',
      atlasId: 6501,
    },
  ],
  quests: [
    {
      id: 'quest1',
      name: '未確認座標X-A',
      section: 'Fuyuki',
      ap: 10,
      area: '冬木',
    },
  ],
  drop_rates: [
    {
      quest_id: 'quest1',
      item_id: 'item1',
      drop_rate: 0.5,
    },
  ],
  campaigns: [],
}

let mockUseDropsResult = {
  ...mockDrops,
  isLoading: false,
}

vi.mock('../../hooks/use-drops', () => ({
  useDrops: () => mockUseDropsResult,
}))

let mockOptions = {
  possession: {} as Record<string, number | undefined>,
  materialResult: {} as Record<string, number>,
  itemsRaw: {} as Record<string, string | number | undefined>,
  stockEnabled: false,
  resolvedStockBuffer: {
    normal: { gold: 60, silver: 150, bronze: 300 },
    skillStone: { gold: 150, silver: 150, bronze: 150 },
    monumentPiece: { gold: 50, silver: 50 },
  },
  shortageOnly: true,
  setShortageOnly: vi.fn(),
  includeSkillStones: true,
  setIncludeSkillStones: vi.fn(),
  includePieces: true,
  setIncludePieces: vi.fn(),
  denominator: 'ap' as EfficiencyDenominator,
  setDenominator: vi.fn(),
  includeQp: false,
  setIncludeQp: vi.fn(),
  includeBond: false,
  setIncludeBond: vi.fn(),
  includeExp: false,
  setIncludeExp: vi.fn(),
}

vi.mock('../../hooks/use-quest-efficiency-options', () => ({
  useQuestEfficiencyOptions: () => mockOptions,
}))

vi.mock('../../hooks/use-active-campaigns', () => ({
  useActiveCampaigns: () => ({ activeCampaigns: [] }),
}))

describe('QuestEfficiencyCard', () => {
  beforeEach(() => {
    localStorage.clear()
    mockOptions = {
      ...mockOptions,
      possession: {},
      materialResult: {},
      itemsRaw: {},
      stockEnabled: false,
      shortageOnly: true,
      denominator: 'ap',
      setDenominator: vi.fn(),
    }
    mockUseDropsResult = {
      ...mockDrops,
      isLoading: false,
    }
  })

  it('不足素材がある場合、スコアと内訳が正しくレンダリングされる', () => {
    // 目標 10個、所持 0個 → 不足あり (score > 0)
    mockOptions.materialResult = { '6501': 10 }
    mockOptions.possession = { '6501': 0 }

    render(<QuestEfficiencyCard questId="quest1" />)

    expect(screen.getByText('AP効率ポイント')).toBeInTheDocument()
    expect(screen.getByText('英雄の証')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'ストック込み目標切り替え' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '周回効率' })).toBeInTheDocument()
  })

  it('周回効率のときは見出しが周回効率ポイントになり、詳細からAP効率へ切り替えられる', async () => {
    const user = userEvent.setup()
    mockOptions.denominator = 'turn'
    mockOptions.materialResult = { '6501': 10 }
    mockOptions.possession = { '6501': 0 }

    render(<QuestEfficiencyCard questId="quest1" />)

    expect(screen.getByText('周回効率ポイント')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'AP効率' }))
    expect(mockOptions.setDenominator).toHaveBeenCalledWith('ap')
  })

  it('スコアが0（充足済みで不足なし）の場合でもカードとトグルが表示され、空メッセージが表示される', () => {
    // 目標 10個、所持 500個（ストックバッファ300個以上） → 不足なし (score = 0)
    mockOptions.materialResult = { '6501': 10 }
    mockOptions.possession = { '6501': 500 }

    render(<QuestEfficiencyCard questId="quest1" />)

    expect(screen.getByText('AP効率ポイント')).toBeInTheDocument()
    expect(screen.getByText('0.00')).toBeInTheDocument()
    expect(screen.getByText('対象となる不足素材がありません')).toBeInTheDocument()
    // トグルボタンが表示されていることを確認
    expect(screen.getByRole('switch', { name: 'ストック込み目標切り替え' })).toBeInTheDocument()
  })
})

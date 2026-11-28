// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClassScoreIndex } from './index'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { getClassBoardData } from '../../lib/class-score/board-loader'
import { getPlayableSquareIds } from '../../lib/class-score/route-actions'
import { sumClassScoreMaterials } from '../../lib/class-score/sum'
import { DEFAULT_CLASS_SCORE_STATE, type ClassScoreState } from '../../lib/class-score/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, vars?: Record<string, string | number>) => {
      const values = new Map(Object.entries(vars ?? {}))
      return (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values.get(name) ?? ''))
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span role="img" aria-label={props.alt} />,
}))

const saberPlayables = getPlayableSquareIds(getClassBoardData('saber'))
const archerPlayables = getPlayableSquareIds(getClassBoardData('archer'))

const saveState = (state: ClassScoreState) =>
  localStorage.setItem(STORAGE_KEYS.CLASS_SCORE, JSON.stringify(state))

const readState = (): ClassScoreState =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASS_SCORE) ?? 'null') as ClassScoreState

const partialSaber = (): ClassScoreState => ({
  // 変更前の端末で部分目標を作ると none が保存されていた
  classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'none' },
  boards: { saber: { unlockedSquareIds: [saberPlayables[0]], targetSquareIds: saberPlayables.slice(0, 4) } },
})

const getCard = (heading: string): HTMLElement => {
  const h = screen.getByRole('heading', { name: heading })
  const card = h.closest('.rounded-xl')
  if (!(card instanceof HTMLElement)) throw new Error('card not found')
  return card
}

const getStatusButton = (card: HTMLElement): HTMLElement =>
  within(card).getAllByRole('button').find((b) => b.hasAttribute('aria-expanded')) as HTMLElement

describe('ClassScoreIndex', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('部分目標のクラスを目標に数え、カードに「n マス目標」とマス数を出す', async () => {
    saveState(partialSaber())
    render(<ClassScoreIndex />)

    const summaryCount = await screen.findByText((_, el) =>
      el?.tagName === 'SPAN' && /^目標:\s*1\s*\/\s*9$/.test(el.textContent ?? ''),
    )
    expect(summaryCount).toBeInTheDocument()
    expect(screen.getByText('合計必要QP')).toBeInTheDocument()

    const saber = getCard('セイバー')
    expect(within(saber).getByText('3マス目標')).toBeInTheDocument()
    expect(within(saber).queryByText('未設定')).not.toBeInTheDocument()
    expect(
      within(saber).getByText(`解放済 1・目標 3・残り ${saberPlayables.length - 4}`),
    ).toBeInTheDocument()
  })

  it('目標のカードは目標ぶん、未設定のカードは全マス解放ぶんを見出し付きで出し、目標のカードの合計がサマリーと一致する', async () => {
    const state: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, berserker: 'target' },
      boards: {
        saber: { unlockedSquareIds: [], targetSquareIds: saberPlayables.slice(0, 6) },
        lancer: { unlockedSquareIds: [], targetSquareIds: [] },
      },
    }
    saveState(state)
    render(<ClassScoreIndex />)

    const saber = getCard('セイバー')
    await within(saber).findByText('目標ぶんに必要')
    const saberQp = Number(within(saber).getByTestId('class-card-qp').dataset.value)
    expect(saberQp).toBeGreaterThan(0)
    expect(saberQp).toBeLessThan(317_000_000)

    const archer = getCard('アーチャー')
    expect(within(archer).getByText('全マス解放に必要')).toBeInTheDocument()
    expect(within(archer).queryByText('目標ぶんに必要')).not.toBeInTheDocument()
    expect(Number(within(archer).getByTestId('class-card-qp').dataset.value)).toBe(317_000_000)

    const targetCardsQp = ['セイバー', 'バーサーカー']
      .map((name) => Number(within(getCard(name)).getByTestId('class-card-qp').dataset.value))
      .reduce((a, b) => a + b, 0)
    expect(targetCardsQp).toBe(sumClassScoreMaterials(state)['1'])
  })

  it('状態の表示を押す前は操作を出さず、押すとクラス全体への3つの操作を出す。盤面マップへのリンクは常に出す', async () => {
    const user = userEvent.setup()
    render(<ClassScoreIndex />)
    const archer = getCard('アーチャー')

    expect(within(archer).getByRole('link', { name: '盤面マップで個別指定' })).toBeInTheDocument()
    expect(within(archer).queryByRole('button', { name: /全マスを目標に/ })).not.toBeInTheDocument()
    expect(within(archer).queryByRole('button', { name: /全マスを解放済に/ })).not.toBeInTheDocument()
    expect(within(archer).queryByRole('button', { name: /すべて外す/ })).not.toBeInTheDocument()

    await user.click(getStatusButton(archer))
    expect(within(archer).getByRole('button', { name: /全マスを目標に/ })).toBeInTheDocument()
    expect(within(archer).getByRole('button', { name: /全マスを解放済に/ })).toBeInTheDocument()
    expect(within(archer).getByRole('button', { name: /すべて外す/ })).toBeInTheDocument()
    expect(within(archer).getByRole('link', { name: '盤面マップで個別指定' })).toBeInTheDocument()
  })

  it('「全マスを目標に」「全マスを解放済に」「すべて外す」がクラス全体に効く', async () => {
    const user = userEvent.setup()
    render(<ClassScoreIndex />)
    const archer = getCard('アーチャー')

    await user.click(getStatusButton(archer))
    await user.click(within(archer).getByRole('button', { name: /全マスを目標に/ }))
    expect(readState().classes.archer).toBe('target')
    expect(readState().boards?.archer?.targetSquareIds).toHaveLength(archerPlayables.length)
    expect(within(archer).getByText('全マス目標')).toBeInTheDocument()
    expect(within(archer).queryByRole('button', { name: /すべて外す/ })).not.toBeInTheDocument()

    await user.click(getStatusButton(archer))
    await user.click(within(archer).getByRole('button', { name: /全マスを解放済に/ }))
    expect(readState().classes.archer).toBe('completed')
    expect(readState().boards?.archer?.unlockedSquareIds).toHaveLength(archerPlayables.length)
    expect(within(archer).getByText('解放済')).toBeInTheDocument()

    await user.click(getStatusButton(archer))
    await user.click(within(archer).getByRole('button', { name: /すべて外す/ }))
    expect(readState().classes.archer).toBe('none')
    expect(readState().boards?.archer).toBeUndefined()
    expect(within(archer).getByText('未設定')).toBeInTheDocument()
  })
})

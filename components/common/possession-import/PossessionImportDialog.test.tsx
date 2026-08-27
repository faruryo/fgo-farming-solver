// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PossessionImportDialog } from './PossessionImportDialog'
import type { CardCandidate } from '../../../lib/possession-import/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: { count?: number }) => {
      const base = fallback ?? key
      if (options?.count != null) return base.replaceAll('{{count}}', String(options.count))
      return base
    },
  }),
}))

vi.mock('../../../lib/possession-import/analyze-screenshot', () => ({
  analyzeScreenshot: vi.fn(),
}))
import { analyzeScreenshot } from '../../../lib/possession-import/analyze-screenshot'

const card = (atlasId: number, name: string, quantity: number | null): CardCandidate => ({
  sourceImageIndex: 0,
  region: { x: 0, y: 0, width: 100, height: 100, clipped: false },
  ocrLines: [],
  atlasId,
  matchedName: name,
  quantity,
  clipped: false,
  cropDataUrl: '',
})

const items = [
  { id: '101', name: 'アイテムA', atlasId: 101 },
  { id: '202', name: 'アイテムB', atlasId: 202 },
  { id: '303', name: 'アイテムC', atlasId: 303 },
]

const rowOf = (name: string) => screen.getByText(name).closest('[data-review-row]') as HTMLElement

/** ダイアログを開き、画像1枚を投稿→解析して review 段階まで進める。 */
const reachReview = async (
  candidates: CardCandidate[],
  overrides: Partial<React.ComponentProps<typeof PossessionImportDialog>> = {}
) => {
  ;(analyzeScreenshot as Mock).mockResolvedValue(candidates)
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  const user = userEvent.setup()
  render(
    <PossessionImportDialog
      open
      onOpenChange={onOpenChange}
      items={items}
      possession={{ '101': 3 }}
      onConfirm={onConfirm}
      {...overrides}
    />
  )

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(fileInput, new File(['x'], 'shot.png', { type: 'image/png' }))
  await user.click(screen.getByRole('button', { name: '解析する' }))
  await screen.findByRole('button', { name: '反映する' })

  return { user, onConfirm, onOpenChange }
}

describe('PossessionImportDialog レビューUI', () => {
  beforeEach(() => vi.clearAllMocks())

  it('確定: 除外されていない候補の値で onConfirm を呼び、ダイアログを閉じる', async () => {
    const { user, onConfirm, onOpenChange } = await reachReview([
      card(101, 'アイテムA', 5),
      card(202, 'アイテムB', 10),
    ])

    expect(screen.getByText('アイテムA')).toBeInTheDocument()
    expect(screen.getByText('アイテムB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '反映する' }))

    expect(onConfirm).toHaveBeenCalledWith({ '101': 5, '202': 10 })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('修正: 編集した値が確定時に採用され、小数は切り捨てられる', async () => {
    const { user, onConfirm } = await reachReview([
      card(101, 'アイテムA', 5),
      card(202, 'アイテムB', 10),
    ])

    const inputA = within(rowOf('アイテムA')).getByRole('spinbutton')
    await user.clear(inputA)
    await user.type(inputA, '7.9')

    await user.click(screen.getByRole('button', { name: '反映する' }))

    expect(onConfirm).toHaveBeenCalledWith({ '101': 7, '202': 10 })
  })

  it('修正: 値を空にした候補は確定対象から外れる', async () => {
    const { user, onConfirm } = await reachReview([
      card(101, 'アイテムA', 5),
      card(202, 'アイテムB', 10),
    ])

    const inputA = within(rowOf('アイテムA')).getByRole('spinbutton')
    await user.clear(inputA)

    await user.click(screen.getByRole('button', { name: '反映する' }))

    expect(onConfirm).toHaveBeenCalledWith({ '202': 10 })
  })

  it('除外: チェックを外した候補は onConfirm に含まれない', async () => {
    const { user, onConfirm } = await reachReview([
      card(101, 'アイテムA', 5),
      card(202, 'アイテムB', 10),
    ])

    await user.click(within(rowOf('アイテムB')).getByRole('checkbox'))

    await user.click(screen.getByRole('button', { name: '反映する' }))

    expect(onConfirm).toHaveBeenCalledWith({ '101': 5 })
  })

  it('キャンセル: 反映せず閉じ、onConfirm は呼ばれない', async () => {
    const { user, onConfirm, onOpenChange } = await reachReview([
      card(101, 'アイテムA', 5),
    ])

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('矛盾候補: 数量欄が空で、手動入力するまで確定対象に含まれない', async () => {
    const { user, onConfirm } = await reachReview([
      card(101, 'アイテムA', 5),
      card(101, 'アイテムA', 8),
    ])

    expect(screen.getByText('矛盾あり')).toBeInTheDocument()
    const input = within(rowOf('アイテムA')).getByRole('spinbutton')
    expect(input.value).toBe('')

    await user.click(screen.getByRole('button', { name: '反映する' }))
    expect(onConfirm).toHaveBeenCalledWith({})
  })

  it('ゼロ件: 認識できたアイテムがない旨を表示し、確定を無効化する', async () => {
    await reachReview([])

    expect(screen.getByText('認識できたアイテムがありません')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '反映する' })).toBeDisabled()
  })

  it('要確認候補のみ、元画像クロップをオンデマンド表示できる', async () => {
    const clipped: CardCandidate = { ...card(101, 'アイテムA', 5), clipped: true }
    const { user } = await reachReview([clipped])

    const row = rowOf('アイテムA')
    expect(within(row).queryByRole('img', { name: 'アイテムA' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '元画像を確認' }))
    expect(screen.getByRole('img', { name: 'アイテムA' })).toBeInTheDocument()
  })

  it('増加・減少・変更なしを見分け、変更なしは初期折りたたみ、フィルタで隠せる', async () => {
    const { user } = await reachReview(
      [card(101, 'アイテムA', 5), card(202, 'アイテムB', 0), card(303, 'アイテムC', 1)],
      { possession: { '101': 3, '202': 0, '303': 8 } }
    )

    expect(rowOf('アイテムA')).toHaveAttribute('data-review-section', 'increase')
    expect(within(rowOf('アイテムA')).getByTestId('import-review-sign-badge')).toHaveTextContent('+2')
    expect(rowOf('アイテムC')).toHaveAttribute('data-review-section', 'decrease')
    expect(within(rowOf('アイテムC')).getByTestId('import-review-sign-badge')).toHaveTextContent('-7')

    expect(screen.queryByText('アイテムB')).not.toBeInTheDocument()
    expect(screen.getByTestId('import-review-count-unchanged')).toHaveTextContent('変更なし 1')
    expect(screen.getByRole('button', { name: /変更なし/ })).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: '変更あり' }))
    expect(screen.queryByRole('button', { name: /変更なし/ })).not.toBeInTheDocument()
    expect(screen.getByText('アイテムA')).toBeInTheDocument()
    expect(screen.getByText('アイテムC')).toBeInTheDocument()
  })

  it('値の編集で分類が移る', async () => {
    const { user } = await reachReview([card(101, 'アイテムA', 5)])

    expect(rowOf('アイテムA')).toHaveAttribute('data-review-section', 'increase')
    const inputA = within(rowOf('アイテムA')).getByRole('spinbutton')
    await user.clear(inputA)
    await user.type(inputA, '3')

    expect(rowOf('アイテムA')).toHaveAttribute('data-review-section', 'unchanged')
    expect(within(rowOf('アイテムA')).queryByTestId('import-review-sign-badge')).toBeNull()
  })

  it('折りたたみ中でも除外していない変更なし行は確定対象', async () => {
    const { user, onConfirm } = await reachReview(
      [card(101, 'アイテムA', 5), card(202, 'アイテムB', 0)],
      { possession: { '101': 3, '202': 0 } }
    )

    expect(screen.queryByText('アイテムB')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '反映する' }))
    expect(onConfirm).toHaveBeenCalledWith({ '101': 5, '202': 0 })
  })

  it('変更ありフィルタ中でも除外していない変更なし行は確定対象', async () => {
    const { user, onConfirm } = await reachReview(
      [card(101, 'アイテムA', 5), card(202, 'アイテムB', 0)],
      { possession: { '101': 3, '202': 0 } }
    )

    await user.click(screen.getByRole('button', { name: '変更あり' }))
    expect(screen.queryByText('アイテムB')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '反映する' }))
    expect(onConfirm).toHaveBeenCalledWith({ '101': 5, '202': 0 })
  })
})

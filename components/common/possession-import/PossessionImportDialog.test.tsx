// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PossessionImportDialog } from './PossessionImportDialog'
import type { CardCandidate } from '../../../lib/possession-import/types'

// t は翻訳キー（このリポジトリでは日本語文字列そのもの）をそのまま返す identity にする。
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// OCR 本体は重く DOM/Canvas 依存なのでモックし、レビュー段階へ渡す候補を制御する。
// merge-candidates は純粋関数なので実物をそのまま通す。
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
]

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

  // Dialog は document.body へポータルされるため container ではなく document から探す
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(fileInput, new File(['x'], 'shot.png', { type: 'image/png' }))
  await user.click(screen.getByRole('button', { name: '解析する' }))
  // analyzing → review へ遷移するのを待つ
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

    // 現在値（101 は possession=3、202 は未所持=0）が表示される
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

    const [inputA] = screen.getAllByRole('spinbutton') as HTMLInputElement[]
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

    const [inputA] = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    await user.clear(inputA)

    await user.click(screen.getByRole('button', { name: '反映する' }))

    expect(onConfirm).toHaveBeenCalledWith({ '202': 10 })
  })

  it('除外: チェックを外した候補は onConfirm に含まれない', async () => {
    const { user, onConfirm } = await reachReview([
      card(101, 'アイテムA', 5),
      card(202, 'アイテムB', 10),
    ])

    // 行の並びは候補順（101, 202）。202 のチェックを外す
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

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
    // 同一 atlasId で異なる数量 → mergeCandidates が hasConflict=true, proposedQuantity=null にする
    const { user, onConfirm } = await reachReview([
      card(101, 'アイテムA', 5),
      card(101, 'アイテムA', 8),
    ])

    expect(screen.getByText('矛盾あり')).toBeInTheDocument()
    const [input] = screen.getAllByRole('spinbutton') as HTMLInputElement[]
    expect(input.value).toBe('')

    // 未入力のまま確定 → 何も更新されない
    await user.click(screen.getByRole('button', { name: '反映する' }))
    expect(onConfirm).toHaveBeenCalledWith({})
  })

  it('ゼロ件: 認識できたアイテムがない旨を表示し、確定を無効化する', async () => {
    await reachReview([])

    expect(screen.getByText('認識できたアイテムがありません')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '反映する' })).toBeDisabled()
  })

  it('要確認候補のみ、元画像クロップをオンデマンド表示できる', async () => {
    // 見切れカード（clipped=true）→ needsReview=true
    const clipped: CardCandidate = { ...card(101, 'アイテムA', 5), clipped: true }
    const { user } = await reachReview([clipped])

    const row = screen.getByText('アイテムA').closest('div') as HTMLElement
    // 既定ではクロップ画像は出ていない
    expect(within(row.parentElement as HTMLElement).queryByRole('img', { name: 'アイテムA' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '元画像を確認' }))
    expect(screen.getByRole('img', { name: 'アイテムA' })).toBeInTheDocument()
  })
})

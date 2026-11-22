// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Index } from './index'
import { makeItem, makeMaterialCatalogServant, makeMaterials } from './test-fixtures'
import type { ChaldeaState, ServantState } from '../../hooks/create-chaldea-state'
import type { RosterImportResult, RosterProgress, RosterRow, SkillLevels } from '../../lib/servant-roster-import/types'

// 一覧をまるごと描くので、全ファイルを同時に流す実行では1件が既定の 5 秒を超えることがある。
vi.setConfig({ testTimeout: 30_000 })

const analyzeMock = vi.hoisted(() => ({ fn: vi.fn() }))

// 文字認識と顔の照合はモックし、入口・確かめの画面・保存値への書き込みだけを見る。
vi.mock('../../lib/servant-roster-import/analyze', () => ({
  analyzeRosterScreenshots: (...args: unknown[]) => analyzeMock.fn(...args) as unknown,
}))

vi.mock('react-i18next', async () => (await import('../i18n-test-utils')).translationMock())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const NAMES = ['アルトリア', 'マシュ', 'マーリン', 'エミヤ', 'マシュ']
const servants = Array.from({ length: 20 }, (_, i) =>
  makeMaterialCatalogServant({ id: i + 1, collectionNo: i + 1, name: NAMES.at(i) ?? `サーヴァント${i + 1}` }),
)
/** 同名でクラスだけが違うサーヴァント（玉藻の前のキャスターとランサーのような組） */
const MASH_CASTER = 5
servants[MASH_CASTER - 1] = { ...servants[MASH_CASTER - 1], className: 'caster' }
const ARTORIA = 1
const MASH = 2
const MERLIN = 3
const items = [makeItem({ id: 100 })]
const materials = Object.fromEntries(servants.map(s => [String(s.id), makeMaterials()]))

const LEVELS_KEY = 'servantLevels'
const CROP = 'data:image/png;base64,CROP'

const matched = (servantId: number, lv: number | null, npLv: number | null, skills: SkillLevels | null = null): RosterRow => ({
  key: `svt-${servantId}`,
  servantId,
  lv,
  npLv,
  skills,
  review: null,
  crop: CROP,
})

type Review = NonNullable<RosterRow['review']>
const needsReview = (key: string, row: Partial<Omit<RosterRow, 'review'>>, review: Partial<Review>): RosterRow => ({
  key,
  servantId: null,
  lv: null,
  npLv: null,
  skills: null,
  crop: CROP,
  ...row,
  review: {
    reasons: [],
    undecided: [],
    servantCandidates: [],
    lvCandidates: [],
    npLvCandidates: [],
    lvRange: null,
    npLvRange: null,
    undecidedSkills: [],
    skillCandidates: [[], [], []],
    ...review,
  },
})

const done = (rows: RosterRow[], overrides: Partial<Extract<RosterImportResult, { kind: 'done' }>> = {}): RosterImportResult => ({
  kind: 'done',
  imageCount: 1,
  unreadableImages: [],
  wideColumnImages: [],
  unsortedImageCount: 0,
  shortfall: null,
  rows,
  ...overrides,
})

const image = (name: string) => new File(['x'], name, { type: 'image/png' })
const renderIndex = () => render(<Index servants={servants} materials={materials} items={items} />)
const openButton = () => screen.getByRole('button', { name: 'スクリーンショットから取り込む' })
const chooseFiles = (files: File[]) => fireEvent.change(screen.getByTestId('roster-import-file-input'), { target: { files } })
const analyzeButton = () => screen.getByRole('button', { name: '読み取る' })
const confirmButton = () => screen.getByRole('button', { name: '確定する' })

/** 入口から画像を選んで読み取り、確かめの画面を出す */
const importWith = async (result: RosterImportResult, files = [image('a.png')]) => {
  analyzeMock.fn.mockResolvedValue(result)
  fireEvent.click(openButton())
  chooseFiles(files)
  await act(async () => {
    fireEvent.click(analyzeButton())
  })
}

const expandMatched = () => fireEvent.click(screen.getByRole('button', { name: /^読み取れたサーヴァント（/ }))
const rowOf = (checkboxName: string): HTMLElement => {
  const row = screen.getByRole('checkbox', { name: checkboxName }).closest('li')
  if (!row) throw new Error(`row ${checkboxName} not found`)
  return row
}
const reviewRowAt = (k: number): HTMLElement => {
  const row = screen.getAllByTestId('roster-import-row').at(k)
  if (!row) throw new Error(`row ${k} not found`)
  return row
}
const chooseServant = (row: HTMLElement, query: string, name: string) => {
  fireEvent.click(within(row).getByRole('button', { name: 'サーヴァントを選ぶ' }))
  fireEvent.change(within(row).getByRole('textbox', { name: '名前で絞り込む' }), { target: { value: query } })
  fireEvent.click(within(row).getByRole('button', { name }))
}
const setValue = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

const storedLevels = (): unknown => JSON.parse(localStorage.getItem(LEVELS_KEY) ?? 'null')
const storedMaterial = (): ChaldeaState => JSON.parse(localStorage.getItem('material') ?? '{}') as ChaldeaState
const servantOf = (state: ChaldeaState, id: number): ServantState | undefined => new Map(Object.entries(state)).get(String(id))
const planned = (disabled: boolean): ServantState => ({
  disabled,
  targets: {
    ascension: { disabled: false, ranges: [{ start: 2, end: 4 }] },
    skill: { disabled: false, ranges: [{ start: 6, end: 10 }, { start: 7, end: 10 }, { start: 8, end: 10 }] },
    appendSkill: { disabled: false, ranges: [1, 2, 3, 4, 5].map(n => ({ start: n % 3, end: 10 })) },
  },
})

beforeEach(() => {
  localStorage.clear()
  analyzeMock.fn.mockReset()
})
afterEach(() => localStorage.clear())

describe('スクリーンショットから取り込む入口', () => {
  it('撮る画面の案内: 入口を開くと「宝具Lv.順」で撮る案内と「Lv.順」の扱いが出て、画像を選ぶまで読み取らない', () => {
    renderIndex()
    fireEvent.click(openButton())
    expect(screen.getByText(/並びを「宝具Lv.順」にして、上から下まで少しずつ重ねて撮ってください/)).toBeInTheDocument()
    expect(screen.getByText('「Lv.順」の画像も読めますが、その画像からは Lv だけを取り込みます。')).toBeInTheDocument()
    expect(screen.getByText(/「サーヴァントスキル強化」でサーヴァントを選ぶ画面は、7列の表示で同じように撮ってください。宝具Lv とスキルLv を読み取り/)).toBeInTheDocument()
    expect(screen.getByText(/6列・5列の表示は読み取れません。$/)).toBeInTheDocument()
    expect(screen.getByText(/サーヴァント強化・サーヴァントスキル強化の選択画面のスクリーンショットから、所持サーヴァントと Lv・宝具Lv・スキルLv を読み取ります/)).toBeInTheDocument()
    expect(analyzeButton()).toBeDisabled()
    expect(analyzeMock.fn).not.toHaveBeenCalled()
  })

  it('複数枚を選ぶ: 3枚を順に読み、何枚目かを出し、読み終えると確かめの画面を出す', async () => {
    let progress: ((p: RosterProgress) => void) | undefined
    let finish: ((r: RosterImportResult) => void) | undefined
    analyzeMock.fn.mockImplementation((_files: File[], options: { onProgress: (p: RosterProgress) => void }) => {
      progress = options.onProgress
      return new Promise<RosterImportResult>(resolve => {
        finish = resolve
      })
    })
    renderIndex()
    fireEvent.click(openButton())
    chooseFiles([image('1.png'), image('2.png'), image('3.png')])
    await act(async () => {
      fireEvent.click(analyzeButton())
    })
    expect(screen.getByText('照合用のデータを読み込んでいます…')).toBeInTheDocument()
    act(() => progress?.({ phase: 'image', current: 2, total: 3 }))
    expect(screen.getByText('画像を読み取っています 2 / 3')).toBeInTheDocument()
    const [files, options] = analyzeMock.fn.mock.calls[0] as [
      File[],
      { servants: unknown[]; stored: unknown; storedSkills: Record<string, number[]> },
    ]
    expect(files.map(f => f.name)).toEqual(['1.png', '2.png', '3.png'])
    expect(options.servants).toHaveLength(20)
    expect(options.servants[0]).toEqual({ id: 1, rarity: 5 })
    // 育成計算機のスキルの今の値（一度も操作していないサーヴァントは 1・1・1）を渡す
    expect(options.storedSkills['1']).toEqual([1, 1, 1])
    expect(options.storedSkills).not.toHaveProperty('all')
    await act(async () => finish?.(done([matched(MASH, 90, 2)], { imageCount: 3 })))
    expect(screen.getByText('3枚を読みました')).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
  })

  it('画像でないファイル: 除いたことを知らせ、画像だけを読み取る', async () => {
    renderIndex()
    analyzeMock.fn.mockResolvedValue(done([]))
    fireEvent.click(openButton())
    chooseFiles([image('1.png'), new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }), image('2.png')])
    expect(screen.getByText('画像でないファイルを除きました: doc.pdf')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(analyzeButton())
    })
    const [files] = analyzeMock.fn.mock.calls[0] as [File[]]
    expect(files.map(f => f.name)).toEqual(['1.png', '2.png'])
  })
})

describe('照合用のデータを読み込めない', () => {
  it('行を出さず、時間をおいてやり直すよう知らせ、保存値を変えない', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(true) }))
    renderIndex()
    const before = localStorage.getItem('material')
    await importWith({ kind: 'icons-unavailable' })
    expect(screen.getByText('照合用のデータを読み込めませんでした。時間をおいてやり直してください。')).toBeInTheDocument()
    expect(screen.queryAllByTestId('roster-import-row')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: '確定する' })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: '閉じる' })[0])
    expect(localStorage.getItem('material')).toBe(before)
    expect(localStorage.getItem(LEVELS_KEY)).toBeNull()
  })
})

describe('取り込む前の確かめ', () => {
  it('まとめ: 読んだ枚数・当てた数・要確認の数・新しく所持になる数・読めなかった画像・並びを読めなかった枚数・撮り漏れを出す', async () => {
    localStorage.setItem('material', JSON.stringify({ [ARTORIA]: planned(false) }))
    renderIndex()
    await importWith(
      done([matched(ARTORIA, 90, 2), matched(MASH, 80, 1), matched(MERLIN, 70, null), needsReview('r1', {}, { reasons: ['unknown-face'] })], {
        imageCount: 12,
        unreadableImages: ['IMG_0412.png'],
        unsortedImageCount: 1,
        shortfall: { owned: 554, read: 546 },
      }),
    )
    expect(screen.getByText('12枚を読みました')).toBeInTheDocument()
    expect(screen.getByText('読み取れた 3 騎 / 要確認 1 件')).toBeInTheDocument()
    expect(screen.getByText('新しく所持になる 2 騎')).toBeInTheDocument()
    expect(screen.getByText('読めなかった画像: 1枚（IMG_0412.png）')).toBeInTheDocument()
    expect(screen.getByText('並びを読めなかった画像: 1枚（この画像は並び順の検査をしていません）')).toBeInTheDocument()
    expect(screen.getByText('所持サーヴァント 554 のうち 546 枚を読みました。撮り漏れがないか確かめてください')).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
  })

  it('6列・5列の表示の画像: 列数ごとに画像の名前を添えて7列の表示で撮るよう赤字で知らせ、読めなかった画像の知らせとは別にする', async () => {
    renderIndex()
    await importWith(
      done([matched(MASH, 80, 1)], { imageCount: 4, wideColumnImages: [{ columns: 5, name: 'IMG_1.png' }, { columns: 6, name: 'IMG_4.png' }, { columns: 5, name: 'IMG_2.png' }], unreadableImages: ['IMG_3.png'] }),
    )
    const notice = screen.getByText('5列の表示は読み取れません。7列の表示で撮ってください: IMG_1.png、IMG_2.png')
    expect(notice).toHaveStyle({ color: 'var(--red)' })
    expect(screen.getByText('6列の表示は読み取れません。7列の表示で撮ってください: IMG_4.png')).toHaveStyle({ color: 'var(--red)' })
    expect(screen.getByText('読めなかった画像: 1枚（IMG_3.png）')).toBeInTheDocument()
  })

  it('6列・5列の表示の画像が無いときは知らせない', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 80, 1)]))
    expect(screen.queryByText(/列の表示は読み取れません。7列の表示で撮ってください/)).not.toBeInTheDocument()
  })

  it('すべて6列・5列の表示の画像: 読み取れたサーヴァントが無い表示と知らせを出し、確定できない', async () => {
    renderIndex()
    await importWith(done([], { imageCount: 1, wideColumnImages: [{ columns: 6, name: 'a.png' }] }))
    expect(screen.getByText('読み取れたサーヴァントがありません')).toBeInTheDocument()
    expect(screen.getByText('6列の表示は読み取れません。7列の表示で撮ってください: a.png')).toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
  })

  it('「要確認」の行を先に出し、理由と切り抜きを添え、当てた行は畳んで件数を出す', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 80, 1), needsReview('r1', {}, { reasons: ['ambiguous-face'], servantCandidates: [MERLIN, ARTORIA] })]))
    expect(screen.getByText('要確認（1）')).toBeInTheDocument()
    expect(screen.getAllByTestId('roster-import-row')).toHaveLength(1)
    const row = reviewRowAt(0)
    expect(within(row).getByText('顔の差が小さい')).toBeInTheDocument()
    expect(within(row).getByAltText('元の画像のカード')).toHaveAttribute('src', CROP)
    expect(within(row).getByRole('checkbox')).not.toBeChecked()
    expandMatched()
    expect(screen.getAllByTestId('roster-import-row')).toHaveLength(2)
    expect(within(rowOf('マシュ を取り込みに入れる')).getByText('マシュ')).toBeInTheDocument()
  })

  it('当てた行を確定する: 20騎を取り込む', async () => {
    renderIndex()
    await importWith(done(servants.map(s => matched(s.id, 90, 2))))
    expect(screen.getByText('新しく所持になる 20 騎')).toBeInTheDocument()
    fireEvent.click(confirmButton())
    const levels = storedLevels()
    expect(Object.keys(levels as object)).toHaveLength(20)
    const material = storedMaterial()
    expect(servants.every(s => servantOf(material, s.id)?.disabled === false)).toBe(true)
  })

  it('要確認の行を直して入れる: 名前で絞り込んでサーヴァントを選び、空の Lv を入れると印が付き、その値で取り込む', async () => {
    renderIndex()
    await importWith(done([needsReview('r1', { npLv: 3 }, { reasons: ['unknown-face'], undecided: ['lv'] })]))
    const row = reviewRowAt(0)
    expect(confirmButton()).toBeDisabled()
    chooseServant(row, 'マー', 'セイバーマーリン')
    const checkbox = within(row).getByRole('checkbox', { name: 'マーリン を取り込みに入れる' })
    expect(checkbox).not.toBeChecked()
    setValue('マーリン の Lv', '90')
    expect(checkbox).toBeChecked()
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [MERLIN]: { lv: 90, npLv: 3 } })
    expect(servantOf(storedMaterial(), MERLIN)?.disabled).toBe(false)
  })

  it('名前で絞り込むと、名前に合うサーヴァントだけが並ぶ', async () => {
    renderIndex()
    await importWith(done([needsReview('r1', {}, { reasons: ['unknown-face'] })]))
    const row = reviewRowAt(0)
    fireEvent.click(within(row).getByRole('button', { name: 'サーヴァントを選ぶ' }))
    fireEvent.change(within(row).getByRole('textbox', { name: '名前で絞り込む' }), { target: { value: 'マ' } })
    expect(within(row).getByRole('button', { name: 'セイバーマシュ' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'セイバーマーリン' })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'セイバーアルトリア' })).not.toBeInTheDocument()
  })

  it('同名のサーヴァントは候補と選んだ後の表示でクラスを見分けられる', async () => {
    renderIndex()
    await importWith(done([needsReview('r1', {}, { reasons: ['unknown-face'] })]))
    const row = reviewRowAt(0)
    chooseServant(row, 'マシュ', 'キャスターマシュ')
    expect(within(row).getByAltText('キャスター')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'サーヴァントを選ぶ' }))
    fireEvent.change(within(row).getByRole('textbox', { name: '名前で絞り込む' }), { target: { value: 'マシュ' } })
    expect(within(row).getByRole('button', { name: 'セイバーマシュ' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'キャスターマシュ' })).toBeInTheDocument()
  })

  it('要確認のまま確定する: その行は取り込まず、当てた行だけを取り込む', async () => {
    renderIndex()
    await importWith(
      done([matched(MASH, 80, 1), needsReview('r1', {}, { reasons: ['ambiguous-face'], servantCandidates: [MERLIN] })]),
    )
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [MASH]: { lv: 80, npLv: 1 } })
    expect(servantOf(storedMaterial(), MERLIN)?.disabled).toBe(true)
  })

  it('行を外す: 外した行のサーヴァントの保存値を変えない', async () => {
    localStorage.setItem(LEVELS_KEY, JSON.stringify({ [MASH]: { lv: 70 } }))
    renderIndex()
    await importWith(done([matched(MASH, 80, 1), matched(MERLIN, 90, 2)]))
    expandMatched()
    fireEvent.click(screen.getByRole('checkbox', { name: 'マシュ を取り込みに入れる' }))
    expect(screen.getByText('新しく所持になる 1 騎')).toBeInTheDocument()
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [MASH]: { lv: 70 }, [MERLIN]: { lv: 90, npLv: 2 } })
    expect(servantOf(storedMaterial(), MASH)?.disabled).toBe(true)
  })

  it('候補を選んで入れる: 宝具Lv の候補 5 を押すと空の欄に入り、印が付き、宝具Lv 5 で取り込む', async () => {
    renderIndex()
    await importWith(
      done([needsReview('r1', { servantId: ARTORIA, lv: 90 }, { reasons: ['sort-order'], undecided: ['npLv'], npLvCandidates: [5, 3] })]),
    )
    const row = reviewRowAt(0)
    expect(within(row).getByText('並び順に合わない')).toBeInTheDocument()
    const input = within(row).getByLabelText('アルトリア の 宝具Lv')
    expect(input).toHaveValue('')
    fireEvent.click(within(row).getByRole('button', { name: '5' }))
    expect(input).toHaveValue('5')
    expect(within(row).getByRole('checkbox')).toBeChecked()
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [ARTORIA]: { lv: 90, npLv: 5 } })
  })

  it('範囲だけが分かるときは欄の横に範囲を出す', async () => {
    renderIndex()
    await importWith(
      done([needsReview('r1', { servantId: ARTORIA }, { reasons: ['sort-order'], undecided: ['lv'], lvRange: { min: 65, max: 70 } })]),
    )
    expect(within(reviewRowAt(0)).getByText('65〜70 のはず')).toBeInTheDocument()
  })

  it('候補に触れずに確定する: 前に取り込んだ値より低い行は取り込まず、保存値を変えない', async () => {
    localStorage.setItem(LEVELS_KEY, JSON.stringify({ [MERLIN]: { lv: 90, npLv: 2 } }))
    renderIndex()
    await importWith(
      done([
        matched(MASH, 80, 1),
        needsReview('r1', { servantId: MERLIN, npLv: 2 }, { reasons: ['lower-than-saved'], undecided: ['lv'], lvCandidates: [80, 90] }),
      ]),
    )
    const row = reviewRowAt(0)
    expect(within(row).getByText('前に取り込んだ値より低い')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: '80' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: '90' })).toBeInTheDocument()
    expect(within(row).getByRole('checkbox')).toHaveAttribute('data-disabled')
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [MERLIN]: { lv: 90, npLv: 2 }, [MASH]: { lv: 80, npLv: 1 } })
  })

  it('同じサーヴァントに2つの行: 確定できず、重なりを知らせる。片方を外すと確定でき、残した行だけを取り込む', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 80, 1), needsReview('r1', { lv: 90, npLv: 2 }, { reasons: ['ambiguous-face'] })]))
    chooseServant(reviewRowAt(0), 'マシュ', 'セイバーマシュ')
    expect(within(reviewRowAt(0)).getByRole('checkbox')).toBeChecked()
    expect(confirmButton()).toBeDisabled()
    expect(screen.getByText('同じサーヴァントに決まっている行が2つ以上あるため、確定できません')).toBeInTheDocument()
    expect(within(reviewRowAt(0)).getByText('ほかの行と同じサーヴァントに決まっています')).toBeInTheDocument()

    expandMatched()
    const matchedRow = screen.getAllByTestId('roster-import-row').at(1)
    if (!matchedRow) throw new Error('matched row not found')
    fireEvent.click(within(matchedRow).getByRole('checkbox'))
    expect(screen.queryByText('同じサーヴァントに決まっている行が2つ以上あるため、確定できません')).not.toBeInTheDocument()
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [MASH]: { lv: 90, npLv: 2 } })
  })

  it('範囲に無い値を手で入れる: Lv 121 の行は取り込みに入れられず、範囲に無いことが分かる', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 80, 1), matched(MERLIN, 90, 2)]))
    expandMatched()
    setValue('マシュ の Lv', '121')
    expect(screen.getByText('Lv は 1〜120 の整数で入れてください')).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox', { name: 'マシュ を取り込みに入れる' })
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toHaveAttribute('data-disabled')
    setValue('マーリン の 宝具Lv', '2.5')
    expect(screen.getByText('宝具Lv は 1〜5 の整数で入れてください')).toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    setValue('マーリン の 宝具Lv', '5')
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [MERLIN]: { lv: 90, npLv: 5 } })
    expect(servantOf(storedMaterial(), MASH)?.disabled).toBe(true)
  })

  it('全角の数字を貼る: 空の Lv の欄に「９０」を貼ると 90 が入り、Lv 90 で取り込む', async () => {
    const user = userEvent.setup()
    renderIndex()
    await importWith(done([needsReview('r1', { servantId: ARTORIA, npLv: 2 }, { reasons: ['sort-order'], undecided: ['lv'] })]))
    const row = reviewRowAt(0)
    const input = within(row).getByLabelText('アルトリア の Lv')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('type', 'text')
    await user.click(input)
    await user.paste('９０')
    expect(within(row).getByRole('checkbox')).toBeChecked()
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [ARTORIA]: { lv: 90, npLv: 2 } })
  })

  it('全角の数字を打つ: 空の宝具Lv の欄に「５」を打つと 5 が入る', async () => {
    const user = userEvent.setup()
    renderIndex()
    await importWith(done([needsReview('r1', { servantId: ARTORIA, lv: 90 }, { reasons: ['sort-order'], undecided: ['npLv'] })]))
    const row = reviewRowAt(0)
    await user.type(within(row).getByLabelText('アルトリア の 宝具Lv'), '５')
    expect(within(row).getByRole('checkbox')).toBeChecked()
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [ARTORIA]: { lv: 90, npLv: 5 } })
  })

  it('文字の混じった値を貼る: 値 90 の欄に「Lv 90」を貼っても 90 のまま', async () => {
    const user = userEvent.setup()
    renderIndex()
    await importWith(done([matched(MERLIN, 90, 2)]))
    expandMatched()
    const input = screen.getByLabelText('マーリン の Lv')
    await user.click(input)
    await user.paste('Lv 90')
    expect(input).toHaveValue('90')
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({ [MERLIN]: { lv: 90, npLv: 2 } })
  })

  it.each([
    ['Lv', '0', 'Lv は 1〜120 の整数で入れてください'],
    ['Lv', '1.5', 'Lv は 1〜120 の整数で入れてください'],
    ['宝具Lv', '6', '宝具Lv は 1〜5 の整数で入れてください'],
  ])('範囲に無い値は丸めない（%s に %s）: 欄はそのままで、取り込みに入れられない', async (label, raw, message) => {
    const user = userEvent.setup()
    renderIndex()
    await importWith(done([matched(MASH, 80, 1)]))
    expandMatched()
    const input = screen.getByLabelText(`マシュ の ${label}`)
    await user.clear(input)
    await user.type(input, raw)
    expect(input).toHaveValue(raw)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'マシュ を取り込みに入れる' })).not.toBeChecked()
    expect(confirmButton()).toBeDisabled()
  })

  it('閉じる: 確定せずに閉じると保存値を何も変えない', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(true) }))
    renderIndex()
    const before = localStorage.getItem('material')
    await importWith(done([matched(MASH, 80, 1)]))
    fireEvent.click(screen.getAllByRole('button', { name: '閉じる' })[0])
    expect(screen.queryByText('1枚を読みました')).not.toBeInTheDocument()
    expect(localStorage.getItem('material')).toBe(before)
    expect(localStorage.getItem(LEVELS_KEY)).toBeNull()
  })
})

describe('スキルLv（サーヴァントスキル強化の画面）', () => {
  const skillStarts = (id: number) => servantOf(storedMaterial(), id)?.targets.skill.ranges.map(r => r.start)
  const skillEnds = (id: number) => servantOf(storedMaterial(), id)?.targets.skill.ranges.map(r => r.end)

  it('読んだスキルLv を3つの欄に出し、スキルLv の無い行には欄を出さない', async () => {
    renderIndex()
    await importWith(done([matched(MASH, null, 3, [9, 10, 9]), matched(MERLIN, 90, 2)]))
    expandMatched()
    const mash = rowOf('マシュ を取り込みに入れる')
    expect(within(mash).getByLabelText('マシュ の スキル1')).toHaveValue('9')
    expect(within(mash).getByLabelText('マシュ の スキル2')).toHaveValue('10')
    expect(within(mash).getByLabelText('マシュ の スキル3')).toHaveValue('9')
    expect(within(rowOf('マーリン を取り込みに入れる')).queryByLabelText(/スキル/)).not.toBeInTheDocument()
  })

  it('確定すると、育成計算機のスキルの「今」に書き、目標・Lv・宝具Lv の保存値は読んだ値だけ変える', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(false) }))
    localStorage.setItem(LEVELS_KEY, JSON.stringify({ [MASH]: { lv: 80, npLv: 1 } }))
    renderIndex()
    await importWith(done([matched(MASH, null, 3, [9, 10, 4])]))
    fireEvent.click(confirmButton())
    expect(skillStarts(MASH)).toEqual([9, 10, 4])
    expect(skillEnds(MASH)).toEqual([10, 10, 10])
    expect(storedLevels()).toEqual({ [MASH]: { lv: 80, npLv: 3 } })
  })

  it('欄を直す: 直したスキルLv で書き、空にした欄は前の値のまま', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(false) }))
    renderIndex()
    await importWith(done([matched(MASH, 80, 1, [9, 10, 9])]))
    expandMatched()
    setValue('マシュ の スキル1', '10')
    setValue('マシュ の スキル2', '')
    fireEvent.click(confirmButton())
    // planned のスキルの今は 6・7・8
    expect(skillStarts(MASH)).toEqual([10, 7, 9])
  })

  it('スキルLv が範囲に無い行は取り込みに入れられず、範囲に無いことが分かる', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 80, 1, [9, 10, 9]), matched(MERLIN, 90, 2)]))
    expandMatched()
    setValue('マシュ の スキル2', '11')
    expect(screen.getByText('スキルLv は 1〜10 の整数で入れてください')).toBeInTheDocument()
    expect(screen.getByLabelText('マシュ の スキル2')).toHaveAttribute('aria-invalid', 'true')
    const checkbox = screen.getByRole('checkbox', { name: 'マシュ を取り込みに入れる' })
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toHaveAttribute('data-disabled')
    fireEvent.click(confirmButton())
    expect(skillStarts(MASH)).toEqual([1, 1, 1])
  })

  it('育成計算機のスキルの今の値を欄の横に出し、読み取りにも渡す', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(false) }))
    renderIndex()
    await importWith(done([matched(MASH, 80, 1, [9, 10, 9])]))
    const options = (analyzeMock.fn.mock.calls[0] as [File[], { storedSkills: Record<string, number[]> }])[1]
    expect(options.storedSkills[String(MASH)]).toEqual([6, 7, 8])
    expandMatched()
    const row = rowOf('マシュ を取り込みに入れる')
    // planned のスキルの今の値は 6・7・8
    for (const stored of ['6', '7', '8']) expect(within(row).getByText(stored)).toBeInTheDocument()
  })

  it('今の値より低く読んだスキル: 欄を空にして「要確認」で出し、候補を押して決めるまで書かない', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(false) }))
    renderIndex()
    await importWith(
      done([
        needsReview(
          'r1',
          { servantId: MASH, npLv: 3, skills: [9, null, 10] },
          { reasons: ['lower-than-saved'], undecidedSkills: [1], skillCandidates: [[], [3, 7], []] },
        ),
      ]),
    )
    const row = reviewRowAt(0)
    expect(within(row).getByText('前に取り込んだ値より低い')).toBeInTheDocument()
    expect(within(row).getByLabelText('マシュ の スキル2')).toHaveValue('')
    expect(within(row).getByRole('checkbox')).toHaveAttribute('data-disabled')
    expect(within(row).getByRole('checkbox')).not.toBeChecked()
    expect(confirmButton()).toBeDisabled()
    fireEvent.click(within(row).getByRole('button', { name: '7' }))
    expect(within(row).getByLabelText('マシュ の スキル2')).toHaveValue('7')
    expect(within(row).getByRole('checkbox')).toBeChecked()
    fireEvent.click(confirmButton())
    expect(skillStarts(MASH)).toEqual([9, 7, 10])
  })

  it('今の値より低く読んだスキルを決めずに確定する: その行は取り込まず、今の値を変えない', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(false) }))
    renderIndex()
    await importWith(
      done([
        matched(MERLIN, 90, 2),
        needsReview('r1', { servantId: MASH, skills: [9, null, 10] }, { reasons: ['lower-than-saved'], undecidedSkills: [1], skillCandidates: [[], [3, 7], []] }),
      ]),
    )
    fireEvent.click(confirmButton())
    expect(skillStarts(MASH)).toEqual([6, 7, 8])
  })

  it('「要確認」の行も、サーヴァントを選んで決めればスキルLv を書く', async () => {
    renderIndex()
    await importWith(done([needsReview('r1', { npLv: 2, skills: [10, 10, 10] }, { reasons: ['unknown-face'] })]))
    const row = reviewRowAt(0)
    expect(within(row).getByLabelText('サーヴァントを選んでいません の スキル1')).toHaveValue('10')
    chooseServant(row, 'マー', 'セイバーマーリン')
    expect(within(row).getByRole('checkbox', { name: 'マーリン を取り込みに入れる' })).toBeChecked()
    fireEvent.click(confirmButton())
    expect(skillStarts(MERLIN)).toEqual([10, 10, 10])
    expect(storedLevels()).toEqual({ [MERLIN]: { npLv: 2 } })
  })

  it('取り込みに入れない行のスキルLv は書かない', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 80, 1, [9, 10, 9]), matched(MERLIN, 90, 2, [10, 10, 10])]))
    expandMatched()
    fireEvent.click(screen.getByRole('checkbox', { name: 'マシュ を取り込みに入れる' }))
    fireEvent.click(confirmButton())
    expect(skillStarts(MERLIN)).toEqual([10, 10, 10])
    expect(skillStarts(MASH)).toEqual([1, 1, 1])
  })
})

describe('所持と Lv・宝具Lv の保存', () => {
  it('未所持のサーヴァントを取り込む: 所持になり Lv 90・宝具Lv 2 が保存され、カードに出る', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 90, 2)]))
    fireEvent.click(confirmButton())
    expect(servantOf(storedMaterial(), MASH)?.disabled).toBe(false)
    expect(storedLevels()).toEqual({ [MASH]: { lv: 90, npLv: 2 } })
    const card = document.getElementById(`svt-${MASH}`)
    if (!card) throw new Error('card not found')
    expect(within(card).getByText('Lv 90・宝具 2')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: '未所持' })).not.toBeInTheDocument()
  })

  it('保存値にまだ無いサーヴァント: 所持になり、新しく所持になる数に含まれる', async () => {
    localStorage.setItem('material', JSON.stringify({ [ARTORIA]: planned(false) }))
    renderIndex()
    await importWith(done([matched(ARTORIA, 90, 2), matched(MERLIN, 80, 1)]))
    expect(screen.getByText('新しく所持になる 1 騎')).toBeInTheDocument()
    fireEvent.click(confirmButton())
    expect(servantOf(storedMaterial(), MERLIN)?.disabled).toBe(false)
  })

  it('育成計画の値を変えない: 再臨・スキル・アペンドスキルの今と目標は前と同じ', async () => {
    localStorage.setItem('material', JSON.stringify({ [MASH]: planned(true), [ARTORIA]: planned(false) }))
    renderIndex()
    const before = storedMaterial()
    await importWith(done([matched(MASH, 90, 2), matched(ARTORIA, 100, 5)]))
    fireEvent.click(confirmButton())
    const after = storedMaterial()
    expect(servantOf(after, MASH)).toEqual({ ...servantOf(before, MASH), disabled: false })
    expect(servantOf(after, ARTORIA)).toEqual(servantOf(before, ARTORIA))
    expect(after.all).toEqual(before.all)
    expect(servantOf(after, MERLIN)).toEqual(servantOf(before, MERLIN))
  })

  it('開き直しても残る: 取り込んだ所持の印と Lv・宝具Lv が描き直した一覧に出る', async () => {
    const { unmount } = renderIndex()
    await importWith(done([matched(MASH, 90, 2)]))
    fireEvent.click(confirmButton())
    unmount()
    renderIndex()
    const card = document.getElementById(`svt-${MASH}`)
    if (!card) throw new Error('card not found')
    expect(within(card).getByText('Lv 90・宝具 2')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: '未所持' })).not.toBeInTheDocument()
  })

  it('確定が未同期の編集になる: `material` と `servantLevels` のそれぞれにキーを指定した変更の通知が出る', async () => {
    renderIndex()
    await importWith(done([matched(MASH, 90, 2)]))
    const keys: unknown[] = []
    const onSync = (e: Event) => {
      if (e instanceof CustomEvent) keys.push((e.detail as { key?: unknown; derived?: unknown }).derived ? 'derived' : (e.detail as { key?: unknown }).key)
    }
    window.addEventListener('ls-sync', onSync)
    try {
      fireEvent.click(confirmButton())
    } finally {
      window.removeEventListener('ls-sync', onSync)
    }
    expect(keys).toContain('material')
    expect(keys).toContain(LEVELS_KEY)
    expect(keys).not.toContain('derived')
  })

  it('開いただけでは保存値を作らない: 一覧を開き、入口を開いて閉じても `servantLevels` のキーは無い', () => {
    renderIndex()
    fireEvent.click(openButton())
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(localStorage.getItem(LEVELS_KEY)).toBeNull()
  })

  it('知らない欄を持つ保存値で確定する: 知らない欄と一覧にいないサーヴァントの項目は同じ値で残る', async () => {
    localStorage.setItem(
      LEVELS_KEY,
      JSON.stringify({ [MASH]: { lv: 80, npLv: 3, ascension: { future: true } }, '999999': { lv: 50, note: 'x' } }),
    )
    renderIndex()
    await importWith(done([matched(MASH, 100, null)]))
    fireEvent.click(confirmButton())
    expect(storedLevels()).toEqual({
      [MASH]: { lv: 100, npLv: 3, ascension: { future: true } },
      '999999': { lv: 50, note: 'x' },
    })
  })
})

describe('保存値の確かめ（読み取りに渡す値）', () => {
  it('読み取りには、今保存されている Lv・宝具Lv を読んだ値を渡す', async () => {
    localStorage.setItem(LEVELS_KEY, JSON.stringify({ [MASH]: { lv: 90, npLv: 'x' } }))
    renderIndex()
    await importWith(done([]))
    const [, options] = analyzeMock.fn.mock.calls[0] as [File[], { stored: unknown }]
    expect(options.stored).toEqual({ [MASH]: { lv: 90 } })
    expect(screen.getByText('読み取れたサーヴァントがありません')).toBeInTheDocument()
  })
})

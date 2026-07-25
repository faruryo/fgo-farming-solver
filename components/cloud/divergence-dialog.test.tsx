// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Stats } from './parts/stats-logic'

const push = vi.fn()

// t(key, fallback) の fallback をそのまま返し、実際に出る日本語で検証する。
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const stats = (overrides: Partial<Stats> = {}): Stats => ({
  ownedCount: 1,
  skillTotal: 0,
  appendTotal: 0,
  bronze: 5,
  silver: 3,
  gold: 2,
  fragments: 0,
  ...overrides,
})

// 「あとで」の抑止はモジュールスコープの変数なので、テストごとに読み込み直す。
const loadDialog = async () => {
  vi.resetModules()
  const mod = await import('./divergence-dialog')
  return mod.DivergenceDialog
}

describe('DivergenceDialog', () => {
  beforeEach(() => {
    push.mockReset()
  })

  it('shows both sides so the user can tell which data is which', async () => {
    const DivergenceDialog = await loadDialog()
    render(
      <DivergenceDialog
        open
        localStats={stats({ ownedCount: 1, bronze: 5, silver: 3, gold: 2 })}
        cloudStats={stats({ ownedCount: 3, bronze: 500, silver: 300, gold: 200 })}
        onRestore={vi.fn()}
      />,
    )

    expect(
      screen.getByText('この端末とクラウドのデータが分かれています'),
    ).toBeInTheDocument()
    expect(screen.getByText('サーヴァント 1 騎 / 素材 10 個')).toBeInTheDocument()
    expect(screen.getByText('サーヴァント 3 騎 / 素材 1000 個')).toBeInTheDocument()
  })

  // クラウドを上書きする選択肢はモーダルに置かない（取り返しがつかないため、
  // 件数を見比べられる /cloud を必ず経由させる）。
  it('offers restore and compare, but no cloud overwrite', async () => {
    const DivergenceDialog = await loadDialog()
    render(
      <DivergenceDialog
        open
        localStats={stats()}
        cloudStats={stats()}
        onRestore={vi.fn()}
      />,
    )

    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.trim())
      .filter(Boolean)
    expect(labels).toEqual(['クラウドから復元', '見比べる', 'あとで'])
  })

  it('restores from the cloud and closes', async () => {
    const DivergenceDialog = await loadDialog()
    const onRestore = vi.fn()
    render(
      <DivergenceDialog open localStats={stats()} cloudStats={stats()} onRestore={onRestore} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'クラウドから復元' }))

    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText('この端末とクラウドのデータが分かれています'),
    ).not.toBeInTheDocument()
  })

  it('sends the overwrite decision to the comparison screen instead of acting on it', async () => {
    const DivergenceDialog = await loadDialog()
    const onRestore = vi.fn()
    render(
      <DivergenceDialog open localStats={stats()} cloudStats={stats()} onRestore={onRestore} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '見比べる' }))

    expect(push).toHaveBeenCalledWith('/cloud')
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('keeps local data untouched when dismissed', async () => {
    const DivergenceDialog = await loadDialog()
    const onRestore = vi.fn()
    render(
      <DivergenceDialog open localStats={stats()} cloudStats={stats()} onRestore={onRestore} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'あとで' }))

    expect(onRestore).not.toHaveBeenCalled()
    expect(
      screen.queryByText('この端末とクラウドのデータが分かれています'),
    ).not.toBeInTheDocument()
  })

  // 「あとで」はこのページロードの間だけ抑止する。抑止はモジュール変数に置いて
  // いるため、再マウント（画面遷移）では出し直さない。リロードすれば再提示される。
  it('stays dismissed across a remount within the same page load', async () => {
    const DivergenceDialog = await loadDialog()
    const props = {
      open: true,
      localStats: stats(),
      cloudStats: stats(),
      onRestore: vi.fn(),
    }
    const first = render(<DivergenceDialog {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'あとで' }))
    first.unmount()

    render(<DivergenceDialog {...props} />)

    expect(
      screen.queryByText('この端末とクラウドのデータが分かれています'),
    ).not.toBeInTheDocument()
  })
})

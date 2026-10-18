// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './page-header'

describe('PageHeader', () => {
  it('戻るリンクの文言を渡さなければ戻るリンクを出さない', () => {
    render(<PageHeader en="SERVANT LIST" title="サーヴァント一覧" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('SERVANT LIST')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'サーヴァント一覧' })).toBeInTheDocument()
  })

  it('戻り先を指定するとその href の戻るリンクを出す', () => {
    render(<PageHeader backLabel="イベント一覧へ戻る" backHref="/events" en="EVENT PLANNER" title="イベント" />)
    expect(screen.getByRole('link', { name: 'イベント一覧へ戻る' })).toHaveAttribute('href', '/events')
  })

  it('戻り先を指定しなければ / へ戻る', () => {
    render(<PageHeader backLabel="ダッシュボードへ戻る" en="TODO MANAGEMENT" title="TODO管理" />)
    expect(screen.getByRole('link', { name: 'ダッシュボードへ戻る' })).toHaveAttribute('href', '/')
  })

  it('右側の要素をタイトルの列の外に置く', () => {
    const { container } = render(
      <PageHeader en="SERVANT DETAIL" title="マシュ" aside={<div data-testid="aside">STARS</div>} />,
    )
    const root = container.firstElementChild as HTMLElement
    const aside = screen.getByTestId('aside')
    const heading = screen.getByRole('heading', { level: 1 })
    expect(aside.parentElement).toBe(root)
    expect(root.firstElementChild).toContainElement(heading)
    expect(root.firstElementChild).not.toContainElement(aside)
  })

  it('足すクラスを渡すとルート要素が c-page-header と渡したクラスの両方を持つ', () => {
    const { container } = render(<PageHeader en="RESULT" title="結果" className="flex flex-wrap gap-3" />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveClass('c-page-header', 'flex', 'flex-wrap', 'gap-3')
  })
})

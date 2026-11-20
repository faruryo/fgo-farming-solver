// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DropBonusInputs } from './DropBonusInputs'

vi.mock('react-i18next', async () => (await import('./events-i18n-test-utils')).eventsTranslationMock())

describe('DropBonusInputs', () => {
  it('スマホ幅で通貨名を省略せず折り返す（#304）', () => {
    render(
      <DropBonusInputs
        targets={[{ itemId: 1, label: 'クラウディバルーン' }]}
        bonus={new Map()}
        unappliedLabels={[]}
        description=""
        onChange={() => {}}
      />
    )
    const name = screen.getByText('クラウディバルーン')
    expect(name.className).not.toContain('truncate')
    expect(name.className).toContain('break-words')
    // 2列だと 320px で名前の幅が残らないので、sm 未満は1列にする
    expect(name.closest('label')?.parentElement?.className).toContain('grid-cols-1')
  })
})

import { describe, it, expect } from 'vitest'
import { matchSheetItemColumns } from './update'
import header from './__fixtures__/sheet-header-2026-10-11.json'
import niceItems from './__fixtures__/nice-item-2026-10-11.json'
import expected from './__fixtures__/sheet-item-columns.expected.json'

// 2026-10-11 の公開シート見出しと Atlas JP nice_item で、列ごとの対応表を固定する。
describe('matchSheetItemColumns (2026-10-11 sheet)', () => {
  const columns = matchSheetItemColumns(header, niceItems)

  it('maps every header column to the recorded Atlas item', () => {
    expect(columns).toEqual(expected)
  })
})

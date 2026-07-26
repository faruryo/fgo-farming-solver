// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EnrichedItem } from '../../../lib/get-items'

// t(key, fallback) の fallback をそのまま返し、実際に出る日本語で検証する。
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

import { ShrinkDiff } from './shrink-diff'

const KEYS = ['material', 'posession', 'quests', 'todoState']

const item = (id: number, name: string) => ({ id, name }) as EnrichedItem

const items = [item(6500, '英雄の証'), item(6501, '剣の輝石')]

// 数量つきの posession を組み立てる。
const posession = (entries: Record<string, number>) => JSON.stringify(entries)

describe('ShrinkDiff — 減る素材', () => {
  it('カタログの名前と クラウド → ローカル の増減を出す', () => {
    render(
      <ShrinkDiff
        next={{ posession: posession({ '6500': 0, '6501': 40 }) }}
        cloud={{ posession: posession({ '6500': 342, '6501': 88 }) }}
        keys={KEYS}
        items={items}
      />
    )

    expect(screen.getByText('英雄の証')).toBeDefined()
    expect(screen.getByText('342 → 0')).toBeDefined()
    expect(screen.getByText('剣の輝石')).toBeDefined()
    expect(screen.getByText('88 → 40')).toBeDefined()
  })

  // 名前が引けないからと行ごと落とすと、減る素材を隠すことになる。
  it('カタログに無い id は id をそのまま出す', () => {
    render(
      <ShrinkDiff
        next={{ posession: posession({ '99999': 0 }) }}
        cloud={{ posession: posession({ '99999': 12 }) }}
        keys={KEYS}
        items={items}
      />
    )

    expect(screen.getByText('99999')).toBeDefined()
    expect(screen.getByText('12 → 0')).toBeDefined()
  })

  it('上位10件までを出し、残りは件数で示す', () => {
    const cloudCounts = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [String(7000 + i), 100 - i])
    )
    render(
      <ShrinkDiff
        next={{ posession: posession({}) }}
        cloud={{ posession: posession(cloudCounts) }}
        keys={KEYS}
        items={[]}
      />
    )

    expect(screen.getByText('7000')).toBeDefined()
    expect(screen.getByText('7009')).toBeDefined()
    expect(screen.queryByText('7010')).toBeNull()
    // 「ほか」「4」「件」がテキストノードに分かれるので、まとめて突き合わせる。
    expect(
      screen.getByText((_, el) => el?.textContent?.replace(/\s+/g, ' ') === 'ほか 4 件')
    ).toBeDefined()
  })

  it('減る素材が無ければセクションごと出さない', () => {
    render(
      <ShrinkDiff
        next={{ posession: posession({ '6500': 342 }) }}
        cloud={{ posession: posession({ '6500': 342 }) }}
        keys={KEYS}
        items={items}
      />
    )

    expect(screen.queryByText('減る素材')).toBeNull()
  })
})

describe('ShrinkDiff — キー単位の内訳', () => {
  const openBreakdown = async () => {
    await userEvent.click(screen.getByText('キー単位の内訳'))
  }

  it('渡された全キーぶんを local / cloud で並べる', async () => {
    render(
      <ShrinkDiff
        next={{ material: '{}', posession: '{}', quests: '[1,2]' }}
        cloud={{
          material: JSON.stringify({ a: 1, b: 2 }),
          posession: '{}',
          quests: '[1,2]',
          todoState: JSON.stringify({ x: 1 }),
        }}
        keys={KEYS}
        items={items}
      />
    )
    await openBreakdown()

    KEYS.forEach((key) => {
      expect(screen.getByText(new RegExp(`^${key}`))).toBeDefined()
    })
    expect(screen.getByText('0 / 2')).toBeDefined()
    expect(screen.getByText('2 / 2')).toBeDefined()
  })

  // 19行の中に危険な行が埋もれないよう、消えるキーは明示する。
  it('クラウドにあって保存内容に無いキーは「消える」と注記する', async () => {
    render(
      <ShrinkDiff
        next={{ material: '{}' }}
        cloud={{ material: '{}', todoState: JSON.stringify({ x: 1 }) }}
        keys={KEYS}
        items={items}
      />
    )
    await openBreakdown()

    expect(screen.getByText(/todoState \(消える\)/)).toBeDefined()
  })

  // 測定不能を 0 と書くと「消える」と誤読される。
  it('読めないキーは 0 ではなく ? と出す', async () => {
    render(
      <ShrinkDiff
        next={{ material: '{"broken": ' }}
        cloud={{ material: JSON.stringify({ a: 1 }) }}
        keys={['material']}
        items={items}
      />
    )
    await openBreakdown()

    expect(screen.getByText('? / 1')).toBeDefined()
  })
})

import { describe, it, expect } from 'vitest'
import { resolveLineEndpoints } from './line-endpoints'
import type { ClassBoardLine } from './board-types'
import extra2Data from '../../data/class-board/extra2.json'

describe('line-endpoints', () => {
  it('中継点を含まない直接接続の端点をそのまま解決する', () => {
    const lines: ClassBoardLine[] = [
      { id: 1, prev: 1, next: 2 },
      { id: 2, prev: 2, next: 3 },
    ]
    const blankIds = new Set<number>()
    const map = resolveLineEndpoints(lines, blankIds)

    expect(map.get(1)).toEqual({ endpointA: 1, endpointB: 2 })
    expect(map.get(2)).toEqual({ endpointA: 2, endpointB: 3 })
  })

  it('単一の中継点（blankマス）を経由する2本のラインが同じ実端点ペアを共有する', () => {
    // 10 - [line 1] -> 90(blank) - [line 2] -> 20
    const lines: ClassBoardLine[] = [
      { id: 1, prev: 10, next: 90 },
      { id: 2, prev: 90, next: 20 },
    ]
    const blankIds = new Set([90])
    const map = resolveLineEndpoints(lines, blankIds)

    expect(map.get(1)).toEqual({ endpointA: 10, endpointB: 20 })
    expect(map.get(2)).toEqual({ endpointA: 10, endpointB: 20 })
  })

  it('連続する複数の中継点を経由する折れ線の全ラインが同じ実端点ペアを共有する', () => {
    // 5 - [1] -> 80(blank) - [2] -> 81(blank) - [3] -> 6
    const lines: ClassBoardLine[] = [
      { id: 1, prev: 5, next: 80 },
      { id: 2, prev: 80, next: 81 },
      { id: 3, prev: 81, next: 6 },
    ]
    const blankIds = new Set([80, 81])
    const map = resolveLineEndpoints(lines, blankIds)

    expect(map.get(1)).toEqual({ endpointA: 5, endpointB: 6 })
    expect(map.get(2)).toEqual({ endpointA: 5, endpointB: 6 })
    expect(map.get(3)).toEqual({ endpointA: 5, endpointB: 6 })
  })

  it('実際のextra2盤面データの全ラインについて、端点が実サインマスとして解決される', () => {
    const lines = extra2Data.lines as ClassBoardLine[]
    const blankIds = new Set(
      extra2Data.squares.filter((s) => s.flags.includes('blank')).map((s) => s.id),
    )

    const map = resolveLineEndpoints(lines, blankIds)
    expect(map.size).toBe(lines.length)

    for (const line of lines) {
      const endpoints = map.get(line.id)
      expect(endpoints).toBeDefined()
      // 端点はどちらも blank マスであってはならない
      expect(blankIds.has(endpoints?.endpointA ?? -1)).toBe(false)
      expect(blankIds.has(endpoints?.endpointB ?? -1)).toBe(false)
    }
  })
})

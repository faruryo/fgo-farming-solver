import { describe, it, expect } from 'vitest'
import {
  findShortestPath,
  findShortestPathFromStarts,
} from './find-shortest-path'
import { getClassBoardData } from './board-loader'

describe('findShortestPath', () => {
  it('returns [start] when start is target', () => {
    const lines = [{ id: 1, prev: 1, next: 2 }]
    expect(findShortestPath(lines, 1, 1)).toEqual([1])
  })

  it('finds linear path', () => {
    const lines = [
      { id: 1, prev: 1, next: 2 },
      { id: 2, prev: 2, next: 3 },
      { id: 3, prev: 3, next: 4 },
    ]
    expect(findShortestPath(lines, 1, 4)).toEqual([1, 2, 3, 4])
  })

  it('finds shortest path when multiple paths exist', () => {
    const lines = [
      { id: 1, prev: 1, next: 2 },
      { id: 2, prev: 2, next: 4 },
      { id: 3, prev: 1, next: 3 },
      { id: 4, prev: 3, next: 5 },
      { id: 5, prev: 5, next: 4 },
    ]
    expect(findShortestPath(lines, 1, 4)).toEqual([1, 2, 4])
  })

  it('returns empty array when target is unreachable', () => {
    const lines = [{ id: 1, prev: 1, next: 2 }]
    expect(findShortestPath(lines, 1, 999)).toEqual([])
  })
})

describe('findShortestPathFromStarts', () => {
  it('finds shortest path from multiple starts', () => {
    const lines = [
      { id: 1, prev: 1, next: 3 },
      { id: 2, prev: 3, next: 4 },
      { id: 3, prev: 2, next: 4 },
    ]
    // Start 2 is closer to 4 than start 1
    expect(findShortestPathFromStarts(lines, [1, 2], 4)).toEqual([2, 4])
  })

  it('finds valid path in real saber board data', () => {
    const saber = getClassBoardData('saber')
    expect(saber).toBeDefined()
    if (!saber) return

    // Test a path to square 2 (near start 1)
    const pathTo2 = findShortestPathFromStarts(
      saber.lines,
      saber.startSquareIds,
      2,
    )
    expect(pathTo2.length).toBeGreaterThan(0)
    expect(saber.startSquareIds).toContain(pathTo2[0])
    expect(pathTo2[pathTo2.length - 1]).toBe(2)

    // Test a path to square 33 (near start 32)
    const pathTo33 = findShortestPathFromStarts(
      saber.lines,
      saber.startSquareIds,
      33,
    )
    expect(pathTo33.length).toBeGreaterThan(0)
    expect(saber.startSquareIds).toContain(pathTo33[0])
    expect(pathTo33[pathTo33.length - 1]).toBe(33)

    // Verify all consecutive nodes are connected
    const linePairs = new Set(
      saber.lines.flatMap((l) => [
        `${l.prev}-${l.next}`,
        `${l.next}-${l.prev}`,
      ]),
    )
    pathTo2.slice(0, -1).forEach((curr, idx) => {
      const next = pathTo2.at(idx + 1)
      expect(linePairs.has(`${curr}-${next}`)).toBe(true)
    })
  })
})

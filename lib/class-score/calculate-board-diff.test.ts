import { describe, it, expect } from 'vitest'
import { calculateBoardDiffMaterials } from './calculate-board-diff'
import { getClassBoardData } from './board-loader'

const getSaberBoard = () => {
  const board = getClassBoardData('saber')
  if (!board) throw new Error('Saber board not found')
  return board
}

describe('calculateBoardDiffMaterials', () => {
  const saberBoard = getSaberBoard()

  it('returns zeros when targets are empty', () => {
    const res = calculateBoardDiffMaterials(saberBoard, [], [])
    expect(res.qp).toBe(0)
    expect(res.sand).toBe(0)
    expect(res.torches).toHaveLength(0)
    expect(res.materials).toHaveLength(0)
    expect(res.activeTargetCount).toBe(0)
  })

  it('calculates materials for a single square', () => {
    // Square 1 requires QP 500,000, Sand 30, Hero Proof 14
    const res = calculateBoardDiffMaterials(saberBoard, [1], [])
    expect(res.qp).toBe(500000)
    expect(res.sand).toBe(30)
    expect(res.activeTargetCount).toBe(1)
    expect(res.materials).toEqual([
      { id: '6503', name: '英雄の証', amount: 14 },
    ])
  })

  it('excludes unlocked squares from diff calculation', () => {
    // Square 1 and 2 targeted, but 1 is already unlocked
    const res = calculateBoardDiffMaterials(saberBoard, [1, 2], [1])
    expect(res.activeTargetCount).toBe(1)
    // Should only contain square 2
    expect(res.qp).toBe(500000)
    expect(res.sand).toBe(30)
    expect(res.materials).toEqual([
      { id: '6551', name: '黄昏の儀式剣', amount: 14 },
    ])
  })

  it('aggregates tour lock torch requirements', () => {
    // Square 63 is tour lock requiring Nova Torch (51)
    const res = calculateBoardDiffMaterials(saberBoard, [63], [])
    expect(res.activeTargetCount).toBe(1)
    expect(res.torches).toEqual([
      { id: '51', name: '新星のトーチ', amount: 1 },
    ])
  })

  it('matches board full totals when all squares are targeted with none unlocked', () => {
    const allSquareIds = saberBoard.squares.map((sq) => sq.id)
    const res = calculateBoardDiffMaterials(saberBoard, allSquareIds, [])

    expect(res.qp).toBe(317000000)
    expect(res.sand).toBe(6680)

    const nova = res.torches.find((t) => t.id === '51')
    const star = res.torches.find((t) => t.id === '52')
    const polar = res.torches.find((t) => t.id === '53')
    expect(nova?.amount).toBe(4)
    expect(star?.amount).toBe(4)
    expect(polar?.amount).toBe(2)
    // 72 playable squares (excluding 10 blank waypoint squares)
    expect(res.activeTargetCount).toBe(72)
  })

  it('ignores blank waypoint squares in activeTargetCount and materials', () => {
    // Square 73 is a blank waypoint square
    const res = calculateBoardDiffMaterials(saberBoard, [73], [])
    expect(res.activeTargetCount).toBe(0)
    expect(res.qp).toBe(0)
    expect(res.sand).toBe(0)
    expect(res.materials).toHaveLength(0)
  })
})

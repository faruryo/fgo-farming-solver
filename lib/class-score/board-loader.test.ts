import { describe, it, expect } from 'vitest'
import { getClassBoardData, getAllClassBoards } from './board-loader'
import { CLASS_SCORE_CLASS_KEYS } from './types'

describe('ClassBoardLoader', () => {
  it('should load board data for all 9 classes', () => {
    const allBoards = getAllClassBoards()
    expect(Object.keys(allBoards)).toHaveLength(9)

    for (const key of CLASS_SCORE_CLASS_KEYS) {
      const board = getClassBoardData(key)
      expect(board).toBeDefined()
      expect(board?.key).toBe(key)
      expect(board?.squares.length).toBeGreaterThanOrEqual(80)
      expect(board?.lines.length).toBeGreaterThanOrEqual(79)
    }
  })

  it('should have valid start squares in each board', () => {
    for (const key of CLASS_SCORE_CLASS_KEYS) {
      const board = getClassBoardData(key)
      expect(board).toBeDefined()
      if (!board) continue

      expect(board.startSquareIds.length).toBeGreaterThanOrEqual(1)
      for (const startId of board.startSquareIds) {
        const startSq = board.squares.find((sq) => sq.id === startId)
        expect(startSq).toBeDefined()
        expect(startSq?.isStart).toBe(true)
      }
    }
  })

  it('should have exactly 10 tour locks with correct torch counts in each board', () => {
    for (const key of CLASS_SCORE_CLASS_KEYS) {
      const board = getClassBoardData(key)
      expect(board).toBeDefined()
      if (!board) continue

      const lockSquares = board.squares.filter((sq) => sq.isLock)
      expect(lockSquares).toHaveLength(10)

      const torchItems = lockSquares.flatMap((sq) => sq.items)
      const countTorches = (id: string) =>
        torchItems.filter((it) => it.id === id).reduce((acc, it) => acc + it.amount, 0)

      expect(countTorches('51')).toBe(4)
      expect(countTorches('52')).toBe(4)
      expect(countTorches('53')).toBe(2)
    }
  })
})

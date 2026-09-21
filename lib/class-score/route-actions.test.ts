import { describe, expect, it } from 'vitest'
import {
  computeBoardAllTarget,
  computeBoardAllUnlocked,
  computePrunedOnNone,
  computeRouteTargets,
  computeRouteUnlocked,
  deriveClassStatusFromBoard,
} from './route-actions'
import type { ClassBoardDetailState } from './types'
import type { ClassBoardLine } from './board-types'

const numSort = (arr: number[]) => [...arr].sort((a, b) => a - b)

describe('route-actions', () => {
  describe('computeRouteTargets', () => {
    it('空のボード状態において、パス上の全マスを目標に設定する', () => {
      const result = computeRouteTargets(undefined, [1, 2, 3])
      expect(result.unlockedSquareIds).toEqual([])
      expect(numSort(result.targetSquareIds)).toEqual([1, 2, 3])
    })

    it('すでに一部マスが解放済の場合、解放済マスは維持し未解放マスのみ目標に追加する', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1],
        targetSquareIds: [10],
      }
      const result = computeRouteTargets(initial, [1, 2, 3])
      expect(result.unlockedSquareIds).toEqual([1])
      expect(numSort(result.targetSquareIds)).toEqual([2, 3, 10])
    })

    it('空のパスを渡した場合は既存状態を維持する', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [5],
        targetSquareIds: [6],
      }
      const result = computeRouteTargets(initial, [])
      expect(result.unlockedSquareIds).toEqual([5])
      expect(result.targetSquareIds).toEqual([6])
    })

    it('パスに含まれる中継点（blankマス）は目標に追加しない', () => {
      const blankIds = new Set([90, 91])
      const result = computeRouteTargets(undefined, [1, 90, 2, 91, 3], blankIds)
      expect(result.unlockedSquareIds).toEqual([])
      expect(numSort(result.targetSquareIds)).toEqual([1, 2, 3])
    })
  })

  describe('computeRouteUnlocked', () => {
    it('空のボード状態において、パス上の全マスを解放済に設定する', () => {
      const result = computeRouteUnlocked(undefined, [1, 2, 3])
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2, 3])
      expect(result.targetSquareIds).toEqual([])
    })

    it('パス上のマスが目標に設定されていた場合、解放済に移行し目標から除外する', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [],
        targetSquareIds: [1, 2, 10],
      }
      const result = computeRouteUnlocked(initial, [1, 2])
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2])
      expect(result.targetSquareIds).toEqual([10])
    })

    it('すでに解放済のマスが含まれていても重複しない', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1, 5],
        targetSquareIds: [],
      }
      const result = computeRouteUnlocked(initial, [1, 2])
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2, 5])
      expect(result.targetSquareIds).toEqual([])
    })

    it('空のパスを渡した場合は既存状態を維持する', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [5],
        targetSquareIds: [6],
      }
      const result = computeRouteUnlocked(initial, [])
      expect(result.unlockedSquareIds).toEqual([5])
      expect(result.targetSquareIds).toEqual([6])
    })

    it('パスに含まれる中継点（blankマス）は解放済に追加しない', () => {
      const blankIds = new Set([90, 91])
      const result = computeRouteUnlocked(undefined, [1, 90, 2, 91, 3], blankIds)
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2, 3])
      expect(result.targetSquareIds).toEqual([])
    })
  })

  describe('computePrunedOnNone', () => {
    // グラフ構造: 1(start) - 2 - 3 - 4
    const lines: ClassBoardLine[] = [
      { id: 1, prev: 1, next: 2 },
      { id: 2, prev: 2, next: 3 },
      { id: 3, prev: 3, next: 4 },
    ]
    const startIds = [1]

    it('途中マスを未解放にしたとき、起点と反対側（下流ノード）もすべて未解放にする', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1, 2],
        targetSquareIds: [3, 4],
      }
      // マス2を未解放にする -> 2, 3, 4 が未解放になり、1だけが残る
      const result = computePrunedOnNone(initial, 2, lines, startIds)
      expect(result.unlockedSquareIds).toEqual([1])
      expect(result.targetSquareIds).toEqual([])
    })

    it('末端マスを未解放にしたとき、手前のマスはすべて維持される', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1, 2],
        targetSquareIds: [3, 4],
      }
      // マス4を未解放にする -> 4だけが除外され、1, 2, 3 は残る
      const result = computePrunedOnNone(initial, 4, lines, startIds)
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2])
      expect(numSort(result.targetSquareIds)).toEqual([3])
    })

    it('起点マスそのものを未解放にしたとき、その枝の全マスが未解放になる', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1, 2],
        targetSquareIds: [3, 4],
      }
      // 起点1を未解放にする -> 全て未解放
      const result = computePrunedOnNone(initial, 1, lines, startIds)
      expect(result.unlockedSquareIds).toEqual([])
      expect(result.targetSquareIds).toEqual([])
    })

    it('別ブランチのマスは孤立していなければ未解放にならず残る', () => {
      // グラフ構造: 1(start) - 2 - 3, 1(start) - 10 - 11
      const branchLines: ClassBoardLine[] = [
        { id: 1, prev: 1, next: 2 },
        { id: 2, prev: 2, next: 3 },
        { id: 3, prev: 1, next: 10 },
        { id: 4, prev: 10, next: 11 },
      ]
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1],
        targetSquareIds: [2, 3, 10, 11],
      }
      // マス2を未解放にする -> 2, 3は消えるが、別ブランチの1, 10, 11は残る
      const result = computePrunedOnNone(initial, 2, branchLines, [1])
      expect(result.unlockedSquareIds).toEqual([1])
      expect(numSort(result.targetSquareIds)).toEqual([10, 11])
    })

    it('中継点（blankマス）を経由するルートにおいて、中継点を透過して先のマスを正常に保持する', () => {
      // グラフ構造: 1(start) - 2 - 73(blank) - 74(blank) - 3 - 4
      const blankLines: ClassBoardLine[] = [
        { id: 1, prev: 1, next: 2 },
        { id: 2, prev: 2, next: 73 },
        { id: 3, prev: 73, next: 74 },
        { id: 4, prev: 74, next: 3 },
        { id: 5, prev: 3, next: 4 },
      ]
      const blankIds = new Set([73, 74])
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1, 2],
        targetSquareIds: [3, 4],
      }
      // マス4を未解放にする -> 4だけが未解放になり、中継点(73, 74)の先にある3は残る！
      const result = computePrunedOnNone(initial, 4, blankLines, [1], blankIds)
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2])
      expect(numSort(result.targetSquareIds)).toEqual([3])
    })
  })

  describe('computeBoardAllTarget & computeBoardAllUnlocked', () => {
    it('computeBoardAllTarget は既存の解放済マスを維持し、未解放の実サインマスをすべて目標にする', () => {
      const initial: ClassBoardDetailState = {
        unlockedSquareIds: [1, 2],
        targetSquareIds: [3],
      }
      const playables = [1, 2, 3, 4, 5]
      const result = computeBoardAllTarget(initial, playables)
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2])
      expect(numSort(result.targetSquareIds)).toEqual([3, 4, 5])
    })

    it('computeBoardAllUnlocked は全実サインマスを解放済みにし、目標を空にする', () => {
      const playables = [1, 2, 3, 4]
      const result = computeBoardAllUnlocked(playables)
      expect(numSort(result.unlockedSquareIds)).toEqual([1, 2, 3, 4])
      expect(result.targetSquareIds).toEqual([])
    })
  })

  describe('deriveClassStatusFromBoard', () => {
    const playables = [1, 2, 3, 4, 5]

    it('board が undefined または空の場合は none を返す', () => {
      expect(deriveClassStatusFromBoard(undefined, playables)).toBe('none')
      expect(
        deriveClassStatusFromBoard({ unlockedSquareIds: [], targetSquareIds: [] }, playables),
      ).toBe('none')
    })

    it('全実サインマスが解放済みの場合は completed を返す', () => {
      const board: ClassBoardDetailState = {
        unlockedSquareIds: [1, 2, 3, 4, 5],
        targetSquareIds: [],
      }
      expect(deriveClassStatusFromBoard(board, playables)).toBe('completed')
    })

    it('全実サインマスが解放済みまたは目標（目標が1つ以上）の場合は target を返す', () => {
      const allTargets: ClassBoardDetailState = {
        unlockedSquareIds: [],
        targetSquareIds: [1, 2, 3, 4, 5],
      }
      expect(deriveClassStatusFromBoard(allTargets, playables)).toBe('target')

      const mixed: ClassBoardDetailState = {
        unlockedSquareIds: [1, 2],
        targetSquareIds: [3, 4, 5],
      }
      expect(deriveClassStatusFromBoard(mixed, playables)).toBe('target')
    })

    it('一部のみ目標で残りが未設定の場合は none を返す（個別指定状態）', () => {
      const partial: ClassBoardDetailState = {
        unlockedSquareIds: [1],
        targetSquareIds: [2],
      }
      expect(deriveClassStatusFromBoard(partial, playables)).toBe('none')
    })
  })
})

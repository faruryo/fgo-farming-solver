import type { ClassBoardData, ClassBoardLine } from './board-types'
import type { ClassBoardDetailState, ClassScoreStatus } from './types'

const buildUndirectedAdjacency = (lines: ClassBoardLine[]): Map<number, number[]> => {
  const adj = new Map<number, number[]>()
  for (const line of lines) {
    const listPrev = adj.get(line.prev) ?? []
    listPrev.push(line.next)
    adj.set(line.prev, listPrev)

    const listNext = adj.get(line.next) ?? []
    listNext.push(line.prev)
    adj.set(line.next, listNext)
  }
  return adj
}

/**
 * 起点から指定マスまでの経路上のマスを「目標」に一括設定する純関数
 * - すでに「解放済」のマスは解放済みのまま維持する。
 * - 未解放マスのみを「目標」に追加する。
 */
export const computeRouteTargets = (
  curBoard: ClassBoardDetailState | undefined,
  path: number[],
  blankSquareIds: Set<number> = new Set(),
): ClassBoardDetailState => {
  const unlocked = new Set(curBoard?.unlockedSquareIds ?? [])
  const targets = new Set(curBoard?.targetSquareIds ?? [])
  for (const sqId of path) {
    if (!blankSquareIds.has(sqId) && !unlocked.has(sqId)) {
      targets.add(sqId)
    }
  }
  return {
    unlockedSquareIds: Array.from(unlocked),
    targetSquareIds: Array.from(targets),
  }
}

/**
 * 起点から指定マスまでの経路上のマスを「解放済」に一括設定する純関数
 * - 経路上の実サインマスを「解放済」に追加する（中継点blankマスは除外）。
 * - 経路上のマスが「目標」に含まれていた場合は削除する（目標達成扱い）。
 */
export const computeRouteUnlocked = (
  curBoard: ClassBoardDetailState | undefined,
  path: number[],
  blankSquareIds: Set<number> = new Set(),
): ClassBoardDetailState => {
  const unlocked = new Set(curBoard?.unlockedSquareIds ?? [])
  const targets = new Set(curBoard?.targetSquareIds ?? [])
  for (const sqId of path) {
    if (!blankSquareIds.has(sqId)) {
      unlocked.add(sqId)
      targets.delete(sqId)
    }
  }
  return {
    unlockedSquareIds: Array.from(unlocked),
    targetSquareIds: Array.from(targets),
  }
}

type ReachableContext = {
  active: Set<number>
  blankIds: Set<number>
  removedSquareId: number
}

const isTraversable = (nodeId: number, ctx: ReachableContext): boolean => {
  if (nodeId === ctx.removedSquareId) return false
  if (ctx.blankIds.has(nodeId)) return true
  return ctx.active.has(nodeId)
}

const addSeedNode = (
  nodeId: number,
  visited: Set<number>,
  queue: number[],
) => {
  visited.add(nodeId)
  queue.push(nodeId)
}

const addStartSeeds = (
  startSquareIds: number[],
  ctx: ReachableContext,
  adj: Map<number, number[]>,
  visited: Set<number>,
  queue: number[],
) => {
  for (const startId of startSquareIds) {
    if (startId === ctx.removedSquareId) continue
    if (ctx.active.has(startId) || ctx.blankIds.has(startId)) {
      addSeedNode(startId, visited, queue)
    } else {
      const neighbors = adj.get(startId) ?? []
      for (const n of neighbors) {
        if (!visited.has(n) && isTraversable(n, ctx)) {
          addSeedNode(n, visited, queue)
        }
      }
    }
  }
}

const findReachableSquares = (
  active: Set<number>,
  lines: ClassBoardLine[],
  startSquareIds: number[],
  removedSquareId: number,
  blankIds: Set<number>,
): Set<number> => {
  const adj = buildUndirectedAdjacency(lines)
  const visited = new Set<number>()
  const queue: number[] = []
  const ctx: ReachableContext = { active, blankIds, removedSquareId }

  addStartSeeds(startSquareIds, ctx, adj, visited, queue)

  while (queue.length > 0) {
    const curr = queue.shift()
    if (curr === undefined) break
    const neighbors = adj.get(curr) ?? []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && isTraversable(neighbor, ctx)) {
        addSeedNode(neighbor, visited, queue)
      }
    }
  }

  return visited
}

/**
 * 実サインマス（blankマス以外）の全IDを取得する純関数
 */
export const getPlayableSquareIds = (boardData: ClassBoardData | undefined): number[] => {
  if (!boardData) return []
  return boardData.squares
    .filter((sq) => !sq.flags.includes('blank'))
    .map((sq) => sq.id)
}

/**
 * 中継点（blankマス）の全IDを取得する純関数
 */
export const getBlankSquareIds = (boardData: ClassBoardData | undefined): Set<number> => {
  if (!boardData) return new Set()
  return new Set(
    boardData.squares
      .filter((sq) => sq.flags.includes('blank'))
      .map((sq) => sq.id),
  )
}

/**
 * 指定マスを未解放にした際、起点からそのマスを経由しないと到達できなくなった
 * 「起点と反対側（下流/外側）のマス群」の解放済フラグを一括で外す純関数。
 * 中継点（blankマス）は透過的に通過し、起点マスから有効なマスだけを辿って到達可能なマスのみを解放済として維持する。
 * 「目標」は到達可能性に関係なく維持し、指定マス自身が目標だった場合のみそれを外す
 * （未開放に戻しても、その先の目標プランは崩さないため）。
 */
export const computePrunedOnNone = (
  curBoard: ClassBoardDetailState | undefined,
  removedSquareId: number,
  lines: ClassBoardLine[],
  startSquareIds: number[],
  blankSquareIds: Set<number> = new Set(),
): ClassBoardDetailState => {
  if (!curBoard) {
    return { unlockedSquareIds: [], targetSquareIds: [] }
  }

  const active = new Set([
    ...curBoard.unlockedSquareIds,
    ...curBoard.targetSquareIds,
  ])
  active.delete(removedSquareId)

  const targetSquareIds = curBoard.targetSquareIds.filter((id) => id !== removedSquareId)

  if (active.size === 0) {
    return { unlockedSquareIds: [], targetSquareIds }
  }

  const reachable = findReachableSquares(
    active,
    lines,
    startSquareIds,
    removedSquareId,
    blankSquareIds,
  )

  return {
    unlockedSquareIds: curBoard.unlockedSquareIds.filter((id) => reachable.has(id)),
    targetSquareIds,
  }
}

/**
 * 全実サインマスを一括で目標に設定する純関数（既存の解放済マスは維持）
 */
export const computeBoardAllTarget = (
  curBoard: ClassBoardDetailState | undefined,
  playableSquareIds: number[],
): ClassBoardDetailState => {
  const unlocked = new Set(curBoard?.unlockedSquareIds ?? [])
  const targets = new Set<number>()

  for (const id of playableSquareIds) {
    if (!unlocked.has(id)) {
      targets.add(id)
    }
  }

  return {
    unlockedSquareIds: Array.from(unlocked),
    targetSquareIds: Array.from(targets),
  }
}

/**
 * 全実サインマスを一括で解放済に設定する純関数
 */
export const computeBoardAllUnlocked = (
  playableSquareIds: number[],
): ClassBoardDetailState => ({
  unlockedSquareIds: [...playableSquareIds],
  targetSquareIds: [],
})

/**
 * 盤面の状態からクラススコア全体のステータス（'none' | 'target' | 'completed'）を導出する純関数
 * - 全実サインマスが解放済 -> 'completed'
 * - 全実サインマスが解放済または目標（かつ目標が1つ以上） -> 'target'
 * - それ以外（未設定または一部のみ目標） -> 'none'
 */
export const deriveClassStatusFromBoard = (
  board: ClassBoardDetailState | undefined,
  playableSquareIds: number[],
): ClassScoreStatus => {
  if (!board || playableSquareIds.length === 0) return 'none'
  const unlockedSet = new Set(board.unlockedSquareIds)
  const targetSet = new Set(board.targetSquareIds)

  const allUnlocked = playableSquareIds.every((id) => unlockedSet.has(id))
  if (allUnlocked) return 'completed'

  const allCovered = playableSquareIds.every(
    (id) => unlockedSet.has(id) || targetSet.has(id),
  )
  if (allCovered && targetSet.size > 0) return 'target'

  return 'none'
}


import { getClassBoardData } from './board-loader'
import { deriveClassStatusFromBoard, getPlayableSquareIds } from './route-actions'
import {
  CLASS_SCORE_CLASS_KEYS,
  type ClassBoardDetailState,
  type ClassScoreClassKey,
  type ClassScoreState,
  type ClassScoreStatus,
} from './types'

const toStatus = (value: unknown): ClassScoreStatus =>
  value === 'target' || value === 'completed' ? value : 'none'

export const getBoardDetailOf = (
  state: ClassScoreState,
  key: ClassScoreClassKey,
): ClassBoardDetailState | undefined =>
  state.boards ? Reflect.get(state.boards, key) : undefined

/**
 * クラスのステータスを返す純関数。
 * 盤面（boards）があるクラスは保存されたステータスを使わず、盤面から導出する
 * （部分目標を作った時点で `none` が保存された端末や、同期で戻った古い値でも正しく数えるため）。
 * 盤面が無いクラスは保存されたステータスを使う。
 */
export const resolveClassStatus = (
  state: ClassScoreState,
  key: ClassScoreClassKey,
): ClassScoreStatus => {
  const board = getBoardDetailOf(state, key)
  if (board) {
    return deriveClassStatusFromBoard(board, getPlayableSquareIds(getClassBoardData(key)))
  }
  return toStatus(state.classes ? Reflect.get(state.classes, key) : undefined)
}

/** 全クラスのステータスを {@link resolveClassStatus} で求める純関数。 */
export const resolveClassStatuses = (
  state: ClassScoreState,
): Record<ClassScoreClassKey, ClassScoreStatus> =>
  Object.fromEntries(
    CLASS_SCORE_CLASS_KEYS.map((key) => [key, resolveClassStatus(state, key)]),
  ) as Record<ClassScoreClassKey, ClassScoreStatus>

export type ClassBoardSquareCounts = {
  total: number
  unlocked: number
  /** 目標かつ未解放のマス数 */
  target: number
  /** 解放済でも目標でもないマス数 */
  remaining: number
}

/** 盤面の実サインマスを、解放済・目標（未解放）・それ以外に数える純関数。 */
export const countBoardSquares = (
  board: ClassBoardDetailState | undefined,
  playableSquareIds: number[],
): ClassBoardSquareCounts => {
  const unlockedSet = new Set(board?.unlockedSquareIds ?? [])
  const targetSet = new Set(board?.targetSquareIds ?? [])
  let unlocked = 0
  let target = 0
  for (const id of playableSquareIds) {
    if (unlockedSet.has(id)) unlocked++
    else if (targetSet.has(id)) target++
  }
  const total = playableSquareIds.length
  return { total, unlocked, target, remaining: total - unlocked - target }
}

/**
 * クラスのマス数を数える純関数。盤面が無いクラスは、保存されたステータスが
 * `target` なら全マス目標、`completed` なら全マス解放済として数える。
 */
export const countClassSquares = (
  state: ClassScoreState,
  key: ClassScoreClassKey,
): ClassBoardSquareCounts => {
  const playables = getPlayableSquareIds(getClassBoardData(key))
  const board = getBoardDetailOf(state, key)
  if (board) return countBoardSquares(board, playables)
  const status = resolveClassStatus(state, key)
  const total = playables.length
  if (status === 'target') return { total, unlocked: 0, target: total, remaining: 0 }
  if (status === 'completed') return { total, unlocked: total, target: 0, remaining: 0 }
  return { total, unlocked: 0, target: 0, remaining: total }
}

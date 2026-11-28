import { CLASS_SCORE_BOARDS } from './data'
import {
  CLASS_SCORE_CLASS_KEYS,
  ClassScoreClassKey,
  ClassScoreState,
} from './types'
import { getClassBoardData } from './board-loader'
import { calculateBoardDiffMaterials } from './calculate-board-diff'
import { getBoardDetailOf, resolveClassStatus } from './class-status'
import { getPlayableSquareIds } from './route-actions'

const addAmount = (map: Map<string, number>, id: string, amount: number) => {
  map.set(id, (map.get(id) ?? 0) + amount)
}

const addBoardTotalMaterials = (
  sumMap: Map<string, number>,
  key: ClassScoreClassKey,
) => {
  const board = Reflect.get(CLASS_SCORE_BOARDS, key)
  if (!board) return

  addAmount(sumMap, '1', board.qp)
  board.materials.forEach(({ id, amount }) => addAmount(sumMap, id, amount))
  board.pieces.forEach(({ id, amount }) => addAmount(sumMap, id, amount))
  board.monuments.forEach(({ id, amount }) => addAmount(sumMap, id, amount))
  board.specialItems.forEach(({ id, amount }) => addAmount(sumMap, id, amount))
}

const addBoardDetailMaterials = (
  sumMap: Map<string, number>,
  key: ClassScoreClassKey,
  targetSquareIds: number[],
  unlockedSquareIds: number[],
) => {
  const boardData = getClassBoardData(key)
  if (!boardData) return

  const diff = calculateBoardDiffMaterials(
    boardData,
    targetSquareIds,
    unlockedSquareIds,
  )

  if (diff.qp > 0) addAmount(sumMap, '1', diff.qp)
  if (diff.sand > 0) addAmount(sumMap, '50', diff.sand)
  diff.torches.forEach(({ id, amount }) => addAmount(sumMap, id, amount))
  diff.materials.forEach(({ id, amount }) => addAmount(sumMap, id, amount))
}

const addClassMaterials = (
  sumMap: Map<string, number>,
  state: ClassScoreState,
  key: ClassScoreClassKey,
) => {
  if (resolveClassStatus(state, key) !== 'target') return
  const boardDetail = getBoardDetailOf(state, key)
  if (boardDetail) {
    addBoardDetailMaterials(
      sumMap,
      key,
      boardDetail.targetSquareIds ?? [],
      boardDetail.unlockedSquareIds ?? [],
    )
  } else {
    addBoardTotalMaterials(sumMap, key)
  }
}

/**
 * 1クラスぶんの目標必要素材を求める純関数。
 * ステータスは {@link resolveClassStatus} で求め、`target` のときだけ計上する。
 * 盤面（boards）があるクラスは目標かつ未解放のマスぶん、ないクラスは全体の全量。
 */
export const sumClassScoreClassMaterials = (
  state: ClassScoreState,
  key: ClassScoreClassKey,
): Record<string, number> => {
  const sumMap = new Map<string, number>()
  addClassMaterials(sumMap, state, key)
  return Object.fromEntries(sumMap)
}

/**
 * 1クラスを全マス解放するのに、解放済のマスを除いてあと必要な素材を求める純関数。
 */
export const sumClassScoreFullUnlockMaterials = (
  state: ClassScoreState,
  key: ClassScoreClassKey,
): Record<string, number> => {
  const sumMap = new Map<string, number>()
  const boardData = getClassBoardData(key)
  if (!boardData) {
    addBoardTotalMaterials(sumMap, key)
  } else {
    addBoardDetailMaterials(
      sumMap,
      key,
      getPlayableSquareIds(boardData),
      getBoardDetailOf(state, key)?.unlockedSquareIds ?? [],
    )
  }
  return Object.fromEntries(sumMap)
}

/**
 * クラススコアの全目標必要素材を合算する純関数。
 * 各クラスのステータスは盤面（boards）があれば盤面から導出し、`target` のクラスだけを計上する。
 * 盤面があるクラスは目標かつ未解放のマスぶん、ないクラスは全体目標（'target'）の全量を合算する。
 */
export const sumClassScoreMaterials = (
  state: ClassScoreState,
): Record<string, number> => {
  const sumMap = new Map<string, number>()
  CLASS_SCORE_CLASS_KEYS.forEach((key) => addClassMaterials(sumMap, state, key))
  return Object.fromEntries(sumMap)
}

/**
 * 周回ソルバー連携用：ドロップ対象外の特殊素材（トーチ等）を除外し、
 * 通常素材・ピース・モニュメント・QPのみを抽出したRecordを返す。
 */
export const sumClassScoreFarmingMaterials = (
  state: ClassScoreState,
): Record<string, number> => {
  const all = sumClassScoreMaterials(state)
  const filteredMap = new Map<string, number>()
  const excludedIds = new Set(['51', '52', '53'])

  Object.entries(all).forEach(([id, amount]) => {
    if (!excludedIds.has(id)) {
      filteredMap.set(id, amount)
    }
  })

  return Object.fromEntries(filteredMap)
}

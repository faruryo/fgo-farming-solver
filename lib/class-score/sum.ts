import { CLASS_SCORE_BOARDS } from './data'
import {
  CLASS_SCORE_CLASS_KEYS,
  ClassScoreClassKey,
  ClassScoreState,
} from './types'
import { getClassBoardData } from './board-loader'
import { calculateBoardDiffMaterials } from './calculate-board-diff'

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

/**
 * クラススコアの全目標必要素材を合算する純関数。
 * マス単位の詳細設定（boards）があるクラスはその差分を、ないクラスは全体目標（'target'）の全量を合算する。
 */
export const sumClassScoreMaterials = (
  state: ClassScoreState,
): Record<string, number> => {
  const sumMap = new Map<string, number>()

  CLASS_SCORE_CLASS_KEYS.forEach((key) => {
    const boardDetail = state.boards ? Reflect.get(state.boards, key) : undefined
    const hasDetailTargets = (boardDetail?.targetSquareIds?.length ?? 0) > 0

    if (hasDetailTargets && boardDetail) {
      addBoardDetailMaterials(
        sumMap,
        key,
        boardDetail.targetSquareIds,
        boardDetail.unlockedSquareIds ?? [],
      )
    } else if (Reflect.get(state.classes, key) === 'target') {
      addBoardTotalMaterials(sumMap, key)
    }
  })

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

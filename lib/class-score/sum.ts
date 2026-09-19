import { CLASS_SCORE_BOARDS } from './data'
import { CLASS_SCORE_CLASS_KEYS, ClassScoreState } from './types'

const addAmount = (map: Map<string, number>, id: string, amount: number) => {
  map.set(id, (map.get(id) ?? 0) + amount)
}

/**
 * クラススコアで目標（'target'）に設定されている全クラスの
 * 最大解放必要素材（通常素材、ピース、モニュメント、QP、砂、トーチ）を合算する純関数。
 *
 * @param state ユーザーのクラススコア設定
 * @returns アイテムID（Atlas ID、QPは'1'）をキー、合計必要数を値とするRecord
 */
export const sumClassScoreMaterials = (
  state: ClassScoreState,
): Record<string, number> => {
  const sumMap = new Map<string, number>()

  CLASS_SCORE_CLASS_KEYS.forEach((key) => {
    if (Reflect.get(state.classes, key) !== 'target') return
    const board = Reflect.get(CLASS_SCORE_BOARDS, key)
    if (!board) return

    // QP
    addAmount(sumMap, '1', board.qp)

    // 通常素材
    board.materials.forEach(({ id, amount }) => {
      addAmount(sumMap, id, amount)
    })

    // ピース
    board.pieces.forEach(({ id, amount }) => {
      addAmount(sumMap, id, amount)
    })

    // モニュメント
    board.monuments.forEach(({ id, amount }) => {
      addAmount(sumMap, id, amount)
    })

    // 特殊アイテム（砂・トーチ）
    board.specialItems.forEach(({ id, amount }) => {
      addAmount(sumMap, id, amount)
    })
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
  // トーチ (51, 52, 53) は周回ドロップ対象外のため除外
  const excludedIds = new Set(['51', '52', '53'])

  Object.entries(all).forEach(([id, amount]) => {
    if (!excludedIds.has(id)) {
      filteredMap.set(id, amount)
    }
  })

  return Object.fromEntries(filteredMap)
}

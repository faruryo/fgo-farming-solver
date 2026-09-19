import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import type { MaterialsForServants } from '../get-materials'
import { sumMaterials } from '../sum-materials'
import { mergeMaterials } from './merge-materials'
import { readClassScoreState } from './read-state'
import { sumClassScoreMaterials } from './sum'
import type { ClassScoreState } from './types'

/**
 * サーヴァント育成目標とクラススコア目標を合算した全体の必要素材数を計算する。
 *
 * @param chaldeaState サーヴァント育成目標状態
 * @param materials サーヴァント素材マスタ
 * @param classScoreState 省略時は localStorage から読み出し
 * @returns アイテムIDをキーとする合算必要素材数
 */
export const calculateTotalRequiredMaterials = (
  chaldeaState: ChaldeaState,
  materials: MaterialsForServants,
  classScoreState?: ClassScoreState,
): Record<string, number> => {
  const svt = sumMaterials(chaldeaState, materials)
  const csState = classScoreState ?? readClassScoreState()
  const cs = sumClassScoreMaterials(csState)
  return mergeMaterials(svt, cs)
}

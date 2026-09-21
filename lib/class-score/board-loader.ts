import type { ClassScoreClassKey } from './types'
import type { ClassBoardData } from './board-types'

import saberData from '../../data/class-board/saber.json'
import archerData from '../../data/class-board/archer.json'
import lancerData from '../../data/class-board/lancer.json'
import riderData from '../../data/class-board/rider.json'
import casterData from '../../data/class-board/caster.json'
import assassinData from '../../data/class-board/assassin.json'
import berserkerData from '../../data/class-board/berserker.json'
import extra1Data from '../../data/class-board/extra1.json'
import extra2Data from '../../data/class-board/extra2.json'

const BOARDS_MAP = new Map<ClassScoreClassKey, ClassBoardData>([
  ['saber', saberData as unknown as ClassBoardData],
  ['archer', archerData as unknown as ClassBoardData],
  ['lancer', lancerData as unknown as ClassBoardData],
  ['rider', riderData as unknown as ClassBoardData],
  ['caster', casterData as unknown as ClassBoardData],
  ['assassin', assassinData as unknown as ClassBoardData],
  ['berserker', berserkerData as unknown as ClassBoardData],
  ['extra1', extra1Data as unknown as ClassBoardData],
  ['extra2', extra2Data as unknown as ClassBoardData],
])

/**
 * 指定されたクラスのボードデータを取得する純関数
 */
export const getClassBoardData = (
  key: ClassScoreClassKey,
): ClassBoardData | undefined => {
  return BOARDS_MAP.get(key)
}

/**
 * 全9クラスのボードデータを取得する純関数
 */
export const getAllClassBoards = (): Record<
  ClassScoreClassKey,
  ClassBoardData
> => {
  return Object.fromEntries(BOARDS_MAP.entries()) as Record<
    ClassScoreClassKey,
    ClassBoardData
  >
}

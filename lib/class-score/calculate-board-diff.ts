import type { ClassBoardData, ClassBoardSquareItem } from './board-types'

export type ClassBoardDiffMaterials = {
  qp: number
  sand: number
  torches: ClassBoardSquareItem[]
  materials: ClassBoardSquareItem[]
  activeTargetCount: number
}

const TORCH_NAMES = new Map<string, string>([
  ['51', '新星のトーチ'],
  ['52', '明星のトーチ'],
  ['53', '極星のトーチ'],
])

const aggregateSquareItems = (
  items: ClassBoardSquareItem[],
  materialMap: Map<string, ClassBoardSquareItem>,
  torchMap: Map<string, number>,
): { qp: number; sand: number } => {
  let qp = 0
  let sand = 0

  for (const it of items) {
    if (it.id === '1') {
      qp += it.amount
    } else if (it.id === '50') {
      sand += it.amount
    } else if (TORCH_NAMES.has(it.id)) {
      torchMap.set(it.id, (torchMap.get(it.id) ?? 0) + it.amount)
    } else {
      const existing = materialMap.get(it.id)
      if (existing) {
        existing.amount += it.amount
      } else {
        materialMap.set(it.id, { id: it.id, name: it.name, amount: it.amount })
      }
    }
  }

  return { qp, sand }
}

/**
 * 目標マスから解放済みマスを除いた差分必要素材を算出する純関数
 */
export const calculateBoardDiffMaterials = (
  board: ClassBoardData,
  targetSquareIds: number[],
  unlockedSquareIds: number[] = [],
): ClassBoardDiffMaterials => {
  const unlockedSet = new Set(unlockedSquareIds)
  const targetSet = new Set(targetSquareIds)

  const squareMap = new Map(board.squares.map((sq) => [sq.id, sq]))
  const materialMap = new Map<string, ClassBoardSquareItem>()
  const torchMap = new Map<string, number>()

  let totalQp = 0
  let totalSand = 0
  let activeTargetCount = 0

  for (const id of targetSet) {
    if (unlockedSet.has(id)) continue
    const sq = squareMap.get(id)
    if (!sq) continue

    activeTargetCount++
    const { qp, sand } = aggregateSquareItems(sq.items, materialMap, torchMap)
    totalQp += qp
    totalSand += sand
  }

  const torches: ClassBoardSquareItem[] = ['51', '52', '53']
    .filter((id) => (torchMap.get(id) ?? 0) > 0)
    .map((id) => ({
      id,
      name: TORCH_NAMES.get(id) ?? 'トーチ',
      amount: torchMap.get(id) ?? 0,
    }))

  return {
    qp: totalQp,
    sand: totalSand,
    torches,
    materials: Array.from(materialMap.values()),
    activeTargetCount,
  }
}

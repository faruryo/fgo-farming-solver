import type { ClassBoardLine } from './board-types'

export type LineEndpoints = {
  endpointA: number
  endpointB: number
}

const buildAdjacencyWithLines = (
  lines: ClassBoardLine[],
): Map<number, { neighbor: number; lineId: number }[]> => {
  const adj = new Map<number, { neighbor: number; lineId: number }[]>()
  for (const line of lines) {
    const listPrev = adj.get(line.prev) ?? []
    listPrev.push({ neighbor: line.next, lineId: line.id })
    adj.set(line.prev, listPrev)

    const listNext = adj.get(line.next) ?? []
    listNext.push({ neighbor: line.prev, lineId: line.id })
    adj.set(line.next, listNext)
  }
  return adj
}

const findNonBlankEndpoint = (
  startNodeId: number,
  avoidNodeId: number,
  adj: Map<number, { neighbor: number; lineId: number }[]>,
  blankSquareIds: Set<number>,
): number => {
  if (!blankSquareIds.has(startNodeId)) {
    return startNodeId
  }

  let curr = startNodeId
  const visited = new Set<number>([avoidNodeId, curr])

  while (blankSquareIds.has(curr)) {
    const neighbors = adj.get(curr) ?? []
    const nextHop = neighbors.find((n) => !visited.has(n.neighbor))
    if (!nextHop) break

    curr = nextHop.neighbor
    visited.add(curr)
  }

  return curr
}

/**
 * 盤面の各ラインについて、中継点（blankマス）を透過して
 * そのラインが接続している両端の「実サインマス（playable）」を解決する純関数。
 *
 * 中継点（blankノード）が挟まる折れ線セグメント群（例: A - Blank1 - Blank2 - B）は、
 * すべて同一の実端点ペア { endpointA: A, endpointB: B } を持つようになり、
 * ライン描画時に途中で色や太さが分裂することなく一本の接続として描画できるようになります。
 */
export const resolveLineEndpoints = (
  lines: ClassBoardLine[],
  blankSquareIds: Set<number>,
): Map<number, LineEndpoints> => {
  const result = new Map<number, LineEndpoints>()
  if (lines.length === 0) return result

  const adj = buildAdjacencyWithLines(lines)

  for (const line of lines) {
    const endpointA = findNonBlankEndpoint(line.prev, line.next, adj, blankSquareIds)
    const endpointB = findNonBlankEndpoint(line.next, line.prev, adj, blankSquareIds)
    result.set(line.id, { endpointA, endpointB })
  }

  return result
}

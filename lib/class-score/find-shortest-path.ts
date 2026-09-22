import type { ClassBoardLine } from './board-types'

const addEdge = (adj: Map<number, number[]>, u: number, v: number) => {
  const neighbors = adj.get(u)
  if (neighbors) {
    neighbors.push(v)
  } else {
    adj.set(u, [v])
  }
}

const buildAdjacencyList = (lines: ClassBoardLine[]) => {
  const adj = new Map<number, number[]>()
  for (const line of lines) {
    addEdge(adj, line.prev, line.next)
    addEdge(adj, line.next, line.prev)
  }
  return adj
}

/**
 * 盤面の接続ライン情報から、起点マスから対象マスまでの最短経路（ノードID配列）を探索する純関数（BFS）
 */
export const findShortestPath = (
  lines: ClassBoardLine[],
  startSquareId: number,
  targetSquareId: number,
): number[] => {
  if (startSquareId === targetSquareId) return [startSquareId]

  const adj = buildAdjacencyList(lines)
  const queue: number[] = [startSquareId]
  const parent = new Map<number, number>()
  const visited = new Set<number>([startSquareId])

  while (queue.length > 0) {
    const curr = queue.shift()
    if (curr === undefined || curr === targetSquareId) break

    const neighbors = adj.get(curr) ?? []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        parent.set(neighbor, curr)
        queue.push(neighbor)
      }
    }
  }

  if (!visited.has(targetSquareId)) return []

  const path: number[] = []
  let curr: number | undefined = targetSquareId
  while (curr !== undefined) {
    path.unshift(curr)
    curr = parent.get(curr)
  }

  return path
}

/**
 * 複数の起点マスのうち、対象マスに到達可能かつ最短の経路を探索する純関数
 */
export const findShortestPathFromStarts = (
  lines: ClassBoardLine[],
  startSquareIds: number[],
  targetSquareId: number,
): number[] => {
  if (startSquareIds.includes(targetSquareId)) return [targetSquareId]

  let bestPath: number[] = []

  for (const startId of startSquareIds) {
    const path = findShortestPath(lines, startId, targetSquareId)
    if (path.length > 0) {
      if (bestPath.length === 0 || path.length < bestPath.length) {
        bestPath = path
      }
    }
  }

  return bestPath
}

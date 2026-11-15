import type { ChaldeaState } from '../hooks/create-chaldea-state'

/**
 * スクリーンショットから取り込むサーヴァントの所持の印を書く純粋関数。
 * 未所持のものだけを「所持」にし、同じサーヴァントのほかの値（育成計画の今と目標）、すべてのサーヴァントに共通の目標（`all`）、
 * 取り込まないサーヴァント、既に所持のサーヴァントは同じ値のまま返す。前の状態に無い ID は足さずに飛ばす。
 */

const ALL_KEY = 'all'

const targetSet = (ids: readonly (string | number)[]): Set<string> => {
  const set = new Set(ids.map(String))
  set.delete(ALL_KEY)
  return set
}

/** 新しく所持になる（前の状態にあり、今は未所持の）ID */
const newlyOwnedIds = (prev: ChaldeaState, ids: readonly (string | number)[]): Set<string> => {
  const targets = targetSet(ids)
  return new Set(Object.entries(prev).filter(([id, s]) => targets.has(id) && s.disabled).map(([id]) => id))
}

/** 新しく所持になるサーヴァントの数 */
export const countNewlyOwned = (prev: ChaldeaState, ids: readonly (string | number)[]): number =>
  newlyOwnedIds(prev, ids).size

/** 取り込むサーヴァントのうち未所持のものだけを「所持」にした新しい状態。変わるものが無ければ前の状態をそのまま返す */
export const withOwnedServants = (prev: ChaldeaState, ids: readonly (string | number)[]): ChaldeaState => {
  const changed = newlyOwnedIds(prev, ids)
  if (changed.size === 0) return prev
  return Object.fromEntries(
    Object.entries(prev).map(([id, s]) => [id, changed.has(id) ? { ...s, disabled: false } : s]),
  )
}

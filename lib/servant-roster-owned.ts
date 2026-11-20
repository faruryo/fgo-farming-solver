import type { ChaldeaState, ServantState } from '../hooks/create-chaldea-state'

/**
 * スクリーンショットから取り込むサーヴァントの所持の印と、スキルの「今」のLv を書く純粋関数。
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

const SKILL_COUNT = 3
const SKILL_END_DEFAULT = 10

/** 育成計算機のスキル1〜3の今の値（`start`。欄が足りなければ 1） */
export const currentSkills = (state: ServantState | undefined): number[] =>
  Array.from({ length: SKILL_COUNT }, (_, i) => state?.targets.skill.ranges.at(i)?.start ?? 1)

/** サーヴァントごとのスキルの今の値（`all` は除く） */
export const currentSkillsById = (state: ChaldeaState): Record<string, number[]> =>
  Object.fromEntries(
    Object.entries(state)
      .filter(([id]) => id !== ALL_KEY)
      .map(([id, s]) => [id, currentSkills(s)]),
  )

/**
 * 取り込む行のスキル1〜3の Lv を、育成計算機のスキルの「今」（`start`）に書いた新しい状態。
 * 目標（`end`）・再臨・アペンドスキル・所持の印は変えず、値が無い（`null`）スキルと `skills` の無い行は前の値のまま。
 * 前の状態に無い ID と `all` は足さずに飛ばす。書くものが無ければ前の状態をそのまま返す。
 */
export const withCurrentSkills = (
  prev: ChaldeaState,
  rows: readonly { id: string | number; skills?: readonly (number | null)[] }[],
): ChaldeaState => {
  const skillsById = new Map(rows.flatMap((row) => (row.skills ? [[String(row.id), row.skills] as const] : [])))
  skillsById.delete(ALL_KEY)
  if (!Object.keys(prev).some((id) => skillsById.has(id))) return prev
  return Object.fromEntries(
    Object.entries(prev).map(([id, state]) => {
      const skills = skillsById.get(id)
      if (!skills) return [id, state]
      const ranges = Array.from({ length: SKILL_COUNT }, (_, i) => {
        const range = state.targets.skill.ranges.at(i) ?? { start: 1, end: SKILL_END_DEFAULT }
        return { ...range, start: skills.at(i) ?? range.start }
      })
      return [id, { ...state, targets: { ...state.targets, skill: { ...state.targets.skill, ranges } } }]
    }),
  )
}

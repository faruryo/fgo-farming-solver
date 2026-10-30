import type { BondQuestCandidate } from './quest-candidates'
import { defaultBondQuestId } from './state'

/**
 * 選んだサーヴァント全員の周回クエストの候補に共通するクエストを、先頭のサーヴァントの並び順で返す。
 * 0体のときは空集合の共通部分を「全クエスト」とせず空を返す。
 */
export const sharedBondQuestCandidates = (
  candidateLists: readonly (readonly BondQuestCandidate[])[],
): BondQuestCandidate[] => {
  const [first, ...rest] = candidateLists
  if (!first) return []
  const restById = rest.map(list => new Map(list.map(candidate => [candidate.quest.id, candidate])))
  return first.flatMap(candidate => {
    const others = restById.map(byId => byId.get(candidate.quest.id))
    if (others.some(other => !other)) return []
    const unconfirmedClass = candidate.unconfirmedClass || others.some(other => other?.unconfirmedClass)
    return [{ ...candidate, unconfirmedClass }]
  })
}

/** 先頭のサーヴァントの周回クエストが共通の候補にあればそれ、なければ対象クラス未確認ではない先頭。 */
export const defaultSharedBondQuestId = (
  shared: readonly BondQuestCandidate[],
  leadQuestId: string | undefined,
): string | undefined =>
  leadQuestId !== undefined && shared.some(candidate => candidate.quest.id === leadQuestId)
    ? leadQuestId
    : defaultBondQuestId(shared)

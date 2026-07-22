import { CardCandidate, MergedCandidate } from './types'

/**
 * 複数画像・複数カードのOCR候補を Atlas ID 単位に統合する。
 * - 同一値の重複は1件化する。
 * - 値が食い違う場合は「矛盾あり」として自動確定しない。
 * - 画像端で見切れたカードは、同じアイテムの全体表示カードがあればそちらを優先する
 *   （design.md「画像端で見切れたカードの扱い」）。
 */
export const mergeCandidates = (
  candidates: CardCandidate[],
  currentPossession: Record<number, number | undefined>,
  nameById: Map<number, string>
): MergedCandidate[] => {
  const identified = candidates.filter(
    (c): c is CardCandidate & { atlasId: number } => c.atlasId !== null
  )

  const byAtlasId = new Map<number, CardCandidate[]>()
  for (const c of identified) {
    const arr = byAtlasId.get(c.atlasId) ?? []
    arr.push(c)
    byAtlasId.set(c.atlasId, arr)
  }

  const merged: MergedCandidate[] = []
  for (const [atlasId, sources] of byAtlasId) {
    const nonClipped = sources.filter((s) => !s.clipped)
    const authoritative = nonClipped.length > 0 ? nonClipped : sources
    const onlyClipped = nonClipped.length === 0

    const distinctQuantities = [
      ...new Set(
        authoritative
          .map((s) => s.quantity)
          .filter((q): q is number => q !== null)
      ),
    ]

    const hasConflict = distinctQuantities.length > 1
    const proposedQuantity = distinctQuantities.length === 1 ? distinctQuantities[0] : null

    merged.push({
      atlasId,
      name: nameById.get(atlasId) ?? sources[0].matchedName ?? String(atlasId),
      currentQuantity: currentPossession[atlasId] ?? 0,
      proposedQuantity,
      sources,
      hasConflict,
      needsReview: onlyClipped || hasConflict || proposedQuantity === null,
      excluded: false,
    })
  }

  return merged.sort((a, b) => {
    if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1
    return 0
  })
}

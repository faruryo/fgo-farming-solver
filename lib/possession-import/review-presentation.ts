/** スクリーンショット取り込みレビューの増減分類・並び・フィルタ（純関数） */

export type QuantityChangeClass = 'increase' | 'decrease' | 'unchanged' | 'unknown'
export type ReviewSection = 'needs-review' | 'increase' | 'decrease' | 'unchanged'
export type ReviewFilter = 'all' | 'changed' | 'needs-review'

export type ReviewRowSource = {
  atlasId: number
  name: string
  currentQuantity: number
  parsedProposed: number | null
  needsReview: boolean
  hasConflict: boolean
}

export type ReviewRow = ReviewRowSource & {
  changeClass: QuantityChangeClass
  section: ReviewSection
  delta: number | null
}

export const REVIEW_SECTION_ORDER: ReviewSection[] = [
  'needs-review',
  'increase',
  'decrease',
  'unchanged',
]

const SECTION_RANK: Record<ReviewSection, number> = {
  'needs-review': 0,
  increase: 1,
  decrease: 2,
  unchanged: 3,
}

export const classifyQuantityChange = (
  current: number,
  proposed: number | null
): QuantityChangeClass => {
  if (proposed === null) return 'unknown'
  if (proposed > current) return 'increase'
  if (proposed < current) return 'decrease'
  return 'unchanged'
}

export const signedDelta = (current: number, proposed: number | null): number | null =>
  proposed === null ? null : proposed - current

export const reviewSection = (source: ReviewRowSource): ReviewSection => {
  const changeClass = classifyQuantityChange(source.currentQuantity, source.parsedProposed)
  if (source.needsReview || source.hasConflict || changeClass === 'unknown') {
    return 'needs-review'
  }
  return changeClass
}

export const toReviewRow = (source: ReviewRowSource): ReviewRow => ({
  ...source,
  changeClass: classifyQuantityChange(source.currentQuantity, source.parsedProposed),
  section: reviewSection(source),
  delta: signedDelta(source.currentQuantity, source.parsedProposed),
})

export const compareReviewRows = (a: ReviewRow, b: ReviewRow): number => {
  const sectionDiff = SECTION_RANK[a.section] - SECTION_RANK[b.section]
  if (sectionDiff !== 0) return sectionDiff
  if (a.section === 'increase' || a.section === 'decrease') {
    const absDiff = Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
    if (absDiff !== 0) return absDiff
  }
  return a.name.localeCompare(b.name, 'ja')
}

export const sortReviewRows = (rows: ReviewRow[]): ReviewRow[] =>
  [...rows].sort(compareReviewRows)

export const matchesReviewFilter = (
  section: ReviewSection,
  filter: ReviewFilter
): boolean => {
  if (filter === 'all') return true
  if (filter === 'changed') return section !== 'unchanged'
  return section === 'needs-review'
}

export const isReviewRowVisible = (
  section: ReviewSection,
  filter: ReviewFilter,
  atlasId: number,
  editingAtlasId: number | null
): boolean => matchesReviewFilter(section, filter) || atlasId === editingAtlasId

export const countBySection = (rows: ReviewRow[]): Record<ReviewSection, number> => {
  const counts: Record<ReviewSection, number> = {
    'needs-review': 0,
    increase: 0,
    decrease: 0,
    unchanged: 0,
  }
  for (const row of rows) counts[row.section] += 1
  return counts
}

export const groupReviewRows = (
  rows: ReviewRow[],
  filter: ReviewFilter
): { section: ReviewSection; rows: ReviewRow[] }[] => {
  const grouped = new Map<ReviewSection, ReviewRow[]>()
  for (const section of REVIEW_SECTION_ORDER) grouped.set(section, [])
  for (const row of rows) {
    if (!matchesReviewFilter(row.section, filter)) continue
    grouped.get(row.section)?.push(row)
  }
  return REVIEW_SECTION_ORDER.filter((section) => (grouped.get(section)?.length ?? 0) > 0).map(
    (section) => ({ section, rows: grouped.get(section) ?? [] })
  )
}

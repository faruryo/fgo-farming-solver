import { CLASS_LIST, type ClassId } from '../constants/classes'

export const SERVANT_FILTERS = ['all', 'hide-unowned', 'only-unowned', 'hide-done', 'only-done'] as const
export const SERVANT_SORT_MODES = ['collectionNo', 'new', 'rarity-desc', 'rarity-asc'] as const
export type ServantFilter = (typeof SERVANT_FILTERS)[number]
export type ServantSortMode = (typeof SERVANT_SORT_MODES)[number]

/** 育成計画ページの絞り込みと並び順。イベントボーナスの絞り込みは終わると選択肢ごと消えるので入れない。 */
export type MaterialView = {
  class: ClassId
  rarities: number[]
  servantFilter: ServantFilter
  sortMode: ServantSortMode
}

export const DEFAULT_MATERIAL_VIEW: MaterialView = { class: 'all', rarities: [], servantFilter: 'all', sortMode: 'collectionNo' }

const includes = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

/** `useLocalStorage` の `onGet` 用。知らない値は項目ごとに初期値へ落とす（選択肢を後で減らしても壊れない）。 */
export const parseMaterialView = (item: unknown): MaterialView => {
  const v = item !== null && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
  return {
    class: includes(CLASS_LIST.map(c => c.id), v.class) ? v.class : DEFAULT_MATERIAL_VIEW.class,
    rarities: Array.isArray(v.rarities) ? [...new Set((v.rarities as unknown[]).filter((r): r is number => typeof r === 'number' && [1, 2, 3, 4, 5].includes(r)))] : [],
    servantFilter: includes(SERVANT_FILTERS, v.servantFilter) ? v.servantFilter : DEFAULT_MATERIAL_VIEW.servantFilter,
    sortMode: includes(SERVANT_SORT_MODES, v.sortMode) ? v.sortMode : DEFAULT_MATERIAL_VIEW.sortMode,
  }
}

/** 並び順は件数を減らさないので絞り込みに数えない。 */
export const hasViewFilter = (v: MaterialView): boolean =>
  v.class !== 'all' || v.rarities.length > 0 || v.servantFilter !== 'all'

/** `#svt-<id>` で外している間（`overridden`）は、保存値でなく見えている初期値を元に変える。 */
export const applyViewPatch = (
  overridden: boolean,
  saved: MaterialView,
  patch: (v: MaterialView) => Partial<MaterialView>,
): MaterialView => {
  const base = overridden ? DEFAULT_MATERIAL_VIEW : saved
  return { ...base, ...patch(base) }
}

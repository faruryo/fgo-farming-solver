import { EnrichedItem } from '../get-items'
import { toApiItemId } from '../to-api-item-id'
import { computeFiniteTarget, StockBuffer } from '../quest-efficiency'
import type { FarmingPurpose } from '../farming-purpose'
import { hasSelectedQuests, hasSubmittableItems } from './submit-solve'

export const toStockItemLike = (item: {
  id: string | number
  category?: string
  largeCategory?: string
}): { id: string; category: string; largeCategory: string } => ({
  id: item.id.toString(),
  category: item.category ?? '',
  largeCategory: item.largeCategory ?? '',
})

export const buildQueryItemsA = (
  solverItems: EnrichedItem[],
  amounts: Record<string, number>,
  possession: Record<string, number | undefined>,
  items: EnrichedItem[],
): string => {
  const plainDeficiency = (item: EnrichedItem): number =>
    Math.max(
      0,
      (amounts[item.id.toString()] ?? 0) -
        (possession[item.id.toString()] ?? 0),
    )
  return solverItems
    .filter((item) => plainDeficiency(item) > 0 && toApiItemId(item, items))
    .map((item) => `${toApiItemId(item, items)}:${plainDeficiency(item)}`)
    .join(',')
}

export const buildQueryItemsB = (
  solverItems: EnrichedItem[],
  amounts: Record<string, number>,
  possession: Record<string, number | undefined>,
  purpose: FarmingPurpose | boolean,
  resolvedStockBuffer: StockBuffer,
  items: EnrichedItem[],
): string => {
  if (purpose !== 'reserve' && purpose !== true) return ''
  const effDef = (item: EnrichedItem): number =>
    Math.max(
      0,
      computeFiniteTarget(
        toStockItemLike(item),
        amounts[item.id.toString()] ?? 0,
        resolvedStockBuffer,
        'reserve',
      ) - (possession[item.id.toString()] ?? 0),
    )
  return solverItems
    .filter((item) => effDef(item) > 0 && toApiItemId(item, items))
    .map((item) => `${toApiItemId(item, items)}:${effDef(item)}`)
    .join(',')
}

export interface BuildSolveParamsInput {
  solverItems: EnrichedItem[]
  amounts: Record<string, number>
  possession: Record<string, number | undefined>
  purpose?: FarmingPurpose
  /** 旧呼び出し互換。新規コードは purpose を使う。 */
  stockEnabled?: boolean
  resolvedStockBuffer: StockBuffer
  items: EnrichedItem[]
  checkedQuests: string[]
}

export interface BuildSolveParamsResult {
  queryItemsA: string
  queryItemsB: string
  needsItemTarget: boolean
  needsQuestSelection: boolean
  params: URLSearchParams | null
}

export const buildSolveParams = (
  input: BuildSolveParamsInput,
): BuildSolveParamsResult => {
  const queryItemsA = buildQueryItemsA(
    input.solverItems,
    input.amounts,
    input.possession,
    input.items,
  )
  const queryItemsB = buildQueryItemsB(
    input.solverItems,
    input.amounts,
    input.possession,
    input.purpose ?? (input.stockEnabled ? 'reserve' : 'training'),
    input.resolvedStockBuffer,
    input.items,
  )

  const selectedItems = hasSubmittableItems(queryItemsB)
    ? queryItemsB
    : queryItemsA
  const needsItemTarget = !hasSubmittableItems(selectedItems)
  const needsQuestSelection = !hasSelectedQuests(input.checkedQuests)

  if (needsItemTarget || needsQuestSelection) {
    return {
      queryItemsA: selectedItems,
      queryItemsB: '',
      needsItemTarget,
      needsQuestSelection,
      params: null,
    }
  }

  const params = new URLSearchParams({
    items: selectedItems,
    quests: input.checkedQuests.join(','),
    fields: 'id',
  })

  return {
    queryItemsA: selectedItems,
    queryItemsB: '',
    needsItemTarget,
    needsQuestSelection,
    params,
  }
}

import { EnrichedItem } from '../get-items'
import { toApiItemId } from '../to-api-item-id'
import { effectiveDeficiency, StockBuffer } from '../quest-efficiency'
import { hasSelectedQuests, hasSubmittableItems } from './submit-solve'

export const toStockItemLike = (
  item: { id: string | number; category?: string; largeCategory?: string }
): { id: string; category: string; largeCategory: string } => ({
  id: item.id.toString(),
  category: item.category ?? '',
  largeCategory: item.largeCategory ?? '',
})

export const buildQueryItemsA = (
  solverItems: EnrichedItem[],
  amounts: Record<string, number>,
  possession: Record<string, number | undefined>,
  items: EnrichedItem[]
): string => {
  const plainDeficiency = (item: EnrichedItem): number =>
    Math.max(
      0,
      (amounts[item.id.toString()] ?? 0) - (possession[item.id.toString()] ?? 0)
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
  stockEnabled: boolean,
  resolvedStockBuffer: StockBuffer,
  items: EnrichedItem[]
): string => {
  if (!stockEnabled) return ''
  const effDef = (item: EnrichedItem): number =>
    effectiveDeficiency(
      toStockItemLike(item),
      amounts[item.id.toString()] ?? 0,
      possession[item.id.toString()] ?? 0,
      resolvedStockBuffer,
      true
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
  stockEnabled: boolean
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
  input: BuildSolveParamsInput
): BuildSolveParamsResult => {
  const queryItemsA = buildQueryItemsA(
    input.solverItems,
    input.amounts,
    input.possession,
    input.items
  )
  const queryItemsB = buildQueryItemsB(
    input.solverItems,
    input.amounts,
    input.possession,
    input.stockEnabled,
    input.resolvedStockBuffer,
    input.items
  )

  const needsItemTarget =
    !hasSubmittableItems(queryItemsA) && !hasSubmittableItems(queryItemsB)
  const needsQuestSelection = !hasSelectedQuests(input.checkedQuests)

  if (needsItemTarget || needsQuestSelection) {
    return {
      queryItemsA,
      queryItemsB,
      needsItemTarget,
      needsQuestSelection,
      params: null,
    }
  }

  // 目標Aが0件(stock-only)のときは目標Bを唯一の items として単独送信する
  // (itemsStock は付けず2目標バッチにしない。design.md 参照)。
  const itemsParam = hasSubmittableItems(queryItemsA) ? queryItemsA : queryItemsB
  // B と A が完全一致(全素材 buffer=0)のときは itemsStock を送らない。
  const includeStock =
    hasSubmittableItems(queryItemsA) &&
    hasSubmittableItems(queryItemsB) &&
    queryItemsB !== queryItemsA

  const params = new URLSearchParams({
    items: itemsParam,
    ...(includeStock ? { itemsStock: queryItemsB } : {}),
    quests: input.checkedQuests.join(','),
    fields: 'id',
  })

  return {
    queryItemsA,
    queryItemsB,
    needsItemTarget,
    needsQuestSelection,
    params,
  }
}

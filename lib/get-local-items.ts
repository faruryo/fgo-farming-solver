import { getItems, EnrichedItem } from './get-items'
import { toApiItemId } from './to-api-item-id'

type Item = { id: string; category: string; name: string }
export type Localized<I extends Item> = I & {
  largeCategory: string
  shortName: string
  icon?: string
}

export const getLocalItems = async <I extends Item>(
  items: I[],
  locale = 'ja'
): Promise<Localized<I>[]> => {
  if (items.length === 0) return []

  let atlasItemMap = new Map<string, EnrichedItem>()
  try {
    const atlasItems = await getItems(locale)
    atlasItemMap = atlasItems.reduce(
      (map, item) => map.set(toApiItemId(item, atlasItems), item),
      new Map<string, EnrichedItem>()
    )
  } catch {
    // Atlas Academy unavailable — fall back to master data names
  }

  return items.map(({ id, category, name, ...rest }) => {
    const atlasItem = atlasItemMap.get(id)
    return {
      id,
      category: atlasItem?.category ?? category,
      largeCategory: atlasItem?.largeCategory ?? '',
      shortName: name,
      name: atlasItem?.name ?? name,
      icon: atlasItem?.icon,
      ...rest,
    } as Localized<I>
  })
}

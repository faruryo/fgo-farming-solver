import { getItems, EnrichedItem } from './get-items'
import { toApiItemId } from './to-api-item-id'

type Item = { id: string; category: string; name: string }
export type Localized<I extends Item> = I & {
  largeCategory: string
  shortName: string
  icon?: string
  /** Atlas Academy のアイテムID。育成計算機(material/result・所持数)と同じID空間で連動するために保持。 */
  atlasId?: number
}

export const getLocalItems = async <I extends Item>(
  items: I[],
  locale = 'ja'
): Promise<Localized<I>[]> => {
  if (items.length === 0) return []

  let atlasItemMap = new Map<string, EnrichedItem>()
  let atlasItemById = new Map<number, EnrichedItem>()
  try {
    const atlasItems = await getItems(locale)
    atlasItemMap = atlasItems.reduce(
      (map, item) => map.set(toApiItemId(item, atlasItems), item),
      new Map<string, EnrichedItem>()
    )
    // 短縮IDは世代間で固定化される（stable-ids）ため、Atlas 側の並び替えで
    // toApiItemId の位置ベースIDとずれる（別アイテムを指す）ことがある。
    // atlasId が判明している場合はそちらを正としてアイコン/カテゴリ解決する。
    atlasItemById = atlasItems.reduce(
      (map, item) => map.set(item.id, item),
      new Map<number, EnrichedItem>()
    )
  } catch {
    // Atlas Academy unavailable — fall back to master data names
  }

  return items.map(({ id, category, name, ...rest }) => {
    const masterAtlasId = (rest as { atlasId?: number }).atlasId
    const atlasItem =
      (masterAtlasId != null ? atlasItemById.get(masterAtlasId) : undefined) ??
      atlasItemMap.get(id)
    return {
      id,
      category: atlasItem?.category ?? category,
      largeCategory: atlasItem?.largeCategory ?? '',
      shortName: name,
      name: atlasItem?.name ?? name,
      icon: atlasItem?.icon,
      atlasId: atlasItem?.id,
      ...rest,
    } as Localized<I>
  })
}

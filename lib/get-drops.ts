import { Campaign, DropRate, Item, Quest } from '../interfaces/fgodrop'
import { fetchData } from './data-source'
import { Localized } from './get-local-items'
import { getItems } from './get-items'
import { toApiItemId } from './to-api-item-id'

export type Drops = {
  items: Localized<Item>[]
  quests: Quest[]
  drop_rates: DropRate[]
  campaigns: Campaign[]
}

const MASTER_DATA_KEY = 'all_drops_json'
const MOCK_PATH = 'mocks/all.json'

const EMPTY: Drops = { items: [], quests: [], drop_rates: [], campaigns: [] }

export const getDrops = async (): Promise<Drops> => {
  type RawDrops = {
    items: Localized<Item>[]
    quests: Quest[]
    drop_rates: DropRate[]
    campaigns?: Campaign[]
  }
  const data = await fetchData<RawDrops>(MASTER_DATA_KEY, MOCK_PATH)
  if (!data) return EMPTY

  return {
    items: await backfillAtlasIds(data.items || []),
    quests: data.quests || [],
    drop_rates: data.drop_rates || [],
    campaigns: data.campaigns || [],
  }
}

/**
 * 旧マスターデータには `atlasId` が無いため、欠けている分だけ実行時に補完する。
 * 短縮ID → Atlas ID の対応は `getLocalItems` と同じ `toApiItemId` で求める。
 * 既存フィールドは一切変更せず、`atlasId` が既にあれば何もしない(モック/新データは no-op)。
 * これにより育成計算機(material/result・所持数)と同じ Atlas ID 空間で確実に連動する。
 */
const backfillAtlasIds = async (
  items: Localized<Item>[]
): Promise<Localized<Item>[]> => {
  if (items.length === 0 || items.every(i => i.atlasId != null)) return items
  try {
    const atlasItems = await getItems()
    const idToAtlas = new Map(
      atlasItems.map(item => [toApiItemId(item, atlasItems), item.id])
    )
    return items.map(item =>
      item.atlasId != null ? item : { ...item, atlasId: idToAtlas.get(item.id) }
    )
  } catch {
    // Atlas Academy unavailable — leave items as-is rather than failing the whole request.
    return items
  }
}

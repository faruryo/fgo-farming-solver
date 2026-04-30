import { DropRate, Item, Quest } from '../interfaces/fgodrop'
import { fetchData } from './data-source'
import { getLocalItems, Localized } from './get-local-items'

export type Drops = {
  items: Localized<Item>[]
  quests: Quest[]
  drop_rates: DropRate[]
}

const MASTER_DATA_KEY = 'all_drops_json'
const MOCK_PATH = 'mocks/all.json'

const EMPTY: Drops = { items: [], quests: [], drop_rates: [] }

export const getDrops = async (): Promise<Drops> => {
  type RawDrops = { items: Item[]; quests: Quest[]; drop_rates: DropRate[] }
  const data = await fetchData<RawDrops>(MASTER_DATA_KEY, MOCK_PATH)
  if (!data) return EMPTY

  return {
    items: data.items ? await getLocalItems(data.items) : [],
    quests: data.quests || [],
    drop_rates: data.drop_rates || [],
  }
}

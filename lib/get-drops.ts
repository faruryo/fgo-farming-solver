import { bucket, key, region } from '../constants/fgodrop'
import { DropRate, Item, Quest } from '../interfaces/fgodrop'
import { getGzip } from './get-s3'

export type Drops = {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
}

export const getDrops = async (): Promise<Drops> => {
  const isDev = process.env.NODE_ENV == 'development'
  const isEdge = process.env.NEXT_RUNTIME == 'experimental-edge'

  let data: Partial<Drops>
  if (isDev && !isEdge) {
    const path = await import(/* webpackIgnore: true */ 'path')
    const { readJson } = await import('./read-json')
    data = await readJson<Partial<Drops>>(
      path.default.resolve('mocks', 'all.json')
    )
  } else {
    data = (await getGzip(region, bucket, key)) as Partial<Drops>
  }

  return {
    items: data.items || [],
    quests: data.quests || [],
    drop_rates: data.drop_rates || [],
  }
}

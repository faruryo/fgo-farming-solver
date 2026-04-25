import { DropRate, Item, Quest } from '../interfaces/fgodrop'
import type { CloudflareEnv } from '../types/cloudflare-env'

export type Drops = {
  items: Item[]
  quests: Quest[]
  drop_rates: DropRate[]
}

const MASTER_DATA_KEY = 'all_drops_json'

export const getDrops = async (env?: CloudflareEnv): Promise<Drops> => {
  const isDev = process.env.NODE_ENV == 'development'
  const isEdge = process.env.NEXT_RUNTIME == 'edge'

  let data: Partial<Drops> | null = null

  // 1. Try to get from Cloudflare KV if in production/edge
  if (env?.MASTER_DATA) {
    try {
      const kvData = await env.MASTER_DATA.get(MASTER_DATA_KEY)
      if (kvData) {
        data = JSON.parse(kvData) as Drops
      }
    } catch (e) {
      console.error('Failed to fetch from KV:', e)
    }
  }

  // 2. Fallback to local mock data in development or if KV is empty
  if (!data) {
    if (isDev && !isEdge) {
      const path = await import(/* webpackIgnore: true */ 'path')
      const { readJson } = await import('./read-json')
      data = await readJson<Partial<Drops>>(
        path.default.resolve('mocks', 'all.json')
      )
    } else {
      // Return empty drops if everything fails
      return { items: [], quests: [], drop_rates: [] }
    }
  }

  return {
    items: data?.items || [],
    quests: data?.quests || [],
    drop_rates: data?.drop_rates || [],
  }
}

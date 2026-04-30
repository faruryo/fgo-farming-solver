import { DashboardMeta } from './master-data/update'
import type { CloudflareEnv } from '../types/cloudflare-env'

const DASHBOARD_META_KEY = 'dashboard_meta'

export const getDashboardMeta = async (): Promise<DashboardMeta | null> => {
  const isDev = process.env.NODE_ENV == 'development'
  const isEdge = process.env.NEXT_RUNTIME == 'edge'

  let data: DashboardMeta | null = null

  // 1. Try to get from Cloudflare KV (production / edge only)
  if (!isDev || isEdge) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const { env } = (await getCloudflareContext({ async: true })) as unknown as { env: CloudflareEnv }
      const kvData = await env.MASTER_DATA.get(DASHBOARD_META_KEY)
      if (kvData) {
        data = JSON.parse(kvData) as DashboardMeta
      }
    } catch (e) {
      console.error('Failed to fetch dashboard meta from KV:', e)
    }
  }

  // 2. Fallback to local mock data in development
  if (!data && isDev && !isEdge) {
    try {
      const path = await import(/* webpackIgnore: true */ 'path')
      const { readJson } = await import('./read-json')
      // mocks/dashboard.json がない場合は null を返す（後で作成するか検討）
      data = await readJson<DashboardMeta>(
        path.default.resolve('mocks', 'dashboard.json')
      ).catch(() => null)
    } catch {
      // ignore
    }
  }

  return data
}

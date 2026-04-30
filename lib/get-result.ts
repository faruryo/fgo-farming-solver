import { Result, BothResult } from '../interfaces/api'
import { readLocalJson } from './data-source'

export const getResult = async (id: string): Promise<Result | BothResult> => {
  // 1. Try local mock (dev)
  const mock = await readLocalJson<Result | BothResult>('mocks/result.json')
  if (mock) return mock

  // 2. Try Cloudflare D1 (production)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const ctx = (await getCloudflareContext({ async: true })) as unknown as {
      env: { DB: D1Database }
    }

    if (!ctx.env.DB) {
      throw new Error('Database not available')
    }

    const result = await ctx.env.DB.prepare(
      'SELECT result_data FROM farming_results WHERE id = ?'
    )
      .bind(id)
      .first<{ result_data: string }>()

    if (!result) {
      throw new Error(`Result not found for id ${id}`)
    }

    return JSON.parse(result.result_data) as Result | BothResult
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e))
  }
}

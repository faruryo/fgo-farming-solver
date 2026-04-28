import { Result, BothResult } from '../interfaces/api'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../types/cloudflare-env'

export const getResult = async (id: string): Promise<Result | BothResult> => {
  const isDev = process.env.NODE_ENV === 'development'
  const isEdge = process.env.NEXT_RUNTIME === 'edge'

  if (isDev && !isEdge) {
    const path = await import(/* webpackIgnore: true */ 'path')
    const { readJson } = await import('./read-json')
    const data = await readJson<Result | BothResult>(path.default.resolve('mocks', 'result.json'))
    return data
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }

  if (!env.DB) {
    throw new Error('Database not available')
  }

  const result = await env.DB.prepare(
    'SELECT result_data FROM farming_results WHERE id = ?'
  )
    .bind(id)
    .first<{ result_data: string }>()

  if (!result) {
    throw new Error(`Result not found for id ${id}`)
  }

  return JSON.parse(result.result_data) as Result | BothResult
}

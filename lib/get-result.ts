import { Result, BothResult } from '../interfaces/api'
import { readLocalJson } from './data-source'

export type GetResultPayload = (Result | BothResult) & {
  createdAt?: string
  /** batch_id が NULL でない場合に設定される。 */
  batchId?: string | null
  /** 同一 batch_id を持つ兄弟行(B行=ストック込み)の result_data。batch_id=NULL なら null。 */
  siblingResult?: BothResult | null
}

export const getResult = async (id: string): Promise<GetResultPayload> => {
  // 1. Try local mock (dev)
  const mock = await readLocalJson<Result | BothResult>('mocks/result.json')
  if (mock) {
    return {
      ...mock,
      createdAt: new Date().toISOString(),
    }
  }

  // 2. Try Cloudflare D1 (production)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const ctx = (await getCloudflareContext({ async: true })) as unknown as {
      env: { DB: D1Database }
    }

    if (!ctx.env.DB) {
      throw new Error('Database not available')
    }

    const row = await ctx.env.DB.prepare(
      'SELECT result_data, created_at, batch_id FROM farming_results WHERE id = ?'
    )
      .bind(id)
      .first<{ result_data: string; created_at: string; batch_id: string | null }>()

    if (!row) {
      throw new Error(`Result not found for id ${id}`)
    }

    const parsed = JSON.parse(row.result_data) as Result | BothResult

    // batch_id がある場合、兄弟行(B行=ストック込み)を取得して返す。
    let siblingResult: BothResult | null = null
    if (row.batch_id) {
      const sibling = await ctx.env.DB.prepare(
        'SELECT result_data FROM farming_results WHERE batch_id = ? AND id != ? AND deleted_at IS NULL'
      )
        .bind(row.batch_id, id)
        .first<{ result_data: string }>()
      if (sibling) {
        siblingResult = JSON.parse(sibling.result_data) as BothResult
      }
    }

    return {
      ...parsed,
      createdAt: row.created_at,
      batchId: row.batch_id ?? null,
      siblingResult,
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e))
  }
}

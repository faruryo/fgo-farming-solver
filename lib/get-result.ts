import { Result, BothResult } from '../interfaces/api'
import { readLocalJson } from './data-source'

export type GetResultPayload = (Result | BothResult) & {
  createdAt?: string
  /** batch_id が NULL でない場合に設定される。 */
  batchId?: string | null
  /** 同一 batch_id を持つ兄弟行(B行=ストック込み)の result_data。batch_id=NULL なら null。 */
  siblingResult?: BothResult | null
  isOwner?: boolean
  isPublic?: boolean
}

export const canViewResult = (
  isPublic: boolean,
  ownerId: string,
  currentUserId?: string | null
): boolean => {
  if (isPublic) return true
  if (currentUserId && ownerId === currentUserId) return true
  return false
}

type FarmingResultRow = {
  result_data: string
  created_at: string
  batch_id: string | null
  user_id: string
  is_public: number | null
}

const fetchSiblingResult = async (
  db: D1Database,
  batchId: string | null,
  excludeId: string
): Promise<BothResult | null> => {
  if (!batchId) return null
  const sibling = await db
    .prepare(
      'SELECT result_data FROM farming_results WHERE batch_id = ? AND id != ?'
    )
    .bind(batchId, excludeId)
    .first<{ result_data: string }>()
  return sibling ? (JSON.parse(sibling.result_data) as BothResult) : null
}

export const getResult = async (
  id: string,
  currentUserId?: string | null
): Promise<GetResultPayload> => {
  // 1. Try local mock (dev)
  const mock = await readLocalJson<Result | BothResult>('mocks/result.json')
  if (mock) {
    return {
      ...mock,
      createdAt: new Date().toISOString(),
      isOwner: Boolean(currentUserId),
      isPublic: true,
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
      'SELECT result_data, created_at, batch_id, user_id, is_public FROM farming_results WHERE id = ?'
    )
      .bind(id)
      .first<FarmingResultRow>()

    if (!row) {
      throw new Error(`Result not found for id ${id}`)
    }

    const isPublic = row.is_public !== 0
    if (!canViewResult(isPublic, row.user_id, currentUserId)) {
      throw new Error(`Result not found for id ${id}`)
    }

    const isOwner = Boolean(currentUserId && row.user_id === currentUserId)
    const parsed = JSON.parse(row.result_data) as Result | BothResult
    const siblingResult = await fetchSiblingResult(ctx.env.DB, row.batch_id, id)

    return {
      ...parsed,
      createdAt: row.created_at,
      batchId: row.batch_id ?? null,
      siblingResult,
      isOwner,
      isPublic,
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e))
  }
}

import { NextRequest } from 'next/server'
import { getDrops } from '../../../lib/get-drops'
import { solveBoth } from '../../../lib/solver'
import { Params } from '../../../interfaces/api'
import { auth } from '../../../lib/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

const QUEST_SELECTION_LIMIT = 100

// Denormalized by name (not short ID — IDs were unstable across generations).
// Stores whichever side (selected/excluded) is smaller so the JSON stays compact.
const buildQuestSelection = (
  quests: { id: string; area: string; name: string }[],
  allowedQuests: string[]
): string => {
  const allowed = new Set(allowedQuests)
  const selectedQuests = quests.filter((q) => allowed.has(q.id))
  const excludedQuests = quests.filter((q) => !allowed.has(q.id))
  const mode = selectedQuests.length <= excludedQuests.length ? 'selected' : 'excluded'
  const side = mode === 'selected' ? selectedQuests : excludedQuests
  return JSON.stringify({
    total: quests.length,
    selected: selectedQuests.length,
    mode,
    quests: side.slice(0, QUEST_SELECTION_LIMIT).map(({ area, name }) => ({ area, name })),
    ...(side.length > QUEST_SELECTION_LIMIT ? { truncated: true } : {}),
  })
}

/** `items=` / `itemsStock=` クエリ文字列をパースして { [id]: count } マップを返す。 */
const parseItemCounts = (raw: string): Record<string, number> =>
  Object.fromEntries(
    raw.split(',').filter(Boolean).map((pair) => {
      const [id, count] = pair.split(':')
      return [id, parseInt(count, 10) || 0]
    })
  )

/** 2つのアイテムマップが全キー・全値で一致するか(B==A 早期判定)。 */
const itemMapsEqual = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const keysA = Object.keys(a)
  if (keysA.length !== Object.keys(b).length) return false
  return keysA.every((k) => a[k] === b[k])
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const itemsRaw = searchParams.get('items') || ''
  const itemsStockRaw = searchParams.get('itemsStock') || ''
  const questsRaw = searchParams.get('quests') || ''
  const apCoefficients = searchParams.get('ap_coefficients') || ''

  const itemCounts = parseItemCounts(itemsRaw)
  const itemCountsStock = itemsStockRaw ? parseItemCounts(itemsStockRaw) : null

  // B==A のときはバッチ不要(無駄 solve を回避する早期判定)。
  const hasBatch =
    itemCountsStock !== null && !itemMapsEqual(itemCounts, itemCountsStock)

  const allowedQuests = questsRaw.split(',').filter(Boolean)

  const [{ env }, drops, session] = await Promise.all([
    getCloudflareContext({ async: true }) as unknown as Promise<{ env: CloudflareEnv }>,
    getDrops(),
    auth(),
  ])
  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB

  // Apply AP coefficients (e.g., 0:0.5 for half AP on training grounds)
  if (apCoefficients) {
    const coeffs = Object.fromEntries(
      apCoefficients.split(',').map((pair) => {
        const [id, coeff] = pair.split(':')
        return [id, parseFloat(coeff) || 1]
      })
    )
    drops.quests = drops.quests.map((q) => {
      const coeffId = Object.keys(coeffs).find((id) => q.id.startsWith(id))
      if (coeffId) {
        return { ...q, ap: q.ap * coeffs[coeffId] }
      }
      return q
    })
  }

  const questSelectionJson = buildQuestSelection(drops.quests, allowedQuests)
  const userId = session?.user?.id || 'anonymous'

  if (hasBatch) {
    // 2目標(目標A=必要分 / 目標B=ストック込み)の同時計算・2行保存。
    const paramsA: Params = { objective: 'both', items: itemCounts, quests: allowedQuests }
    const paramsB: Params = {
      objective: 'both',
      items: itemCountsStock!,
      quests: allowedQuests,
      stockIncluded: true,
    }

    // Saved farming results must use nominal (campaign-free) AP so downstream KPIs
    // (calculation history, progress comparisons) stay stable across campaign periods.
    const [resultA, resultB] = [
      solveBoth(drops, paramsA, { applyCampaigns: false }),
      solveBoth(drops, paramsB, { applyCampaigns: false }),
    ]

    const batchId = crypto.randomUUID()
    const idA = crypto.randomUUID()
    const idB = crypto.randomUUID()

    if (db) {
      try {
        await db.batch([
          db.prepare(
            'INSERT INTO farming_results (id, user_id, objective, target_items, total_ap, total_lap, result_data, quest_selection, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            idA, userId, 'both',
            JSON.stringify(itemCounts),
            resultA.ap.total_ap, resultA.lap.total_lap,
            JSON.stringify(resultA),
            questSelectionJson,
            batchId,
          ),
          db.prepare(
            'INSERT INTO farming_results (id, user_id, objective, target_items, total_ap, total_lap, result_data, quest_selection, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            idB, userId, 'both',
            JSON.stringify(itemCountsStock),
            resultB.ap.total_ap, resultB.lap.total_lap,
            JSON.stringify(resultB),
            questSelectionJson,
            batchId,
          ),
        ])
      } catch (e) {
        console.error('Failed to save batch to D1:', e)
      }
    }

    // 着地は目標A行(進捗アンカー)。batchId をレスポンスに含める。
    return Response.json({ ...resultA, id: idA, batchId })
  }

  // 従来どおり: 単独目標(stockEnabled=OFF / B==A)は batch_id=NULL の1行。
  const params: Params = { objective: 'both', items: itemCounts, quests: allowedQuests }
  const result = solveBoth(drops, params, { applyCampaigns: false })
  const id = crypto.randomUUID()

  if (db) {
    try {
      await db.prepare(
        'INSERT INTO farming_results (id, user_id, objective, target_items, total_ap, total_lap, result_data, quest_selection) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          id,
          userId,
          'both',
          JSON.stringify(itemCounts),
          result.ap.total_ap,
          result.lap.total_lap,
          JSON.stringify(result),
          questSelectionJson
        )
        .run()
    } catch (e) {
      console.error('Failed to save to D1:', e)
    }
  }

  return Response.json({ ...result, id })
}

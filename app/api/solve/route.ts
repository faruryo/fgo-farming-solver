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

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const itemsRaw = searchParams.get('items') || ''
  const questsRaw = searchParams.get('quests') || ''
  const apCoefficients = searchParams.get('ap_coefficients') || ''

  const itemCounts = Object.fromEntries(
    itemsRaw.split(',').map((pair) => {
      const [id, count] = pair.split(':')
      return [id, parseInt(count, 10) || 0]
    })
  )

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

  const params: Params = {
    objective: 'both',
    items: itemCounts,
    quests: allowedQuests,
  }

  // Saved farming results and snapshots must use nominal (campaign-free) AP so
  // that downstream KPIs (calculation history, progress comparisons) stay
  // stable across campaign periods. Dashboard views re-solve client-side with
  // applyCampaigns=true when needed.
  const result = solveBoth(drops, params, { applyCampaigns: false })
  const id = crypto.randomUUID()

  if (db) {
    try {
      await db.prepare(
        'INSERT INTO farming_results (id, user_id, objective, target_items, total_ap, total_lap, result_data, quest_selection) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          id,
          session?.user?.id || 'anonymous',
          'both',
          JSON.stringify(itemCounts),
          result.ap.total_ap,
          result.lap.total_lap,
          JSON.stringify(result),
          buildQuestSelection(drops.quests, allowedQuests)
        )
        .run()
    } catch (e) {
      console.error('Failed to save to D1:', e)
    }

    // Progress snapshots are persisted client-side via /api/progress/snapshot
    // after a successful run, so the snapshot includes `material` (needed for
    // new-servant detection). The server no longer writes a material-less
    // snapshot here, which previously clobbered material-containing snapshots.
  }

  return Response.json({ ...result, id })
}

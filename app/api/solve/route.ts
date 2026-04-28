import { NextRequest } from 'next/server'
import { getDrops } from '../../../lib/get-drops'
import { solveBoth } from '../../../lib/solver'
import { Params } from '../../../interfaces/api'
import { auth } from '../../../lib/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

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

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }

  const drops = await getDrops()

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

  const result = solveBoth(drops, params)
  const id = crypto.randomUUID()

  // Save to D1 if available
  const session = await auth()
  if (env.DB) {
    try {
      await env.DB.prepare(
        'INSERT INTO farming_results (id, user_id, objective, target_items, total_ap, total_lap, result_data) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          id,
          session?.user?.id || 'anonymous',
          'both',
          JSON.stringify(itemCounts),
          result.ap.total_ap,
          result.lap.total_lap,
          JSON.stringify(result)
        )
        .run()
    } catch (e) {
      console.error('Failed to save to D1:', e)
    }
  }

  return Response.json({ ...result, id })
}

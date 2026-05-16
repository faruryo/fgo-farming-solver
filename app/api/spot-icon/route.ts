import { NextRequest, NextResponse } from 'next/server'
import { origin, region } from '../../../constants/atlasacademy'

// warId → Map<spotId, spotImageUrl>
const warSpotCache = new Map<number, Map<number, string>>()
const warBannerCache = new Map<number, string>()
// aaQuestId → resolved spot image URL (null = not found)
const spotIconCache = new Map<number, string | null>()

async function fetchWarData(warId: number): Promise<void> {
  if (warSpotCache.has(warId)) return
  const res = await fetch(`${origin}/nice/${region}/war/${warId}`)
  if (!res.ok) {
    warSpotCache.set(warId, new Map())
    return
  }
  const war = await res.json() as { banner?: string; spots?: Array<{ id: number; image?: string }> }
  const map = new Map<number, string>()
  for (const spot of war.spots ?? []) {
    if (spot.id && spot.image) map.set(spot.id, spot.image)
  }
  warSpotCache.set(warId, map)
  if (war.banner) warBannerCache.set(warId, war.banner)
}

async function resolveSpotIcon(aaQuestId: number): Promise<string | null> {
  if (spotIconCache.has(aaQuestId)) return spotIconCache.get(aaQuestId) ?? null

  // Step 1: quest nice → warId + spotId
  const questRes = await fetch(`${origin}/nice/${region}/quest/${aaQuestId}/1`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!questRes.ok) {
    spotIconCache.set(aaQuestId, null)
    return null
  }
  const quest = await questRes.json() as { warId?: number; spotId?: number }
  const { warId, spotId } = quest

  if (!warId || !spotId) {
    spotIconCache.set(aaQuestId, null)
    return null
  }

  // Step 2: war nice → spot image
  await fetchWarData(warId)
  const spotMap = warSpotCache.get(warId)
  const imageUrl = spotMap?.get(spotId) ?? warBannerCache.get(warId) ?? null

  spotIconCache.set(aaQuestId, imageUrl)
  return imageUrl
}

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const aaQuestId = Number(request.nextUrl.searchParams.get('aaQuestId'))
  if (!aaQuestId || isNaN(aaQuestId)) {
    return NextResponse.json({ imageUrl: null })
  }

  try {
    const imageUrl = await resolveSpotIcon(aaQuestId)
    return NextResponse.json({ imageUrl }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    })
  } catch (e) {
    console.error('spot-icon API error:', e)
    return NextResponse.json({ imageUrl: null })
  }
}

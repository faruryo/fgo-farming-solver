import { NextResponse } from 'next/server'
import { getDrops } from '../../../lib/get-drops'

// Edge / browser caching policy:
//   - max-age=300:          treat as fresh for 5 minutes (no revalidation in that window)
//   - stale-while-revalidate=3600: serve stale up to 1 hour while refreshing in the background
//
// Combined with the hourly master-data cron, this keeps requests under ~5 minutes
// of staleness on average without forcing a full re-fetch on every request.
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600'

export async function GET() {
  try {
    const data = await getDrops()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    })
  } catch (e) {
    console.error('API Error:', e)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

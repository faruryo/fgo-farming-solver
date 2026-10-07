import { NextResponse } from 'next/server'
import { getDashboardMeta } from '../../../lib/get-dashboard-meta'
import { getEvents } from '../../../lib/get-events'

export const dynamic = 'force-dynamic'

// event_data_json（ロト型イベント）は dashboard_meta と別系統の KV。こちらの失敗で dashboard 全体を落とさない。
const loadLotteryEventIds = async (): Promise<number[]> => {
  try {
    const { events } = await getEvents()
    return events.map(e => e.id)
  } catch (e) {
    console.error('Failed to load lottery events:', e)
    return []
  }
}

export async function GET() {
  try {
    const [data, availableLotteryEventIds] = await Promise.all([getDashboardMeta(), loadLotteryEventIds()])
    if (!data) {
      return NextResponse.json({ events: [], gachas: [], updatedAt: 0, availableLotteryEventIds })
    }
    return NextResponse.json({ ...data, availableLotteryEventIds })
  } catch (e) {
    console.error('API Error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

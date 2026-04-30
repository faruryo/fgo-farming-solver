import { NextResponse } from 'next/server'
import { getDashboardMeta } from '../../../lib/get-dashboard-meta'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getDashboardMeta()
    if (!data) {
      // ローカル開発等でデータがない場合は空の構造を返す
      return NextResponse.json({ events: [], gachas: [], updatedAt: 0 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('API Error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

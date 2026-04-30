import { NextResponse } from 'next/server'
import { getDrops } from '../../../lib/get-drops'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getDrops()
    return NextResponse.json(data)
  } catch (e) {
    console.error('API Error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

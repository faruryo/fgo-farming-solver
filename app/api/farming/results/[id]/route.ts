import { NextRequest, NextResponse } from 'next/server'
import { getResult } from '../../../../../lib/get-result'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getResult(id)
    return NextResponse.json(result)
  } catch (e) {
    console.error('Failed to get result:', e)
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
}

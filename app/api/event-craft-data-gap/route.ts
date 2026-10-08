import { NextResponse } from 'next/server'
import { readCraftDataGapRequest } from '../../../lib/event-craft-data-gap-log'

export async function POST(request: Request) {
  const text = await request.text()
  const result = readCraftDataGapRequest(text)
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid craft data gap' }, { status: 400 })
  }
  console.info(JSON.stringify(result.log))
  return new NextResponse(null, { status: 204 })
}

import { NextResponse } from 'next/server'
import { CRAFT_DATA_GAP_BODY_LIMIT, readCraftDataGapRequest, readLimitedUtf8 } from '../../../lib/event-craft-data-gap-log'

export async function POST(request: Request) {
  const text = await readLimitedUtf8(request.body, CRAFT_DATA_GAP_BODY_LIMIT)
  if (text === null) {
    return NextResponse.json({ error: 'invalid craft data gap' }, { status: 400 })
  }
  const result = readCraftDataGapRequest(text)
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid craft data gap' }, { status: 400 })
  }
  console.info(JSON.stringify(result.log))
  return new NextResponse(null, { status: 204 })
}

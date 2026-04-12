import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { DBError, getDynamoDb, putDynamoDb } from '../../../lib/dynamodb'

export const runtime = 'edge'

const region = 'ap-northeast-1'
const tableName = 'fgo-farming-solver-input'

async function compress(str: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(str))
      controller.close()
    },
  })
  const compressionStream = new globalThis.CompressionStream('gzip')
  const compressedStream = readableStream.pipeThrough(compressionStream)
  const response = new NextResponse(compressedStream)
  return new Uint8Array(await response.arrayBuffer())
}

async function decompress(data: string): Promise<string> {
  const bytes = new Uint8Array(
    atob(data)
      .split('')
      .map((c) => c.charCodeAt(0))
  )
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const decompressionStream = new globalThis.DecompressionStream('gzip')
  const decompressedStream = readableStream.pipeThrough(decompressionStream)
  const response = new NextResponse(decompressedStream)
  return await response.text()
}

export default async function handler(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  const token = await getToken({ req: req as any })
  if (!token?.sub) {
    return new Response(null, { status: 401 })
  }
  const id = token.sub
  const savedTime = Math.floor(Date.now() / 1000)

  if (req.method === 'POST') {
    try {
      const inputBody: unknown = await req.json()
      const inputStr = typeof inputBody === 'string' ? inputBody : JSON.stringify(inputBody)
      const compressedInput = await compress(inputStr)
      const base64Input = btoa(String.fromCharCode(...compressedInput))

      await putDynamoDb({
        region,
        tableName,
        item: { id, savedTime, input: base64Input },
      })
      return new Response(JSON.stringify({ id, savedTime, input: base64Input }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
  else if (req.method === 'GET') {
    try {
      const item = (await getDynamoDb({ region, tableName, key: { id } })) as {
        input: string
        savedTime: number
      } | null
      if (!item) {
        return new Response(null, { status: 200 })
      }
      const decompressedInput = await decompress(item.input)
      return new Response(decompressedInput, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Saved-Time': item.savedTime.toString(),
        },
      })
    } catch (error) {
      if (error instanceof DBError) {
        return new Response(null, { status: 404 })
      } else {
        return new Response(JSON.stringify({ error }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
  }

  return new Response(null, { status: 405 })
}

import { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { DBError, getDynamoDb, putDynamoDb } from '../../../lib/dynamodb'

export const runtime = 'experimental-edge'

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
  const compressionStream = new CompressionStream('gzip')
  const compressedStream = readableStream.pipeThrough(compressionStream)
  const response = new Response(compressedStream)
  return new Uint8Array(await response.arrayBuffer())
}

async function decompress(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? Buffer.from(data, 'base64') : data
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const decompressionStream = new DecompressionStream('gzip')
  const decompressedStream = readableStream.pipeThrough(decompressionStream)
  const response = new Response(decompressedStream)
  return await response.text()
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const token = await getToken({ req })
  if (token == null) {
    res.status(401).send(null)
    return
  }
  const id = token.sub
  if (!id) {
    res.status(401).send(null)
    return
  }
  const savedTime = Math.floor(Date.now() / 1000)

  if (req.method == 'POST') {
    if (typeof req.body != 'string') {
      throw new Error('Request body must be string.')
    }
    const compressedInput = await compress(req.body)
    const item = { id, savedTime, input: compressedInput }
    await putDynamoDb({ region, tableName, item })
    res.status(200).send(item)
  } else if (req.method == 'GET') {
    try {
      const item = await getDynamoDb({ region, tableName, key: { id } })
      const decompressedInput = await decompress(
        item.input as string | Uint8Array
      )
      res.status(200).send(decompressedInput)
    } catch (error) {
      if (error instanceof DBError) {
        res.status(404).send(null)
      } else {
        res.status(500).json({ error })
      }
    }
  }
}

export default handler

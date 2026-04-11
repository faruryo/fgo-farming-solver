import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

export const getGzip = async (region: string, bucket: string, key: string) => {
  const accessKeyId = process.env.MY_AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.MY_AWS_SECRET_ACCESS_KEY
  if (accessKeyId == null || secretAccessKey == null) {
    console.log('Environment variables are not set')
    return {}
  }

  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    region,
  })
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })

  try {
    const response = await client.send(command)
    if (response.Body == null) {
      console.error('Response body is empty')
      return {}
    }

    // Convert response.Body to a ReadableStream (Web API)
    const stream = response.Body.transformToWebStream()
    const decompressionStream = new DecompressionStream('gzip')
    const decompressedStream = stream.pipeThrough(decompressionStream)

    const reader = decompressedStream.getReader()
    let data = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      data += decoder.decode(value, { stream: true })
    }
    data += decoder.decode()

    return JSON.parse(data) as Record<string, unknown>
  } catch (e) {
    if (e instanceof Error) {
      console.error(e, e.stack)
    }
    return {}
  }
}

export const putGzip = async (
  region: string,
  bucket: string,
  key: string,
  body: string
) => {
  const accessKeyId = process.env.MY_AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.MY_AWS_SECRET_ACCESS_KEY
  if (accessKeyId == null || secretAccessKey == null) {
    console.error('Environment variables are not set')
    return
  }

  const client = new S3Client({
    credentials: { accessKeyId, secretAccessKey },
    region,
  })

  // Convert string to ReadableStream and compress with gzip
  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })
  const compressionStream = new CompressionStream('gzip')
  const compressedStream = readableStream.pipeThrough(compressionStream)

  // AWS SDK PutObject accepts Uint8Array or ReadableStream
  // In Edge/Browser, we need a Uint8Array or a compatible stream
  const response = new Response(compressedStream)
  const blob = await response.blob()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: blob,
  })

  try {
    await client.send(command)
  } catch (e) {
    if (e instanceof Error) {
      console.error(e, e.stack)
    }
    return
  }
}

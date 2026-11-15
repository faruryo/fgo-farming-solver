/** テストで使う PNG を作る（読む側の検査のため、行ごとにフィルタの種類を選べる） */
import { deflateSync } from 'node:zlib'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: Uint8Array): Buffer => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

/** 知らないフィルタの種類（読めないことの検査用）は予測 0 で書く */
const predictor = (filter: number, left: number, up: number, upLeft: number): number =>
  filter >= 0 ? ([0, left, up, (left + up) >> 1, paeth(left, up, upLeft)].at(filter) ?? 0) : 0

const filterRows = (pixels: Uint8Array, width: number, height: number, bpp: number, filters: readonly number[]) => {
  const stride = width * bpp
  const out = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const filter = filters[y % filters.length]
    out[y * (stride + 1)] = filter
    for (let i = 0; i < stride; i++) {
      const at = (dy: number, dx: number) => {
        const row = y + dy
        const col = i + dx
        return row < 0 || col < 0 ? 0 : pixels[row * stride + col]
      }
      const value = at(0, 0) - predictor(filter, at(0, -bpp), at(-1, 0), at(-1, -bpp))
      out[y * (stride + 1) + 1 + i] = value & 0xff
    }
  }
  return out
}

export type PngFixtureOptions = {
  width?: number
  height?: number
  bitDepth?: number
  colorType?: number
  interlace?: number
  /** 行ごとのフィルタの種類（行の順に繰り返す） */
  filters?: readonly number[]
  /** 画素（幅 × 高さ × 1画素のバイト数）。無ければ位置から決まる模様 */
  pixels?: Uint8Array
}

const CHANNELS = new Map([[0, 1], [2, 3], [4, 2], [6, 4]])

/** 固定の種から作る乱れた RGBA（隣どうしの値がばらつくので、フィルタの戻し間違いが分かる） */
export const patternPixels = (width: number, height: number, channels = 4): Uint8Array => {
  let seed = 12345
  return Uint8Array.from({ length: width * height * channels }, () => {
    seed = (seed * 1103515245 + 12345) >>> 0
    return seed >>> 24
  })
}

export const makePng = ({
  width = 128,
  height = 128,
  bitDepth = 8,
  colorType = 6,
  interlace = 0,
  filters = [0, 1, 2, 3, 4],
  pixels,
}: PngFixtureOptions = {}): Uint8Array<ArrayBuffer> => {
  const channels = CHANNELS.get(colorType) ?? 4
  const bpp = channels * (bitDepth / 8)
  const raw = pixels ?? patternPixels(width, height, bpp)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([bitDepth, colorType, 0, 0, interlace], 8)
  return Uint8Array.from(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filterRows(raw, width, height, bpp, filters))),
    chunk('IEND', new Uint8Array(0)),
  ]))
}

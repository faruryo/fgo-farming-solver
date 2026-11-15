/**
 * Atlas の顔のアイコンの PNG（128×128・8bit RGBA・非インターレース）を RGBA の画素の配列にする純粋関数。
 * 新しい依存を足さないため Node の zlib だけで読み、ほかの形式は読めなかったものとして返す。
 */
import { inflateSync } from 'node:zlib'
import type { RgbaImage } from '../shop-screenshot-import/icon-match'

/** 顔のアイコンの一辺 */
export const FACE_ICON_PNG_SIZE = 128

export type PngDecodeResult = { ok: true; image: RgbaImage } | { ok: false; reason: string }

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const BYTES_PER_PIXEL = 4

type Chunks = { ihdr: Uint8Array | null; idat: Uint8Array[] }

const fail = (reason: string): PngDecodeResult => ({ ok: false, reason })

const readChunks = (bytes: Uint8Array): Chunks | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: Chunks = { ihdr: null, idat: [] }
  let offset = SIGNATURE.length
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const start = offset + 8
    if (start + length + 4 > bytes.length) return null
    const data = bytes.subarray(start, start + length)
    if (type === 'IHDR') chunks.ihdr = data
    else if (type === 'IDAT') chunks.idat.push(data)
    else if (type === 'IEND') return chunks
    offset = start + length + 4
  }
  return null
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

type Predictor = (left: number, up: number, upLeft: number) => number

/** フィルタの種類（0〜4）ごとの、左・上・左上の値からの予測 */
const PREDICTORS: readonly Predictor[] = [
  () => 0,
  left => left,
  (_, up) => up,
  (left, up) => (left + up) >> 1,
  paeth,
]

/** 1行のフィルタを戻す。知らないフィルタの種類なら null */
const unfilterRow = (filter: number, filtered: Uint8Array, previous: readonly number[] | null): number[] | null => {
  const predict = filter >= 0 && filter < PREDICTORS.length ? PREDICTORS.at(filter) : undefined
  if (!predict) return null
  const row: number[] = []
  for (let i = 0; i < filtered.length; i++) {
    const hasLeft = i >= BYTES_PER_PIXEL
    const left = hasLeft ? (row.at(i - BYTES_PER_PIXEL) ?? 0) : 0
    const up = previous?.at(i) ?? 0
    const upLeft = hasLeft ? (previous?.at(i - BYTES_PER_PIXEL) ?? 0) : 0
    row.push(((filtered.at(i) ?? 0) + predict(left, up, upLeft)) & 0xff)
  }
  return row
}

const headerProblem = (ihdr: Uint8Array): string | null => {
  if (ihdr.length !== 13) return 'broken IHDR'
  const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength)
  const width = view.getUint32(0)
  const height = view.getUint32(4)
  if (width !== FACE_ICON_PNG_SIZE || height !== FACE_ICON_PNG_SIZE) return `size ${width}x${height}`
  if (ihdr[8] !== 8) return `bit depth ${ihdr[8]}`
  if (ihdr[9] !== 6) return `color type ${ihdr[9]}`
  if (ihdr[10] !== 0 || ihdr[11] !== 0) return 'unknown compression or filter method'
  if (ihdr[12] !== 0) return 'interlaced'
  return null
}

const inflate = (idat: Uint8Array[]): Uint8Array | null => {
  try {
    return inflateSync(Buffer.concat(idat))
  } catch {
    return null
  }
}

const unfilter = (raw: Uint8Array): Uint8ClampedArray | null => {
  const stride = FACE_ICON_PNG_SIZE * BYTES_PER_PIXEL
  if (raw.length < (stride + 1) * FACE_ICON_PNG_SIZE) return null
  const data = new Uint8ClampedArray(stride * FACE_ICON_PNG_SIZE)
  let previous: number[] | null = null
  for (let y = 0; y < FACE_ICON_PNG_SIZE; y++) {
    const start = y * (stride + 1)
    const row = unfilterRow(raw.at(start) ?? -1, raw.subarray(start + 1, start + 1 + stride), previous)
    if (!row) return null
    data.set(row, y * stride)
    previous = row
  }
  return data
}

/** PNG のバイト列を RGBA の画素の配列にする。128×128・8bit RGBA・非インターレースでなければ読めなかったことを返す */
export const decodeFaceIconPng = (bytes: Uint8Array): PngDecodeResult => {
  if (bytes.length < SIGNATURE.length || SIGNATURE.some((b, i) => bytes.at(i) !== b)) return fail('not a PNG')
  const chunks = readChunks(bytes)
  if (!chunks?.ihdr || chunks.idat.length === 0) return fail('broken chunks')
  const problem = headerProblem(chunks.ihdr)
  if (problem) return fail(problem)
  const raw = inflate(chunks.idat)
  if (!raw) return fail('broken image data')
  const data = unfilter(raw)
  if (!data) return fail('broken image data')
  return { ok: true, image: { data, width: FACE_ICON_PNG_SIZE, height: FACE_ICON_PNG_SIZE } }
}

import type { CraftDataGap, CraftDataGapReason } from './event-craft-data-check'

export const CRAFT_DATA_GAP_LIMIT = 40
export const CRAFT_DATA_GAP_BODY_LIMIT = 4096

const REASONS = new Set<CraftDataGapReason>(['absent', 'unrated'])

export type CraftDataGapLog = {
  event: 'craft_data_gap'
  count: number
  absent: number[]
  unrated: number[]
}

const compareGaps = (a: CraftDataGap, b: CraftDataGap): number => {
  if (a.atlasId !== b.atlasId) return a.atlasId - b.atlasId
  if (a.reason === b.reason) return 0
  return a.reason < b.reason ? -1 : 1
}

export const craftDataGapSignature = (gaps: readonly CraftDataGap[]): string =>
  [...gaps].sort(compareGaps).map((gap) => `${gap.atlasId}:${gap.reason}`).join(',')

/** 1リクエストの上限に収まるよう分ける。空は送らない。 */
export const craftDataGapBatches = (
  gaps: readonly CraftDataGap[],
  limit = CRAFT_DATA_GAP_LIMIT,
): CraftDataGap[][] => {
  if (gaps.length === 0 || limit <= 0) return []
  const batches: CraftDataGap[][] = []
  for (let index = 0; index < gaps.length; index += limit) {
    batches.push(gaps.slice(index, index + limit))
  }
  return batches
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isGapReason = (value: unknown): value is CraftDataGapReason =>
  typeof value === 'string' && REASONS.has(value as CraftDataGapReason)

const unknownRows = (value: unknown): readonly unknown[] | null => {
  if (!Array.isArray(value)) return null
  return Array.from(value, (row: unknown) => row)
}

/** 未知フィールドは捨てる。件数・型が外れたら null。 */
export const parseCraftDataGaps = (body: unknown): CraftDataGap[] | null => {
  if (!isRecord(body)) return null
  const gaps = unknownRows(body.gaps)
  if (!gaps || gaps.length === 0 || gaps.length > CRAFT_DATA_GAP_LIMIT) return null
  const parsed: CraftDataGap[] = []
  for (const row of gaps) {
    if (!isRecord(row)) return null
    const atlasId = row.atlasId
    const reason = row.reason
    if (typeof atlasId !== 'number' || !Number.isInteger(atlasId) || atlasId <= 0) return null
    if (!isGapReason(reason)) return null
    parsed.push({ atlasId, reason })
  }
  return parsed
}

export const formatCraftDataGapLog = (gaps: readonly CraftDataGap[]): CraftDataGapLog => {
  const absent: number[] = []
  const unrated: number[] = []
  for (const gap of gaps) {
    if (gap.reason === 'absent') absent.push(gap.atlasId)
    else unrated.push(gap.atlasId)
  }
  absent.sort((a, b) => a - b)
  unrated.sort((a, b) => a - b)
  return { event: 'craft_data_gap', count: gaps.length, absent, unrated }
}

/** 上限を超えたバイトは読まず null。空ストリームは空文字。 */
export const readLimitedUtf8 = async (
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<string | null> => {
  if (!stream) return ''
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let over = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      if (total + value.byteLength > limit) {
        over = true
        break
      }
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    await reader.cancel()
  }
  if (over) return null
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

export const readCraftDataGapRequest = (text: string): { ok: true; log: CraftDataGapLog } | { ok: false } => {
  if (new TextEncoder().encode(text).byteLength > CRAFT_DATA_GAP_BODY_LIMIT) return { ok: false }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  const gaps = parseCraftDataGaps(body)
  if (!gaps) return { ok: false }
  return { ok: true, log: formatCraftDataGapLog(gaps) }
}

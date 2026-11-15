/**
 * 読み取り結果の検査の純粋関数。
 * - 値の範囲とレア度は読みごとに見る
 * - 並びの項目と向きが同じ画像の段をつなぎ、1本の並びで並び順に合わない読みを決め、前後のカードから値を推定する
 * - つないだあとのカードの数を所持数と比べる
 */

import type {
  CardReading,
  CardValues,
  ImageReading,
  ReviewReason,
  SortKey,
  SortOrder,
  ValueFailure,
  ValueRange,
  ValueRead,
} from './types'

export type ValueKind = ValueFailure['kind']

/** 並びの項目の値の推定（前後が同じ値なら value、違えば range） */
export type KeyEstimate = { kind: ValueKind; value: number | null; range: ValueRange | null }

/** 1つの読みの検査の結果（顔の照合の理由は含まない） */
export type ReadingCheck = {
  /** 引っかかった検査（空なら通った読み） */
  reasons: ReviewReason[]
  /** 検査に通らなかった種類 */
  failedKinds: ValueKind[]
  estimate: KeyEstimate | null
}

export const PASSED_CHECK: ReadingCheck = { reasons: [], failedKinds: [], estimate: null }

export const valueOfKind = (values: CardValues, kind: ValueKind): ValueRead | null =>
  kind === 'lv' ? values.lv : values.npLv

export const readingKey = (r: Pick<CardReading, 'imageIndex' | 'row' | 'column'>): string =>
  `${r.imageIndex}:${r.row}:${r.column}`

// ---- レア度 ----

/** 最後の再臨の上限と、聖杯で上がる上限のうち 90 以下でいちばん小さいもの */
const RARITY_CAPS = new Map<number, { final: number; grailFrom: number }>([
  [0, { final: 65, grailFrom: 70 }],
  [1, { final: 60, grailFrom: 70 }],
  [2, { final: 65, grailFrom: 70 }],
  [3, { final: 70, grailFrom: 75 }],
  [4, { final: 80, grailFrom: 85 }],
  [5, { final: 90, grailFrom: 92 }],
])
const ASCENSION_STAGES_BELOW_FINAL = 4
const ASCENSION_STEP = 10

/** レア度で Lv の上限になりうる数（再臨の段階ごとの上限と聖杯で上がる上限）。知らないレア度なら null */
export const lvCapsForRarity = (rarity: number): ReadonlySet<number> | null => {
  const caps = RARITY_CAPS.get(rarity)
  if (!caps) return null
  const out = new Set<number>()
  for (let stage = 0; stage <= ASCENSION_STAGES_BELOW_FINAL; stage++) out.add(caps.final - stage * ASCENSION_STEP)
  for (let cap = caps.grailFrom; cap <= 90; cap += 5) out.add(cap)
  for (let cap = 92; cap <= 120; cap += 2) out.add(cap)
  return out
}

/** 値の範囲とレア度の検査。レア度は顔を当てたカードでだけ見る */
export const checkReadingValues = (
  reading: CardReading,
  rarityOf: (servantId: number) => number | undefined,
): ReadingCheck => {
  const reasons: ReviewReason[] = []
  const failed = new Set<ValueKind>()
  if (reading.values.failures.length > 0) {
    reasons.push('out-of-range')
    for (const f of reading.values.failures) failed.add(f.kind)
  }
  const lv = reading.values.lv
  if (lv && reading.face.kind === 'matched') {
    const rarity = rarityOf(reading.face.servantId)
    const caps = rarity === undefined ? null : lvCapsForRarity(rarity)
    if (caps && !caps.has(lv.max)) {
      reasons.push('rarity-mismatch')
      failed.add('lv')
    }
  }
  return { reasons, failedKinds: (['lv', 'npLv'] as const).filter((k) => failed.has(k)), estimate: null }
}

// ---- 並び順 ----

const fits = (before: number, after: number, order: SortOrder) => (order === 'desc' ? before >= after : before <= after)

/**
 * 降順なら増えない、昇順なら減らない並びにするために外す位置。
 * 外す枚数をいちばん少なくし、外し方が2通り以上あれば、どれかの外し方で外れる位置をすべて返す。
 */
export const findSortViolations = (values: readonly number[], order: SortOrder): Set<number> => {
  const ending = chainLengths(values, (a, b) => fits(a, b, order))
  const starting = chainLengths([...values].reverse(), (a, b) => fits(b, a, order)).reverse()
  const longest = Math.max(0, ...ending)
  const levels = ending.map((end, i) => (end + (starting.at(i) ?? 0) - 1 === longest ? end : null))
  // どの最長の並びも、長さの段ごとに1つずつ位置を通る。その段で通りうる位置が1つだけなら、外し方によらず残る
  const perLevel = new Map<number, number>()
  for (const level of levels) if (level !== null) perLevel.set(level, (perLevel.get(level) ?? 0) + 1)
  const removed = new Set<number>()
  levels.forEach((level, i) => {
    if (level === null || perLevel.get(level) !== 1) removed.add(i)
  })
  return removed
}

/** 位置ごとの、そこで終わる、隣どうしが `ok` を満たす部分列のいちばん長い長さ */
const chainLengths = (values: readonly number[], ok: (before: number, after: number) => boolean): number[] => {
  const lengths: number[] = []
  values.forEach((value, i) => {
    let best = 0
    values.slice(0, i).forEach((earlier, j) => {
      if (ok(earlier, value)) best = Math.max(best, lengths.at(j) ?? 0)
    })
    lengths.push(best + 1)
  })
  return lengths
}

/** つないだ並びの1つの位置（重なった段では、画像ごとの読みを全部持つ） */
export type CardSlot = { column: number; readings: CardReading[] }
export type StitchedRow = CardSlot[]

/** 並びの項目の値を返す（検査に通らなかった読みと、その種類の値の無い読みは null） */
export type KeyValueOf = (reading: CardReading) => number | null

export const keyValueOf =
  (key: SortKey, checks: ReadonlyMap<string, ReadingCheck>): KeyValueOf =>
  (reading) => {
    const check = checks.get(readingKey(reading))
    if (check && check.reasons.length > 0) return null
    return valueOfKind(reading.values, key)?.current ?? null
  }

type CardValue = { kind: 'none' } | { kind: 'value'; value: number } | { kind: 'conflict' }

const cardValue = (slot: CardSlot, valueOf: KeyValueOf): CardValue => {
  const values = new Set(slot.readings.map(valueOf).filter((v): v is number => v !== null))
  if (values.size === 0) return { kind: 'none' }
  if (values.size > 1) return { kind: 'conflict' }
  return { kind: 'value', value: [...values][0] }
}

const toStitchedRows = (image: ImageReading): StitchedRow[] =>
  image.rows
    .map((row) => [...row].sort((a, b) => a.column - b.column).map((r) => ({ column: r.column, readings: [r] })))
    .filter((row) => row.length > 0)

const slotServant = (slot: CardSlot): number | null => {
  for (const r of slot.readings) if (r.face.kind === 'matched') return r.face.servantId
  return null
}

/** カードのある位置が同じで、両方で当たった位置のサーヴァントがすべて同じで、両方で当たった位置が1つ以上あれば同じ段 */
export const isSameRow = (a: StitchedRow, b: StitchedRow): boolean => {
  if (a.length !== b.length) return false
  let matchedBoth = 0
  const consistent = a.every((slotA, i) => {
    const slotB = b.at(i)
    if (!slotB || slotA.column !== slotB.column) return false
    const sa = slotServant(slotA)
    const sb = slotServant(slotB)
    if (sa === null || sb === null) return true
    matchedBoth++
    return sa === sb
  })
  return consistent && matchedBoth > 0
}

const joinRows = (a: StitchedRow, b: StitchedRow): StitchedRow =>
  a.map((slot, i) => ({ column: slot.column, readings: [...slot.readings, ...(b.at(i)?.readings ?? [])] }))

/** 並びの i 番目の段（範囲の外なら null。負の位置を後ろから数えない） */
const rowAt = (rows: readonly StitchedRow[], i: number): StitchedRow | null => (i >= 0 ? (rows.at(i) ?? null) : null)

/** b の段 j を a の段 j+shift に重ねた並び。重なる段が無いか、同じ段でない重なりがあれば null */
const joinAt = (a: StitchedRow[], b: StitchedRow[], shift: number): { rows: StitchedRow[]; overlap: number } | null => {
  const rows: StitchedRow[] = []
  let overlap = 0
  const end = Math.max(a.length, b.length + shift)
  for (let i = Math.min(0, shift); i < end; i++) {
    const ra = rowAt(a, i)
    const rb = rowAt(b, i - shift)
    if (ra && rb) {
      if (!isSameRow(ra, rb)) return null
      overlap++
      rows.push(joinRows(ra, rb))
    } else {
      const only = ra ?? rb
      if (only) rows.push(only)
    }
  }
  return overlap > 0 ? { rows, overlap } : null
}

const sequenceValues = (rows: readonly StitchedRow[], valueOf: KeyValueOf): number[] =>
  rows.flat().flatMap((slot) => {
    const v = cardValue(slot, valueOf)
    return v.kind === 'value' ? [v.value] : []
  })

const countSortViolations = (rows: readonly StitchedRow[], valueOf: KeyValueOf, order: SortOrder) =>
  findSortViolations(sequenceValues(rows, valueOf), order).size

/** 2つの並びのつなぎ方のうち、並び順に合わないカードがいちばん少なく、それも同じなら重なる段がいちばん多いもの */
const bestJoin = (a: StitchedRow[], b: StitchedRow[], valueOf: KeyValueOf, order: SortOrder): StitchedRow[] | null => {
  const joins: { rows: StitchedRow[]; overlap: number }[] = []
  for (let shift = -(b.length - 1); shift < a.length; shift++) {
    const joined = joinAt(a, b, shift)
    if (joined) joins.push(joined)
  }
  if (joins.length <= 1) return joins[0]?.rows ?? null
  const scored = joins.map((j) => ({ ...j, violations: countSortViolations(j.rows, valueOf, order) }))
  scored.sort((x, y) => x.violations - y.violations || y.overlap - x.overlap)
  return scored[0].rows
}

type Chain = { rows: StitchedRow[]; first: number }

const edgeValue = (rows: readonly StitchedRow[], valueOf: KeyValueOf, fromEnd: boolean): number | null => {
  const values = sequenceValues(rows, valueOf)
  if (values.length === 0) return null
  return fromEnd ? values[values.length - 1] : values[0]
}

const compareChains = (a: Chain, b: Chain, valueOf: KeyValueOf, order: SortOrder): number => {
  for (const fromEnd of [false, true]) {
    const va = edgeValue(a.rows, valueOf, fromEnd)
    const vb = edgeValue(b.rows, valueOf, fromEnd)
    if (va !== null && vb !== null && va !== vb) return order === 'desc' ? vb - va : va - vb
  }
  return a.first - b.first
}

/**
 * 並びの項目と向きが同じ画像の段を、1本の並びにする。
 * 重なる段のある画像をつなぎ、重ならないつながりどうしは先頭（同じなら末尾）のカードの並びの項目の値で並べる。
 */
export const stitchImages = (
  images: readonly ImageReading[],
  valueOf: KeyValueOf,
  order: SortOrder,
): StitchedRow[] => {
  const chains: Chain[] = []
  images.forEach((image, index) => {
    let chain: Chain = { rows: toStitchedRows(image), first: index }
    if (chain.rows.length === 0) return
    for (;;) {
      const found = chains
        .map((c, at) => ({ at, rows: bestJoin(c.rows, chain.rows, valueOf, order) }))
        .find((j) => j.rows !== null)
      if (!found?.rows) break
      chain = { rows: found.rows, first: Math.min(chains[found.at].first, chain.first) }
      chains.splice(found.at, 1)
    }
    chains.push(chain)
  })
  chains.sort((a, b) => compareChains(a, b, valueOf, order))
  return chains.flatMap((c) => c.rows)
}

/** 並び順の検査で外れなかったカードの前後の値から推定する */
export const estimateFromNeighbours = (
  before: number | null,
  after: number | null,
  order: SortOrder,
  kind: ValueKind,
): KeyEstimate | null => {
  if (before !== null && after !== null) {
    if (before === after) return { kind, value: before, range: null }
    return { kind, value: null, range: { min: Math.min(before, after), max: Math.max(before, after) } }
  }
  if (before !== null) return { kind, value: null, range: order === 'desc' ? { max: before } : { min: before } }
  if (after !== null) return { kind, value: null, range: order === 'desc' ? { min: after } : { max: after } }
  return null
}

const isBetween = (value: number, before: number | null, after: number | null, order: SortOrder) =>
  (before === null || fits(before, value, order)) && (after === null || fits(value, after, order))

/** 位置ごとの、その位置より前のいちばん近い値（自分は含まない） */
const lastBefore = (kept: readonly (number | null)[]): (number | null)[] => {
  let last: number | null = null
  return kept.map((v) => {
    const before = last
    if (v !== null) last = v
    return before
  })
}

/** 位置ごとの、前と後ろのいちばん近い外れなかったカードの値 */
const keptNeighbours = (kept: readonly (number | null)[]) => ({
  before: lastBefore(kept),
  after: lastBefore([...kept].reverse()).reverse(),
})

export type SortCheck = { violation: boolean; estimate: KeyEstimate | null }

/**
 * 1本の並びで、並び順に合わない読みと推定した値を決める。
 * 返すのは、並び順に合わない読みと、並びの項目の種類で値の範囲の検査に通らなかった読み（読みの印 → 結果）。
 */
export const checkSortOrder = (
  rows: readonly StitchedRow[],
  key: SortKey,
  order: SortOrder,
  checks: ReadonlyMap<string, ReadingCheck>,
): Map<string, SortCheck> => {
  const valueOf = keyValueOf(key, checks)
  const cards = rows.flat()
  const values = cards.map((slot) => cardValue(slot, valueOf))
  const valued = values.flatMap((v, i) => (v.kind === 'value' ? [{ i, value: v.value }] : []))
  const removedOfValued = findSortViolations(
    valued.map((v) => v.value),
    order,
  )
  const removed = new Set(valued.filter((_, k) => removedOfValued.has(k)).map((v) => v.i))
  const kept: (number | null)[] = values.map((v, i) => (v.kind === 'value' && !removed.has(i) ? v.value : null))
  const { before, after } = keptNeighbours(kept)
  const out = new Map<string, SortCheck>()
  cards.forEach((slot, i) => {
    const prev = before.at(i) ?? null
    const next = after.at(i) ?? null
    const conflict = values.at(i)?.kind === 'conflict'
    for (const reading of slot.readings) {
      const value = valueOf(reading)
      const violation = value !== null && (removed.has(i) || (conflict && !isBetween(value, prev, next, order)))
      const rangeFailed = reading.values.failures.some((f) => f.kind === key)
      if (violation || rangeFailed) {
        out.set(readingKey(reading), { violation, estimate: estimateFromNeighbours(prev, next, order, key) })
      }
    }
  })
  return out
}

/** 読みごとの検査に並び順の検査の結果を足す */
export const withSortChecks = (
  checks: ReadonlyMap<string, ReadingCheck>,
  sortChecks: ReadonlyMap<string, SortCheck>,
  key: SortKey,
): Map<string, ReadingCheck> => {
  const out = new Map(checks)
  for (const [id, sort] of sortChecks) {
    const base = out.get(id) ?? PASSED_CHECK
    const reasons: ReviewReason[] = sort.violation ? [...base.reasons, 'sort-order'] : base.reasons
    const failed = new Set(base.failedKinds)
    if (sort.violation) failed.add(key)
    out.set(id, {
      reasons,
      failedKinds: (['lv', 'npLv'] as const).filter((k) => failed.has(k)),
      estimate: sort.estimate,
    })
  }
  return out
}

// ---- 枚数 ----

/** つないだ並びのカードの数 */
export const countCards = (rows: readonly StitchedRow[]): number => rows.reduce((sum, row) => sum + row.length, 0)

/**
 * 読めたカードの数と所持数を比べる。所持数が1枚も読めないか画像の間で違えば検査しない。
 * 読めたカードが少ないときだけ知らせを返す。
 */
export const compareOwnedCount = (
  ownedCounts: readonly (number | null)[],
  readCount: number,
): { owned: number; read: number } | null => {
  const counts = new Set(ownedCounts.filter((c): c is number => c !== null))
  if (counts.size !== 1) return null
  const [owned] = counts
  return readCount < owned ? { owned, read: readCount } : null
}

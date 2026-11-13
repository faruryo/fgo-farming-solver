/**
 * 画像ごとに読み取った交換所の行を交換所の品目に、「獲得したイベントアイテム」の欄の数を通貨に当てはめる純粋関数。
 * アイコンの照合の結果は引数の関数で受け取る（画素の比べと canvas は analyze.ts の側に置く）。
 *
 * 行の当てはめ:
 * 1. 名前の近さ（findBestNameMatch と同じしきい値）と、読めたときは対価の数で候補の品目を絞る。対価の数で絞ると
 *    名前の近い品目が無くなるときは、対価の数を読み違えたものとして名前だけで絞る
 * 2. 候補が在庫上限の無い品目だけの行は結果に出さない。混じるときは在庫上限の無い品目を候補から除く
 * 3. 候補が1つならその品目、通貨が2種以上ならアイコンの照合で通貨を決める。決まらなければ「要確認」。
 *    対価の数が読めない行も名前だけで絞った候補で照合する。残りは候補を絞るのに使わない
 * 4. 当てた品目の在庫上限が読み取った残りより小さければ「要確認」（品目は決めない）
 * 5. 1枚の画像で、当てた行を上から見て、下の行が上の行と同じか前の品目に当たっていれば、その2行のうちアイコンで当てた行を「要確認」
 * 6. 1枚の画像で同じ品目に2つ以上の行が残れば、それらをすべて「要確認」。画像をまたいで同じ品目に当たった行は1つにまとめ、
 *    残りが食い違えば「要確認」
 *
 * 品目が決まって残りだけが読めなかった行（no-remaining）は、品目を決めたまま「要確認」にし、手順 5・6 では当てた行として扱う
 * （上下の行との食い違いと重なりに気づけるようにするため）。別の画像で同じ品目の残りが読めていれば、その値でまとめる。
 * 画像を選んだ順や画像どうしの前後は使わない。
 */
import type { EventShopItem } from '../master-data/types'
import { findBestNameMatch, MIN_ACCEPTABLE_NAME_SCORE, nameSimilarity } from '../possession-import/fuzzy-match'
import type { IconDecision, OwnedReading, ShopScreenRow } from './types'

export type RowSource = { imageIndex: number; rowIndex: number }

export type ReviewReason =
  /** 名前の近い品目が無い（名前が読めない・交換所データに名前が無いときも） */
  | 'no-name'
  /** 品目は決まったが残りを読めなかった */
  | 'no-remaining'
  /** アイコンの差の比が大きい・候補の通貨のアイコンを読み込めなかった */
  | 'icon-review'
  /** アイコンを切り出せない（切り出しが画像の外に出る・残りの値の枠が無い） */
  | 'no-crop'
  /** 候補が2つ以上残った（通貨が1種で候補が2つ以上・決めた通貨の候補が2つ以上） */
  | 'ambiguous'
  /** 当てた品目の在庫上限が読み取った残りより小さい */
  | 'exceeds-limit'
  /** 上下の行と交換所の順が食い違う */
  | 'order'
  /** 1枚の画像で同じ品目に2つ以上の行が当たった */
  | 'duplicate'
  /** 画像によって残りが違う */
  | 'conflict'

export type RemainingResult = {
  /**
   * 当てた品目の交換所の配列の添字。「要確認」で品目が決まっていなければ undefined。
   * conflict（値が食い違う）と no-remaining（残りが読めない）のときは決まっている
   */
  shopIndex?: number
  /** 候補の品目の添字（要確認の行で選ばせる。同じ名前で通貨ごとにある品目）。名前の近い品目が無ければ空 */
  candidates: number[]
  /** 読み取った残りの値（重複なし、読めた順）。読めなければ空 */
  values: number[]
  review: boolean
  reason?: ReviewReason
  /** アイコンの照合で当てた（または照合した）か */
  viaIcon: boolean
  /** 照合の結果で決めた通貨（表示用、アイコンで当てた行） */
  iconCurrency?: number
  sources: RowSource[]
}

export type OwnedSource = { imageIndex: number; index: number }

export type OwnedResult = {
  /** 当てた通貨。要確認で決まっていなければ undefined（画像によって値が違うときは決まっている） */
  costItemId?: number
  values: number[]
  review: boolean
  sources: OwnedSource[]
}

/** 1つの行の当てはめの途中の状態 */
type Placement = {
  source: RowSource
  y: number
  remaining: number | null
  candidates: number[]
  shopIndex?: number
  reason?: ReviewReason
  viaIcon: boolean
  iconCurrency?: number
}

type NamedItem = { index: number; name: string; costAmount: number }

const normalizeName = (text: string): string => text.normalize('NFKC').replace(/\s+/g, '')

/** 画面で名前の後ろに付く個数（「×10」）を除いた名前 */
const stripQuantity = (text: string): string => text.replace(/[×xX]\d[\d,]*$/, '')

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]

/** 手順 1: 名前の近さと対価の数で絞った候補の品目の添字 */
const nameCandidates = (row: ShopScreenRow, named: readonly NamedItem[]): number[] => {
  const read = normalizeName(row.name)
  const variants = unique([read, stripQuantity(read)]).filter((v) => v.length > 0)
  if (variants.length === 0) return []
  const scoreOf = (name: string) => Math.max(...variants.map((v) => nameSimilarity(v, name)))
  const acceptable = unique(named.map((n) => n.name)).filter((name) => scoreOf(name) >= MIN_ACCEPTABLE_NAME_SCORE)
  const sameCost = (n: NamedItem) => row.cost !== null && n.costAmount === row.cost
  const withCost = acceptable.filter((name) => named.some((n) => n.name === name && sameCost(n)))
  const pool = (withCost.length > 0 ? withCost : acceptable).map((name, i) => ({ atlasId: i, name }))
  const best = variants
    .map((v) => findBestNameMatch(v, pool))
    .reduce<ReturnType<typeof findBestNameMatch>>((a, b) => (b && (!a || b.score > a.score) ? b : a), null)
  if (!best || best.score < MIN_ACCEPTABLE_NAME_SCORE) return []
  return named
    .filter((n) => n.name === best.name && (withCost.length === 0 || sameCost(n)))
    .map((n) => n.index)
}

type ItemDecision = Pick<Placement, 'shopIndex' | 'reason' | 'viaIcon' | 'iconCurrency'>

/** 手順 3: 候補から品目を決める（通貨が2種以上ならアイコンの照合で） */
const decideItem = (
  candidates: readonly number[],
  costItemOf: (index: number) => number | undefined,
  iconOf: () => IconDecision,
): ItemDecision => {
  const only = candidates.at(0)
  if (only === undefined) return { reason: 'no-name', viaIcon: false }
  if (candidates.length === 1) return { shopIndex: only, viaIcon: false }
  const currencies = unique(candidates.map(costItemOf))
  if (currencies.length < 2) return { reason: 'ambiguous', viaIcon: false }
  const decision = iconOf()
  if (decision.kind === 'no-crop') return { reason: 'no-crop', viaIcon: false }
  if (decision.kind === 'review') return { reason: 'icon-review', viaIcon: true }
  const matched = candidates.filter((i) => costItemOf(i) === decision.costItemId)
  const matchedOnly = matched.at(0)
  if (matched.length === 1 && matchedOnly !== undefined) return { shopIndex: matchedOnly, viaIcon: true, iconCurrency: decision.costItemId }
  return { reason: matched.length === 0 ? 'icon-review' : 'ambiguous', viaIcon: true, iconCurrency: decision.costItemId }
}

const isPlaced = (p: Placement): p is Placement & { shopIndex: number } =>
  p.shopIndex !== undefined && (p.reason === undefined || p.reason === 'no-remaining')

const unplace = (p: Placement, reason: ReviewReason): void => {
  p.shopIndex = undefined
  p.reason = reason
}

/** 手順 1〜4 */
const placeRow = (
  row: ShopScreenRow,
  source: RowSource,
  shop: readonly EventShopItem[],
  named: readonly NamedItem[],
  iconOf: (source: RowSource, currencies: number[]) => IconDecision,
): Placement | null => {
  const byName = nameCandidates(row, named)
  const limited = byName.filter((i) => (shop.at(i)?.limitNum ?? 0) > 0)
  // 在庫上限の無い品目にしか当たらない行は取り込む値が無い
  if (byName.length > 0 && limited.length === 0) return null
  const costItemOf = (i: number) => shop.at(i)?.costItemId
  const decided = decideItem(limited, costItemOf, () =>
    iconOf(source, unique(limited.map(costItemOf)).filter((c): c is number => c !== undefined)),
  )
  const placement: Placement = { source, y: row.y, remaining: row.remaining, candidates: limited, ...decided }
  if (placement.shopIndex === undefined) {
    // 残りの値の枠が無いとアイコンも切り出せない。元の原因は残りが読めなかったことなので、その理由で出す
    if (placement.reason === 'no-crop' && row.remaining === null) placement.reason = 'no-remaining'
    return placement
  }
  if (row.remaining === null) placement.reason = 'no-remaining'
  else if ((shop.at(placement.shopIndex)?.limitNum ?? 0) < row.remaining) unplace(placement, 'exceeds-limit')
  return placement
}

/** 手順 5: 上下の行と交換所の順が食い違う組の、アイコンで当てた行を「要確認」にする */
const checkOrder = (placements: readonly Placement[]): void => {
  const placed = placements.filter(isPlaced).sort((a, b) => a.y - b.y)
  const marks = new Map<Placement, ReviewReason>()
  placed.slice(1).forEach((lower, i) => {
    const upper = placed.at(i)
    if (!upper || lower.shopIndex > upper.shopIndex) return
    const reason: ReviewReason = lower.shopIndex === upper.shopIndex ? 'duplicate' : 'order'
    for (const p of [upper, lower]) {
      if (p.viaIcon && !marks.has(p)) marks.set(p, reason)
    }
  })
  marks.forEach((reason, p) => unplace(p, reason))
}

/** 手順 6 の前半: 1枚の画像で同じ品目に残った行をすべて「要確認」にする */
const checkDuplicates = (placements: readonly Placement[]): void => {
  const byItem = new Map<number, Placement[]>()
  for (const p of placements.filter(isPlaced)) byItem.set(p.shopIndex, [...(byItem.get(p.shopIndex) ?? []), p])
  byItem.forEach((group) => {
    if (group.length > 1) group.forEach((p) => unplace(p, 'duplicate'))
  })
}

const sortKey = (r: RemainingResult): number => r.shopIndex ?? r.candidates.at(0) ?? Infinity

const bySource = (a: RemainingResult, b: RemainingResult): number => {
  const sa = a.sources.at(0)
  const sb = b.sources.at(0)
  return (sa?.imageIndex ?? 0) - (sb?.imageIndex ?? 0) || (sa?.rowIndex ?? 0) - (sb?.rowIndex ?? 0)
}

/** 手順 6 の後半: 画像をまたいで同じ品目に当たった行を1つにまとめる */
const mergePlaced = (shopIndex: number, group: readonly Placement[], shop: readonly EventShopItem[]): RemainingResult => {
  const values = unique(group.flatMap((p) => (p.remaining === null ? [] : [p.remaining])))
  const viaIcon = group.some((p) => p.viaIcon)
  let reason: ReviewReason | undefined
  if (values.length === 0) reason = 'no-remaining'
  else if (values.length > 1) reason = 'conflict'
  return {
    shopIndex,
    candidates: group.at(0)?.candidates ?? [shopIndex],
    values,
    review: reason !== undefined,
    ...(reason ? { reason } : {}),
    viaIcon,
    ...(viaIcon ? { iconCurrency: shop.at(shopIndex)?.costItemId } : {}),
    sources: group.map((p) => p.source),
  }
}

const reviewResult = (p: Placement): RemainingResult => ({
  candidates: p.candidates,
  values: p.remaining === null ? [] : [p.remaining],
  review: true,
  ...(p.reason ? { reason: p.reason } : {}),
  viaIcon: p.viaIcon,
  ...(p.iconCurrency !== undefined ? { iconCurrency: p.iconCurrency } : {}),
  sources: [p.source],
})

/**
 * 画像ごとの行（上から順でなくてもよい）を交換所の品目に当てはめ、品目ごとの残りと「要確認」の行を返す。
 * `iconOf` は、その行の残りの値の右のアイコンを候補の通貨と照合した結果を返す（通貨が2種以上の行でだけ呼ぶ）。
 * 結果は当てた品目（要確認なら最初の候補）の交換所の順に並べる。
 */
export const assignShopRows = (
  images: readonly ShopScreenRow[][],
  shop: readonly EventShopItem[],
  iconOf: (source: RowSource, currencies: number[]) => IconDecision,
): RemainingResult[] => {
  const named = shop.flatMap((item, index) => {
    const name = normalizeName(item.name ?? '')
    return name ? [{ index, name, costAmount: item.costAmount }] : []
  })
  const all = images.flatMap((rows, imageIndex) => {
    const placements = rows.flatMap((row, rowIndex) => placeRow(row, { imageIndex, rowIndex }, shop, named, iconOf) ?? [])
    checkOrder(placements)
    checkDuplicates(placements)
    return placements
  })
  const groups = new Map<number, Placement[]>()
  for (const p of all.filter(isPlaced)) groups.set(p.shopIndex, [...(groups.get(p.shopIndex) ?? []), p])
  return [
    ...[...groups].map(([shopIndex, group]) => mergePlaced(shopIndex, group, shop)),
    ...all.filter((p) => !isPlaced(p)).map(reviewResult),
  ].sort((a, b) => sortKey(a) - sortKey(b) || bySource(a, b))
}

type OwnedPlacement = { source: OwnedSource; value: number; costItemId?: number }

/**
 * 「獲得したイベントアイテム」の欄の数（画像ごと、左から）を通貨に当てはめる。
 * `currencyOf` は、その数の左のアイコンを交換所のすべての通貨と照合した結果を返す。
 * 照合が決まらない数と、1枚の画像で同じ通貨に2つ以上決まった数は「要確認」。画像をまたいで同じ通貨に決まった数は、
 * 値が同じなら1つにまとめ、違えばその通貨を「要確認」にして値をすべて返す。結果は最初に読んだ画像・位置の順。
 */
export const assignOwnedCounts = (
  images: readonly OwnedReading[][],
  currencyOf: (source: OwnedSource) => IconDecision,
): OwnedResult[] => {
  const all = images.flatMap((readings, imageIndex) => {
    const placements: OwnedPlacement[] = readings.map((reading, index) => {
      const source = { imageIndex, index }
      const decision = currencyOf(source)
      return { source, value: reading.value, ...(decision.kind === 'matched' ? { costItemId: decision.costItemId } : {}) }
    })
    const counts = new Map<number, number>()
    for (const p of placements) {
      if (p.costItemId !== undefined) counts.set(p.costItemId, (counts.get(p.costItemId) ?? 0) + 1)
    }
    return placements.map((p) =>
      p.costItemId !== undefined && (counts.get(p.costItemId) ?? 0) > 1 ? { source: p.source, value: p.value } : p,
    )
  })
  const groups = new Map<number, OwnedPlacement[]>()
  const results: OwnedResult[] = []
  for (const p of all) {
    if (p.costItemId === undefined) {
      results.push({ values: [p.value], review: true, sources: [p.source] })
      continue
    }
    const group = groups.get(p.costItemId)
    if (group) {
      group.push(p)
      continue
    }
    const created = [p]
    groups.set(p.costItemId, created)
    // 結果の位置は最初に読んだ数の位置にし、まとめた数はあとで埋める
    results.push({ costItemId: p.costItemId, values: [], review: false, sources: [] })
  }
  return results.map((r) => {
    const group = r.costItemId === undefined ? undefined : groups.get(r.costItemId)
    if (!group) return r
    const values = unique(group.map((p) => p.value))
    return { ...r, values, review: values.length > 1, sources: group.map((p) => p.source) }
  })
}

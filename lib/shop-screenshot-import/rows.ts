/**
 * 交換所の画面の文字認識の結果（文字と枠）から、行（名前・残り・対価の数）と
 * 「獲得したイベントアイテム」の欄の数を組み立てる純粋関数。
 *
 * 行の組み立て方:
 * - 「交換期間」「残り N回」「売り切れ」を行の目印にし、縦の位置の重なる目印を1つの帯にまとめる
 * - 目印が別の文字の行に分かれて写る画面でも1つの行になるよう、「交換期間」だけの帯と「残り」（売り切れ）だけの帯が
 *   目印の文字の高さより近く隣り合うときは、近い組から1つにまとめる
 * - 名前（漢字・かなの多い文字）と対価の数（数だけの文字）は、縦に一番近い帯に入れる。帯から目印の文字の高さの
 *   1.5 倍より離れた文字はどの帯にも入れない（隣の行の文字を拾わないため）
 * - 対価の数は帯の中の数だけの文字のうち一番右のもの。「所持」のすぐ右の数と「残り」のすぐ右の数は使わない
 * - 帯の上下が画像の端から目印の文字の高さの 1.5 倍より近く、名前か残りのどちらかが無い帯は、端で切れた行として捨てる
 * - 名前も残りも無い帯は捨てる
 */
import type { OcrBox, OwnedReading, Rect, ShopScreenRow } from './types'

/** 帯から文字を入れる縦の距離（目印の文字の高さの倍数） */
const NEAR_BAND = 1.5
/** 画像の端で切れた行とみなす距離（目印の文字の高さの倍数） */
const EDGE_MARGIN = 1.5
/** 「残り」「所持」の右の数として組む横の距離（文字の高さの倍数） */
const PAIR_GAP = 3
/** 名前が2つ以上の枠に分かれたときにつなぐ横の距離（文字の高さの倍数） */
const NAME_GAP = 2
/** 「獲得したイベントアイテム」の見出しから数を探す縦の範囲（見出しの高さの倍数、見出しの下端から） */
const OWNED_BELOW = 2.5

type TokenKind =
  | 'remaining'
  | 'remaining-label'
  | 'count'
  | 'sold-out'
  | 'period'
  | 'possession'
  | 'number'
  | 'name'
  | 'other'

type Token = {
  box: Rect
  kind: TokenKind
  /** 残り・数の値 */
  value: number | null
  text: string
  /** ほかの目印と組んで使い終えた */
  used: boolean
}

type Band = { top: number; bottom: number; markers: Token[]; members: Token[] }

const JAPANESE_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・々]/gu
const PLAIN_NUMBER = /^\d[\d,]*$/
const REMAINING = /残[りリ](\d[\d,]*)回?/
const REMAINING_LABEL = /^残[りリ]$/
const COUNT = /^(\d[\d,]*)回$/
const SOLD_OUT = /売り?切れ/
const PERIOD = /交換期間/
const POSSESSION = /^所持/
const OWNED_HEADING = /獲得した|イベントアイテム/
const OWNED_NUMBER = /^[×xX]?(\d[\d,]*)$/
/** 名前にしない画面の見出し */
const UI_LABEL = /イベントアイテム|交換所/

/** 全角の数字・記号を半角にし、空白を除く */
const compact = (text: string): string => text.normalize('NFKC').replace(/\s+/g, '')

const toNumber = (digits: string): number | null => {
  const value = Number(digits.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

const bottomOf = (r: Rect) => r.y + r.height
const centerY = (r: Rect) => r.y + r.height / 2

const union = (rects: readonly Rect[]): Rect => {
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.width))
  const bottom = Math.max(...rects.map(bottomOf))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** 縦に文字の高さの半分以上重なる（同じ文字の行） */
const sameLine = (a: Rect, b: Rect): boolean => {
  const overlap = Math.min(bottomOf(a), bottomOf(b)) - Math.max(a.y, b.y)
  return overlap >= Math.min(a.height, b.height) / 2
}

const japaneseCount = (text: string): number => text.match(JAPANESE_CHAR)?.length ?? 0

/** 漢字・かなが2字以上で、半分以上を占める */
const isNameLike = (text: string): boolean => {
  const count = japaneseCount(text)
  return count >= 2 && count * 2 >= text.length && !UI_LABEL.test(text)
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.at(Math.floor(sorted.length / 2)) ?? 0
}

const token = (box: Rect, kind: TokenKind, text: string, value: number | null = null): Token => ({
  box,
  kind,
  value,
  text,
  used: false,
})

/** 目印の前に名前が同じ枠で続いて読まれたとき（「叡智の業火 残り80回」）の名前の部分 */
const namePrefix = (box: Rect, text: string, markerIndex: number): Token[] => {
  const prefix = text.slice(0, markerIndex)
  return markerIndex > 0 && isNameLike(prefix) ? [token(box, 'name', prefix)] : []
}

const classifyMarker = (box: Rect, text: string): Token[] | null => {
  const remaining = REMAINING.exec(text)
  if (remaining) {
    return [token(box, 'remaining', text, toNumber(remaining[1])), ...namePrefix(box, text, remaining.index)]
  }
  const soldOut = SOLD_OUT.exec(text)
  if (soldOut) return [token(box, 'sold-out', text, 0), ...namePrefix(box, text, soldOut.index)]
  if (PERIOD.test(text)) return [token(box, 'period', text)]
  return null
}

/** 1つの枠を目印・数・名前などに分ける（目印の前に名前が続くときは2つになる） */
const classify = (box: OcrBox): Token[] => {
  const text = compact(box.text)
  const rect: Rect = { x: box.x, y: box.y, width: box.width, height: box.height }
  const marker = classifyMarker(rect, text)
  if (marker) return marker
  if (REMAINING_LABEL.test(text)) return [token(rect, 'remaining-label', text)]
  const count = COUNT.exec(text)
  if (count) return [token(rect, 'count', text, toNumber(count[1]))]
  if (POSSESSION.test(text)) return [token(rect, 'possession', text)]
  if (PLAIN_NUMBER.test(text)) return [token(rect, 'number', text, toNumber(text))]
  if (isNameLike(text)) return [token(rect, 'name', text)]
  return [token(rect, 'other', text)]
}

/** `from` の右の同じ文字の行にある、`kinds` の一番近い枠 */
const nearestRight = (from: Token, tokens: readonly Token[], kinds: readonly TokenKind[]): Token | undefined => {
  const right = from.box.x + from.box.width
  return tokens
    .filter(
      (t) =>
        !t.used &&
        kinds.includes(t.kind) &&
        sameLine(t.box, from.box) &&
        t.box.x >= from.box.x + from.box.width / 2 &&
        t.box.x - right <= from.box.height * PAIR_GAP,
    )
    .sort((a, b) => a.box.x - b.box.x)
    .at(0)
}

/** 「残り」と「80回」（または「80」）が別の枠で読まれたときに組む。「所持」のすぐ右の数は使い終えたことにする */
const pairSplitTokens = (tokens: Token[]): void => {
  for (const label of tokens.filter((t) => t.kind === 'remaining-label')) {
    const partner = nearestRight(label, tokens, ['count', 'number'])
    label.kind = 'remaining'
    if (partner) {
      partner.used = true
      label.value = partner.value
      label.box = union([label.box, partner.box])
    }
  }
  for (const label of tokens.filter((t) => t.kind === 'possession' && t.text === '所持')) {
    const partner = nearestRight(label, tokens, ['number'])
    if (partner) partner.used = true
  }
  // 「残り」が読めずに「80回」だけ読めた枠も残りの目印にする
  for (const count of tokens.filter((t) => t.kind === 'count' && !t.used)) count.kind = 'remaining'
}

const isMarker = (t: Token) => !t.used && (t.kind === 'remaining' || t.kind === 'sold-out' || t.kind === 'period')

/** 縦の位置の重なる目印を1つの帯にまとめる */
const groupMarkers = (markers: readonly Token[]): Band[] => {
  const bands: Band[] = []
  for (const marker of [...markers].sort((a, b) => a.box.y - b.box.y)) {
    const last = bands.at(-1)
    if (last && marker.box.y < last.bottom) {
      last.bottom = Math.max(last.bottom, bottomOf(marker.box))
      last.markers.push(marker)
    } else {
      bands.push({ top: marker.box.y, bottom: bottomOf(marker.box), markers: [marker], members: [] })
    }
  }
  return bands
}

const hasPeriod = (band: Band) => band.markers.some((m) => m.kind === 'period')
const hasRemaining = (band: Band) => band.markers.some((m) => m.kind !== 'period')
const lineHeightOf = (band: Band) => median(band.markers.map((m) => m.box.height))

/** 「交換期間」だけの帯と「残り」だけの帯が近く隣り合うとき、近い組から1つにまとめる */
const mergeSplitBands = (bands: Band[]): Band[] => {
  const onlyPeriod = (b: Band) => hasPeriod(b) && !hasRemaining(b)
  const onlyRemaining = (b: Band) => hasRemaining(b) && !hasPeriod(b)
  const pairs = bands
    .slice(1)
    .map((lower, i) => ({ upper: bands.at(i), lower, gap: lower.top - (bands.at(i)?.bottom ?? 0) }))
    .filter(({ upper, lower, gap }) => {
      if (!upper) return false
      const complementary = (onlyPeriod(upper) && onlyRemaining(lower)) || (onlyRemaining(upper) && onlyPeriod(lower))
      return complementary && gap < Math.max(lineHeightOf(upper), lineHeightOf(lower))
    })
    .sort((a, b) => a.gap - b.gap)
  const merged = new Set<Band>()
  for (const { upper, lower } of pairs) {
    if (!upper || merged.has(upper) || merged.has(lower)) continue
    upper.bottom = Math.max(upper.bottom, lower.bottom)
    upper.markers.push(...lower.markers)
    merged.add(upper)
    merged.add(lower)
    lower.markers = []
  }
  return bands.filter((b) => b.markers.length > 0)
}

const verticalDistance = (band: Band, r: Rect): number =>
  Math.max(0, band.top - bottomOf(r), r.y - band.bottom)

/** 名前と数の枠を縦に一番近い帯に入れる（離れすぎた枠は入れない） */
const attachMembers = (bands: readonly Band[], tokens: readonly Token[]): void => {
  for (const t of tokens) {
    if (t.used || (t.kind !== 'name' && t.kind !== 'number')) continue
    let nearest: Band | undefined
    let nearestDistance = Infinity
    for (const band of bands) {
      const distance = verticalDistance(band, t.box)
      if (distance < nearestDistance) {
        nearest = band
        nearestDistance = distance
      }
    }
    if (nearest && nearestDistance <= lineHeightOf(nearest) * NEAR_BAND) nearest.members.push(t)
  }
}

/** 漢字・かなの一番多い名前の枠に、同じ文字の行で横に続く名前の枠をつなぐ */
const pickName = (band: Band): { name: string; box: Rect } | null => {
  const names = band.members.filter((m) => m.kind === 'name')
  const main = [...names].sort((a, b) => japaneseCount(b.text) - japaneseCount(a.text) || a.box.x - b.box.x).at(0)
  if (!main) return null
  const line = names.filter((n) => sameLine(n.box, main.box)).sort((a, b) => a.box.x - b.box.x)
  const parts: Token[] = [main]
  const extend = (candidates: readonly Token[], direction: 1 | -1) => {
    let edge = main.box
    for (const next of candidates) {
      const gap = direction === 1 ? next.box.x - (edge.x + edge.width) : edge.x - (next.box.x + next.box.width)
      if (gap > main.box.height * NAME_GAP) break
      parts.push(next)
      edge = next.box
    }
  }
  extend(line.filter((n) => n.box.x > main.box.x), 1)
  extend(line.filter((n) => n.box.x < main.box.x).reverse(), -1)
  parts.sort((a, b) => a.box.x - b.box.x)
  return { name: parts.map((p) => p.text).join(''), box: union(parts.map((p) => p.box)) }
}

/** 残りの値。数のある「残り」を先に、無ければ売り切れを 0 として読む */
const pickRemaining = (band: Band): number | null => {
  const read = band.markers.find((m) => m.kind === 'remaining' && m.value !== null)
  if (read) return read.value
  return band.markers.some((m) => m.kind === 'sold-out') ? 0 : null
}

const toRow = (band: Band, imageHeight: number): ShopScreenRow | null => {
  const name = pickName(band)
  const remaining = pickRemaining(band)
  const cost = band.members
    .filter((m) => m.kind === 'number' && m.value !== null)
    .sort((a, b) => b.box.x + b.box.width - (a.box.x + a.box.width))
    .at(0)
  const extent = union([...band.markers, ...band.members].map((t) => t.box))
  const margin = lineHeightOf(band) * EDGE_MARGIN
  const nearEdge = extent.y < margin || bottomOf(extent) > imageHeight - margin
  if (!name && remaining === null) return null
  if (nearEdge && (!name || remaining === null)) return null
  return {
    name: name?.name ?? '',
    nameBox: name?.box ?? extent,
    remaining,
    cost: cost?.value ?? null,
    costBox: cost ? cost.box : null,
    band: { top: extent.y, bottom: bottomOf(extent) },
    y: centerY(extent),
  }
}

type OwnedSection = { heading: OcrBox; numbers: { box: OcrBox; value: number }[] }

/**
 * 「獲得したイベントアイテム」の見出しと、その近くの数。
 * 見出しと同じ文字の行の右か、見出しの下端から見出しの高さの 2.5 倍までにある数だけの文字を、
 * 同じ文字の行ごとにまとめ、見出しに一番近い行を使う（その下の交換所の行の対価の数を拾わないため）。
 */
const findOwnedSection = (boxes: readonly OcrBox[]): OwnedSection | null => {
  const heading = boxes.find((b) => OWNED_HEADING.test(compact(b.text)))
  if (!heading) return null
  const numbers = boxes.flatMap((box) => {
    const match = OWNED_NUMBER.exec(compact(box.text))
    const value = match ? toNumber(match[1]) : null
    if (value === null) return []
    const inLine = sameLine(box, heading) && box.x >= heading.x + heading.width / 2
    const below = box.y >= heading.y + heading.height / 2 && centerY(box) <= bottomOf(heading) + heading.height * OWNED_BELOW
    return inLine || below ? [{ box, value }] : []
  })
  const lines: { box: OcrBox; value: number }[][] = []
  for (const n of [...numbers].sort((a, b) => centerY(a.box) - centerY(b.box))) {
    const line = lines.find((l) => l.some((m) => sameLine(m.box, n.box)))
    if (line) line.push(n)
    else lines.push([n])
  }
  const nearest = lines.at(0) ?? []
  return { heading, numbers: [...nearest].sort((a, b) => a.box.x - b.box.x) }
}

/** 「獲得したイベントアイテム」の欄の数を左から読む。見出しが無ければ空 */
export const readOwnedCounts = (boxes: OcrBox[]): OwnedReading[] =>
  (findOwnedSection(boxes)?.numbers ?? []).map(({ box, value }) => ({
    value,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
  }))

/** 交換所の画面の文字と枠から、行を上から順に組み立てる */
export const parseShopRows = (boxes: OcrBox[], imageHeight: number): ShopScreenRow[] => {
  const owned = findOwnedSection(boxes)
  const excluded = new Set<OcrBox>(owned ? [owned.heading, ...owned.numbers.map((n) => n.box)] : [])
  const tokens = boxes.filter((b) => !excluded.has(b)).flatMap(classify)
  pairSplitTokens(tokens)
  const bands = mergeSplitBands(groupMarkers(tokens.filter(isMarker)))
  attachMembers(bands, tokens)
  return bands
    .map((band) => toRow(band, imageHeight))
    .filter((row): row is ShopScreenRow => row !== null)
    .sort((a, b) => a.y - b.y)
}

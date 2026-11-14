/**
 * 交換所の画面の文字認識の結果（文字と枠）から、行（名前・残り・対価の数）と
 * 「獲得したイベントアイテム」の欄の数を組み立てる純粋関数。
 *
 * 行の組み立て方（長さの単位は、その行の見出しの枠の高さ h）:
 * 1. 「交換期間」を含み数字を含まない枠を行の見出しにする（「交換期間あと残り」も含む）。「残り」の文字は目印にも値にも使わない
 * 2. 縦の中心が見出しの上端から 1.2h〜2.6h 下で、左端が見出しの左端から h より左に出ない枠を値の段にする
 * 3. 値の段に「切れ」を含む枠があれば残りは 0。無ければ「回」の直前の数字を残りにする。残りを取った枠を残りの値の枠とする
 * 4. 対価の数は、値の段で残りの値の枠より右にある、数字だけで確からしさの高い枠のうち一番右のもの
 * 5. 名前は、上端が見出しの上端から 2.8h〜5.2h 上で左端が見出しとそろう枠を先頭にし、同じ高さで右に続く枠をつなぐ。
 *    一覧の題（「交換報酬」を含む枠）は名前にしない
 * 6. 名前の無い行は出さない
 * 7. 残りが取れず、見出しの上端から 3h 下が画像の下端を越える行は、端で切れた行として捨てる
 */
import type { OcrBox, OwnedReading, Rect, ShopScreenRow } from './types'

/**
 * 行と欄の位置の定数（見出しの枠の高さの倍数。実物の画面の実測の幅より広く取った値）。
 * - valueTop・valueBottom: 値の段の縦の中心の範囲（見出しの上端から下へ）
 * - valueLeft: 値の段の左端が見出しの左端から左へ出てよい幅
 * - nameNear・nameFar: 名前の上端の範囲（見出しの上端から上へ）
 * - nameAlign: 名前の左端と見出しの左端のずれの許容
 * - rowBottom: 値の段の下の端（見出しの上端から下へ）
 * - minConfidence: 対価の数・欄の数に使う確からしさの下限
 * - ownedBelow: 欄の数の上端の範囲（欄の見出しの上端から下へ。欄の見出しの高さの倍数）
 * - ownedRight: 欄の数の右端の範囲（欄の見出しの左端から右へ。欄の見出しの高さの倍数）
 */
export const SHOP_ROW_LAYOUT = {
  valueTop: 1.2,
  valueBottom: 2.6,
  valueLeft: 1,
  nameNear: 2.8,
  nameFar: 5.2,
  nameAlign: 0.75,
  rowBottom: 3,
  minConfidence: 0.95,
  ownedBelow: 8,
  ownedRight: 25,
} as const

const HEADING = /交換期間/
const DIGIT = /\d/
const SOLD_OUT = /切れ/
const COUNT_SUFFIX = '回'
const DIGIT_OR_COMMA = /^[\d,]$/
const PLAIN_NUMBER = /^\d[\d,]*$/
const LIST_TITLE = /交換報酬/
const OWNED_HEADING = /獲得したイベントアイテム/

/** 全角の数字・記号を半角にし、空白を除く */
const compact = (text: string): string => text.normalize('NFKC').replace(/\s+/g, '')

const toNumber = (digits: string): number | null => {
  const value = Number(digits.replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

/** 「回」の直前に続く数字（「8日1回」なら 1）。無ければ null */
const countBeforeSuffix = (text: string): number | null => {
  const end = text.indexOf(COUNT_SUFFIX)
  let start = end
  while (start > 0 && DIGIT_OR_COMMA.test(text.charAt(start - 1))) start--
  const digits = text.slice(start, end)
  return end > 0 && DIGIT.test(digits.charAt(0)) ? toNumber(digits) : null
}

const rectOf = (box: OcrBox): Rect => ({ x: box.x, y: box.y, width: box.width, height: box.height })
const right = (r: Rect) => r.x + r.width
const bottom = (r: Rect) => r.y + r.height
const centerY = (r: Rect) => r.y + r.height / 2

const union = (rects: readonly Rect[]): Rect => {
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const r = Math.max(...rects.map(right))
  const b = Math.max(...rects.map(bottom))
  return { x: left, y: top, width: r - left, height: b - top }
}

type Text = { box: OcrBox; text: string }

const isHeading = (t: Text) => HEADING.test(t.text) && !DIGIT.test(t.text)

/** 値の段の枠（見出しの下） */
const valueStage = (heading: OcrBox, texts: readonly Text[]): Text[] => {
  const h = heading.height
  return texts.filter((t) => {
    const cy = centerY(t.box)
    return (
      cy >= heading.y + h * SHOP_ROW_LAYOUT.valueTop &&
      cy <= heading.y + h * SHOP_ROW_LAYOUT.valueBottom &&
      t.box.x >= heading.x - h * SHOP_ROW_LAYOUT.valueLeft
    )
  })
}

/** 残りと残りの値の枠。「切れ」を含む枠を先に（売り切れ = 0）、無ければ「回」の直前の数字 */
const pickRemaining = (stage: readonly Text[]): { value: number; box: OcrBox } | null => {
  const byX = [...stage].sort((a, b) => a.box.x - b.box.x)
  const soldOut = byX.find((t) => SOLD_OUT.test(t.text))
  if (soldOut) return { value: 0, box: soldOut.box }
  for (const t of byX) {
    const value = countBeforeSuffix(t.text)
    if (value !== null) return { value, box: t.box }
  }
  return null
}

/** 対価の数: 残りの値の枠より右の、数字だけで確からしさの高い枠のうち一番右 */
const pickCost = (stage: readonly Text[], from: number): { value: number; box: OcrBox } | null => {
  const numbers = stage
    .filter((t) => PLAIN_NUMBER.test(t.text) && t.box.confidence >= SHOP_ROW_LAYOUT.minConfidence && t.box.x >= from)
    .sort((a, b) => right(b.box) - right(a.box))
  const top = numbers.at(0)
  const value = top ? toNumber(top.text) : null
  return top && value !== null ? { value, box: top.box } : null
}

/** 名前: 見出しの上の左端のそろう枠を先頭に、同じ高さで右に続く枠を左から順につなぐ */
const pickName = (heading: OcrBox, texts: readonly Text[]): { name: string; box: Rect } | null => {
  const h = heading.height
  const usable = texts.filter((t) => !LIST_TITLE.test(t.text) && !isHeading(t))
  const lead = usable
    .filter((t) => {
      const above = heading.y - t.box.y
      return (
        above >= h * SHOP_ROW_LAYOUT.nameNear &&
        above <= h * SHOP_ROW_LAYOUT.nameFar &&
        Math.abs(t.box.x - heading.x) <= h * SHOP_ROW_LAYOUT.nameAlign
      )
    })
    // 見出しに一番近い（下の）枠を先頭にする
    .sort((a, b) => b.box.y - a.box.y)
    .at(0)
  if (!lead) return null
  const rest = usable
    .filter(
      (t) =>
        t !== lead &&
        t.box.x > lead.box.x &&
        Math.abs(centerY(t.box) - centerY(lead.box)) <= lead.box.height / 2,
    )
    .sort((a, b) => a.box.x - b.box.x)
  const parts = [lead, ...rest]
  return { name: parts.map((p) => p.text).join(''), box: union(parts.map((p) => rectOf(p.box))) }
}

const toRow = (heading: OcrBox, texts: readonly Text[], imageHeight: number): ShopScreenRow | null => {
  const h = heading.height
  const name = pickName(heading, texts)
  if (!name) return null
  const stage = valueStage(heading, texts)
  const remaining = pickRemaining(stage)
  const rowBottom = heading.y + h * SHOP_ROW_LAYOUT.rowBottom
  if (!remaining && rowBottom > imageHeight) return null
  const cost = pickCost(stage, remaining ? right(remaining.box) : heading.x)
  const extent = union([name.box, rectOf(heading), ...stage.map((t) => rectOf(t.box))])
  return {
    name: name.name,
    nameBox: name.box,
    remaining: remaining?.value ?? null,
    remainingBox: remaining ? rectOf(remaining.box) : null,
    headingBox: rectOf(heading),
    cost: cost?.value ?? null,
    costBox: cost ? rectOf(cost.box) : null,
    band: { top: extent.y, bottom: Math.max(bottom(extent), Math.min(imageHeight, rowBottom)) },
    y: centerY(heading),
  }
}

/** 交換所の画面の文字と枠から、行を上から順に組み立てる */
export const parseShopRows = (boxes: OcrBox[], imageHeight: number): ShopScreenRow[] => {
  const texts: Text[] = boxes.map((box) => ({ box, text: compact(box.text) }))
  return texts
    .filter(isHeading)
    .map((heading) => toRow(heading.box, texts, imageHeight))
    .filter((row): row is ShopScreenRow => row !== null)
    .sort((a, b) => a.y - b.y)
}

/**
 * 「獲得したイベントアイテム」の欄の数を、上の段から左から順に読む。見出しが無ければ空。
 * 数字だけで確からしさの高い、見出しの下の決まった範囲の枠だけを読む（画面の上の帯の数・一覧の品目の所持の数・
 * アイコンを数字と読み違えた文字を拾わないため）。段の数は決めない。
 */
export const readOwnedCounts = (boxes: OcrBox[]): OwnedReading[] => {
  const heading = boxes.find((b) => OWNED_HEADING.test(compact(b.text)))
  if (!heading) return []
  const H = heading.height
  return boxes
    .flatMap((box) => {
      const text = compact(box.text)
      const value = PLAIN_NUMBER.test(text) ? toNumber(text) : null
      if (value === null || box.confidence < SHOP_ROW_LAYOUT.minConfidence) return []
      const inside =
        box.y > bottom(heading) &&
        box.y <= heading.y + H * SHOP_ROW_LAYOUT.ownedBelow &&
        right(box) <= heading.x + H * SHOP_ROW_LAYOUT.ownedRight
      return inside ? [{ value, box: rectOf(box), headingHeight: H }] : []
    })
    .sort((a, b) => {
      const sameLine = Math.abs(centerY(a.box) - centerY(b.box)) <= Math.min(a.box.height, b.box.height) / 2
      return sameLine ? a.box.x - b.box.x : a.box.y - b.box.y
    })
}

import { describe, expect, it } from 'vitest'
import { parseShopRows, readOwnedCounts } from './rows'
import type { OcrBox } from './types'

/** 実物の画面（2796×1290）で測った枠の例から作る */
const IMAGE_HEIGHT = 1290

const box = (text: string, x: number, y: number, width: number, height: number, confidence = 1): OcrBox => ({
  text,
  confidence,
  x,
  y,
  width,
  height,
})

/** 残りのある行（月より団子・残り 1・対価 100） */
const DANGO_ROW: OcrBox[] = [
  box('月より団子', 1686, 459, 284, 57),
  box('【復刻版価格】', 1713, 537, 209, 35, 0.98),
  box('盈月剣風帖限定★5概念礼装へ交換', 1691, 572, 568, 40, 0.99),
  box('交換期間あと', 1695, 616, 245, 35),
  box('残り', 1988, 612, 96, 39),
  box('8日', 1879, 660, 96, 56),
  box('1回', 2110, 660, 92, 56, 0.98),
  box('100', 2425, 664, 113, 44),
]

/** 売り切れの行（「8日売り切れ」がつながり、品目のアイコンに「所持 850」が重なる） */
const COIN_ROW: OcrBox[] = [
  box('サーヴァントコイン(宮本伊織)', 1691, 415, 742, 57, 0.97),
  box('【復刻版価格】', 1699, 489, 236, 44, 0.99),
  box('サーヴァントコイン10個へ交換', 1691, 529, 524, 43, 0.99),
  box('交換期間あと', 1686, 572, 297, 44),
  box('残り', 1962, 572, 126, 40),
  box('8日売り切れ', 1879, 625, 318, 43),
  box('10', 2451, 616, 96, 61),
  box('所持', 1402, 638, 158, 44, 0.99),
  box('-850', 1542, 629, 136, 57, 0.96),
]

/** 名前が一覧の上に隠れた行（一覧の題と説明文だけが写る） */
const HIDDEN_NAME_ROW: OcrBox[] = [
  box('イベントアイテム交換報酬ー覧', 1739, 332, 585, 57, 0.98),
  box('【スキル強化素材】へ交換', 1708, 437, 425, 39, 0.98),
  box('交換期間あと', 1691, 494, 253, 39),
  box('残り', 1966, 494, 118, 39),
  box('8日', 1879, 546, 100, 44, 0.99),
  box('売り切れ', 1992, 546, 205, 44),
  box('20', 2451, 537, 92, 62),
]

/** 下の端で切れた行（名前が MENU に切られて2つの枠に分かれ、見出しが「残り」とつながる） */
const CUT_ROW: OcrBox[] = [
  box('サーヴァントコイン', 1686, 1088, 481, 57),
  box('(宮本', 2176, 1097, 122, 43, 0.95),
  box('【復刻版価格】', 1699, 1166, 232, 40, 0.99),
  box('ヴァントコイン10個へ交換', 1752, 1201, 459, 40, 0.99),
  box('交換期間あと残り', 1686, 1245, 402, 44),
]

/** 「獲得したイベントアイテム」の欄 */
const OWNED_SECTION: OcrBox[] = [
  box('獲得したイベントアイテム', 384, 944, 415, 39),
  box('交換期限 残り8日', 913, 944, 284, 43, 0.95),
  box('02', 367, 1022, 109, 61, 0.7),
  box('469', 638, 1031, 105, 57),
  box('4', 804, 1014, 127, 83, 0.39),
  box('288', 1088, 1027, 109, 56),
  box('214', 638, 1118, 109, 57),
  box('180', 1538, 987, 144, 57),
]

/** 画面の上の帯に写る同じ所持数 */
const TOP_BAR: OcrBox[] = [
  box('469', 2119, 22, 78, 39),
  box('4', 1590, 74, 96, 79, 0.91),
  box('288', 1804, 92, 79, 39),
  box('214', 2110, 92, 92, 39),
]

/** 行の文字を縦に `dy` ずらす */
const shift = (boxes: readonly OcrBox[], dy: number): OcrBox[] => boxes.map((b) => ({ ...b, y: b.y + dy }))

describe('parseShopRows', () => {
  it('残りを読む: 名前・残り・対価の数を読み、「8日」の 8 は残りにしない', () => {
    const rows = parseShopRows(DANGO_ROW, IMAGE_HEIGHT)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: '月より団子',
      remaining: 1,
      cost: 100,
      remainingBox: { x: 2110, y: 660, width: 92, height: 56 },
      headingBox: { x: 1695, y: 616, width: 245, height: 35 },
      costBox: { x: 2425, y: 664, width: 113, height: 44 },
    })
  })

  it('売り切れ: 「売り切れ」の枠があれば残り 0', () => {
    const boxes = DANGO_ROW.map((b) => (b.text === '1回' ? { ...b, text: '売り切れ', width: 205 } : b))
    expect(parseShopRows(boxes, IMAGE_HEIGHT).map((r) => [r.name, r.remaining])).toEqual([['月より団子', 0]])
  })

  it('日数と売り切れがつながって読める: 「8日売り切れ」は残り 0 で、その枠を残りの値の枠にする', () => {
    const rows = parseShopRows(COIN_ROW, IMAGE_HEIGHT)
    expect(rows.map((r) => [r.name, r.remaining])).toEqual([['サーヴァントコイン(宮本伊織)', 0]])
    expect(rows[0].remainingBox).toEqual({ x: 1879, y: 625, width: 318, height: 43 })
  })

  it('1字読み違えた「売り切れ」も残り 0', () => {
    const boxes = COIN_ROW.map((b) => (b.text === '8日売り切れ' ? { ...b, text: '8日売リ切れ' } : b))
    expect(parseShopRows(boxes, IMAGE_HEIGHT).map((r) => r.remaining)).toEqual([0])
  })

  it('「8日1回」とつながっても「回」の直前の数字を残りにする', () => {
    const boxes = DANGO_ROW.filter((b) => b.text !== '8日').map((b) =>
      b.text === '1回' ? { ...b, text: '8日1回', x: 1879, width: 323 } : b,
    )
    expect(parseShopRows(boxes, IMAGE_HEIGHT).map((r) => r.remaining)).toEqual([1])
  })

  it('品目の「所持 850」を対価にも残りにもしない', () => {
    const rows = parseShopRows(COIN_ROW, IMAGE_HEIGHT)
    expect(rows.map((r) => [r.remaining, r.cost])).toEqual([[0, 10]])
  })

  it('説明文を名前にしない: 名前が一覧の上に隠れた行は結果に出ない', () => {
    expect(parseShopRows(HIDDEN_NAME_ROW, IMAGE_HEIGHT)).toEqual([])
  })

  it('一覧の題が名前の範囲にあっても名前にしない', () => {
    // 題の左端を見出しにそろえても「交換報酬」を含む枠は名前にしない
    const boxes = HIDDEN_NAME_ROW.map((b) => (b.text.includes('交換報酬') ? { ...b, x: 1691 } : b))
    expect(parseShopRows(boxes, IMAGE_HEIGHT)).toEqual([])
  })

  it('所持数の欄の「残り」: 「交換期限 残り8日」からは行ができない', () => {
    expect(parseShopRows(OWNED_SECTION, IMAGE_HEIGHT)).toEqual([])
    // 「交換期間」と読み違えても、数字を含むので見出しにしない
    const misread = OWNED_SECTION.map((b) => (b.text.startsWith('交換期限') ? { ...b, text: '交換期間 残り8日' } : b))
    expect(parseShopRows(misread, IMAGE_HEIGHT)).toEqual([])
  })

  it('対価が読めない行: 名前と「売り切れ」が読めれば残り 0 として読む', () => {
    const boxes = COIN_ROW.filter((b) => b.text !== '10').map((b) =>
      b.text.startsWith('サーヴァントコイン(') ? { ...b, text: '叡智の業火', width: 284 } : b,
    )
    const rows = parseShopRows(boxes, IMAGE_HEIGHT)
    expect(rows.map((r) => [r.name, r.remaining, r.cost, r.costBox])).toEqual([['叡智の業火', 0, null, null]])
  })

  it('確からしさの低い数字は対価にしない', () => {
    const boxes = DANGO_ROW.map((b) => (b.text === '100' ? { ...b, confidence: 0.9 } : b))
    expect(parseShopRows(boxes, IMAGE_HEIGHT).map((r) => r.cost)).toEqual([null])
  })

  it('残りが読めない行: 真ん中の行の残りが読めなければ残りを null で出す', () => {
    const middle = DANGO_ROW.filter((b) => b.text !== '1回').map((b) => (b.text === '月より団子' ? { ...b, text: '伝承結晶' } : b))
    const rows = parseShopRows([...shift(COIN_ROW, -300), ...middle], IMAGE_HEIGHT)
    expect(rows.map((r) => [r.name, r.remaining, r.remainingBox])).toEqual([
      ['サーヴァントコイン(宮本伊織)', 0, expect.anything()],
      ['伝承結晶', null, null],
    ])
  })

  it('端で切れた行: 名前と見出しだけ写り、残りの段が画像の外なら結果に出さない', () => {
    const rows = parseShopRows([...DANGO_ROW, ...CUT_ROW], IMAGE_HEIGHT)
    expect(rows.map((r) => r.name)).toEqual(['月より団子'])
  })

  it('「交換期間あと残り」とつながった見出しでも行ができ、MENU に切られた名前をつなぐ', () => {
    // 同じ行を画像の上のほうに置き、値の段を足す
    const rows = parseShopRows(
      [...shift(CUT_ROW, -700), box('8日売り切れ', 1879, 1245 - 700 + 53, 318, 43)],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.name, r.remaining])).toEqual([['サーヴァントコイン(宮本', 0]])
  })

  it('行は上から順に並べる', () => {
    const rows = parseShopRows([...shift(DANGO_ROW, 300), ...shift(COIN_ROW, -300)], IMAGE_HEIGHT)
    expect(rows.map((r) => r.name)).toEqual(['サーヴァントコイン(宮本伊織)', '月より団子'])
    expect(rows[1].y).toBe(916 + 35 / 2)
  })

  it('文字が無ければ空', () => {
    expect(parseShopRows([], IMAGE_HEIGHT)).toEqual([])
  })
})

describe('readOwnedCounts', () => {
  it('アイコンで所持数を当てる前に、欄の 469・288・214 を上の段から左から読む', () => {
    const readings = readOwnedCounts(OWNED_SECTION)
    expect(readings.map((r) => r.value)).toEqual([469, 288, 214])
    expect(readings[0]).toEqual({ value: 469, box: { x: 638, y: 1031, width: 105, height: 57 }, headingHeight: 39 })
  })

  it('画面の上の帯の所持数は読まない', () => {
    expect(readOwnedCounts([...TOP_BAR, ...OWNED_SECTION]).map((r) => r.value)).toEqual([469, 288, 214])
  })

  it('アイコンを数字と読み違えた文字（確からしさの低い「02」「4」）は読まない', () => {
    const values = readOwnedCounts(OWNED_SECTION).map((r) => r.value)
    expect(values).not.toContain(2)
    expect(values).not.toContain(4)
  })

  it('一覧の品目の所持の数（右の 180）と「交換期限 残り8日」の日数は読まない', () => {
    const values = readOwnedCounts(OWNED_SECTION).map((r) => r.value)
    expect(values).not.toContain(180)
    expect(values).not.toContain(8)
  })

  it('見出しの上端から 8H より下の数は読まない', () => {
    const readings = readOwnedCounts([...OWNED_SECTION, box('100', 638, 944 + 39 * 8 + 1, 105, 57)])
    expect(readings.map((r) => r.value)).toEqual([469, 288, 214])
  })

  it('見出しが無ければ空', () => {
    expect(readOwnedCounts(OWNED_SECTION.filter((b) => !b.text.startsWith('獲得')))).toEqual([])
  })
})

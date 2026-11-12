import { describe, expect, it } from 'vitest'
import { parseShopRows, readOwnedCounts } from './rows'
import type { OcrBox } from './types'

const TEXT_HEIGHT = 30
const IMAGE_HEIGHT = 2000

const box = (text: string, x: number, y: number, width = 160, height = TEXT_HEIGHT): OcrBox => ({
  text,
  confidence: 0.9,
  x,
  y,
  width,
  height,
})

type RowSpec = {
  name?: string
  remaining?: string
  period?: boolean
  cost?: string
  possession?: string
}

/**
 * 交換所の画面の1行の文字。左に名前、その下の文字の行に「交換期間」と右の「残り N回」、さらに下の文字の行に
 * 左の「所持 N」と右の対価の数を置く。
 */
const shopRow = (top: number, spec: RowSpec): OcrBox[] => [
  ...(spec.name ? [box(spec.name, 200, top + 30, 300)] : []),
  ...(spec.period === false ? [] : [box('交換期間 11/20 12:59まで', 200, top + 80, 300)]),
  ...(spec.remaining ? [box(spec.remaining, 800, top + 80)] : []),
  ...(spec.possession ? [box(spec.possession, 200, top + 130)] : []),
  ...(spec.cost ? [box(spec.cost, 1000, top + 130, 40)] : []),
]

describe('parseShopRows', () => {
  it('残りを読む: 名前・残り・対価の数とその枠を読む', () => {
    const rows = parseShopRows(
      shopRow(400, { name: '叡智の業火', remaining: '残り 80回', cost: '5', possession: '所持 12' }),
      IMAGE_HEIGHT,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: '叡智の業火',
      remaining: 80,
      cost: 5,
      costBox: { x: 1000, y: 530, width: 40, height: TEXT_HEIGHT },
    })
    expect(rows[0].nameBox).toEqual({ x: 200, y: 430, width: 300, height: TEXT_HEIGHT })
  })

  it('売り切れ: 残りを 0 として読む', () => {
    const rows = parseShopRows(
      shopRow(400, { name: 'コード・リムーバー', remaining: '売り切れ', cost: '20' }),
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.name, r.remaining])).toEqual([['コード・リムーバー', 0]])
  })

  it('残りが読めない行: 真ん中の行の残りが読めなければ残りを null で出す', () => {
    const rows = parseShopRows(
      [
        ...shopRow(400, { name: '月より団子', remaining: '残り 1回', cost: '100' }),
        ...shopRow(600, { name: '伝承結晶', cost: '200' }),
        ...shopRow(800, { name: '巡霊の葉', remaining: '残り 25回', cost: '10' }),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.name, r.remaining, r.cost])).toEqual([
      ['月より団子', 1, 100],
      ['伝承結晶', null, 200],
      ['巡霊の葉', 25, 10],
    ])
  })

  it('端で切れた行: 一番下の行が名前だけ写り残りが画像の外なら結果に出さない', () => {
    const height = 1000
    const rows = parseShopRows(
      [
        ...shopRow(600, { name: '叡智の業火', remaining: '残り 80回', cost: '5' }),
        // 名前と「交換期間」だけ写り、「残り」と対価は画像の下で切れている
        box('コード・リムーバー', 200, height - 90, 300),
        box('交換期間 11/20 12:59まで', 200, height - 40, 300),
      ],
      height,
    )
    expect(rows.map((r) => r.name)).toEqual(['叡智の業火'])
  })

  it('端で切れた行: 名前だけ写った行（目印が無い）も出さない', () => {
    const height = 1000
    const rows = parseShopRows(
      [...shopRow(600, { name: '叡智の業火', remaining: '残り 80回', cost: '5' }), box('伝承結晶', 200, height - 35, 300)],
      height,
    )
    expect(rows.map((r) => r.name)).toEqual(['叡智の業火'])
  })

  it('端で切れた行: 上の端で名前が切れ残りだけ写った行は出さない', () => {
    const rows = parseShopRows(
      [
        box('交換期間 11/20 12:59まで', 200, 5, 300),
        box('残り 2回', 800, 5),
        ...shopRow(300, { name: '叡智の業火', remaining: '残り 80回', cost: '5' }),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => r.name)).toEqual(['叡智の業火'])
  })

  it('画像の端に近くても名前と残りの両方が読めた行は使う', () => {
    const height = 1000
    const rows = parseShopRows(
      [box('伝承結晶', 200, height - 95, 300), box('交換期間 11/20 12:59まで', 200, height - 45, 300), box('残り 2回', 800, height - 45)],
      height,
    )
    expect(rows.map((r) => [r.name, r.remaining])).toEqual([['伝承結晶', 2]])
  })

  it('名前の無い行は名前を空にして出す（あとで要確認になる）', () => {
    const rows = parseShopRows(shopRow(400, { remaining: '残り 3回', cost: '10' }), IMAGE_HEIGHT)
    expect(rows.map((r) => [r.name, r.remaining])).toEqual([['', 3]])
  })

  it('全角の数字・区切りのカンマ・「残り80回」の詰めた書き方を読む', () => {
    const rows = parseShopRows(
      [
        ...shopRow(400, { name: '叡智の業火', remaining: '残り８０回', cost: '５' }),
        ...shopRow(600, { name: '凶骨', remaining: '残り1,000回', cost: '1,200' }),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.name, r.remaining, r.cost])).toEqual([
      ['叡智の業火', 80, 5],
      ['凶骨', 1000, 1200],
    ])
  })

  it('「残り」と「80回」が別の枠に読まれても残りを読み、対価の数と取り違えない', () => {
    const rows = parseShopRows(
      [
        box('叡智の業火', 200, 430, 300),
        box('交換期間 11/20 12:59まで', 200, 480, 300),
        box('残り', 800, 480, 60),
        box('80', 870, 480, 40),
        box('5', 1000, 530, 40),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.remaining, r.cost])).toEqual([[80, 5]])
  })

  it('「所持」と数が別の枠に読まれても、その数を対価の数にしない', () => {
    const rows = parseShopRows(
      [
        ...shopRow(400, { name: '叡智の業火', remaining: '残り 80回' }),
        box('所持', 900, 530, 60),
        box('12', 970, 530, 40),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.remaining, r.cost])).toEqual([[80, null]])
  })

  it('名前と目印が同じ枠に読まれたときは名前を分けて読む', () => {
    const rows = parseShopRows([box('叡智の業火 残り80回', 200, 480, 600), box('5', 1000, 530, 40)], IMAGE_HEIGHT)
    expect(rows.map((r) => [r.name, r.remaining, r.cost])).toEqual([['叡智の業火', 80, 5]])
  })

  it('「交換期間」と「残り」が別の文字の行に写っても1つの行にまとめる', () => {
    const rows = parseShopRows(
      [
        box('伝承結晶', 200, 400, 300),
        box('残り 2回', 800, 400),
        box('交換期間 11/20 12:59まで', 200, 440, 300),
        box('200', 1000, 440, 60),
        box('巡霊の葉', 200, 600, 300),
        box('残り 25回', 800, 600),
        box('交換期間 11/20 12:59まで', 200, 640, 300),
        box('10', 1000, 640, 60),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.name, r.remaining, r.cost])).toEqual([
      ['伝承結晶', 2, 200],
      ['巡霊の葉', 25, 10],
    ])
  })

  it('目印から縦に離れすぎた名前は行に入れない', () => {
    const rows = parseShopRows(
      [box('叡智の業火', 200, 300, 300), box('交換期間 11/20 12:59まで', 200, 480, 300), box('残り 80回', 800, 480)],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => [r.name, r.remaining])).toEqual([['', 80]])
  })

  it('2つに分かれて読まれた名前をつなぐ', () => {
    const rows = parseShopRows(
      [
        box('英霊結晶・流星の', 200, 430, 240),
        box('フォウくん', 460, 430, 150),
        box('交換期間 11/20 12:59まで', 200, 480, 300),
        box('残り 1回', 800, 480),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => r.name)).toEqual(['英霊結晶・流星のフォウくん'])
  })

  it('行は上から順に並べ、行の縦の位置と帯を持つ', () => {
    const rows = parseShopRows(
      [
        ...shopRow(800, { name: '巡霊の葉', remaining: '残り 25回', cost: '10' }),
        ...shopRow(400, { name: '叡智の業火', remaining: '残り 80回', cost: '5' }),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => r.name)).toEqual(['叡智の業火', '巡霊の葉'])
    expect(rows[0].band).toEqual({ top: 430, bottom: 560 })
    expect(rows[0].y).toBe(495)
  })

  it('文字が無ければ空', () => {
    expect(parseShopRows([], IMAGE_HEIGHT)).toEqual([])
  })

  it('「獲得したイベントアイテム」の欄の数を交換所の行にしない', () => {
    const rows = parseShopRows(
      [
        box('獲得したイベントアイテム', 100, 100, 400),
        box('469', 160, 150, 60),
        box('288', 460, 150, 60),
        ...shopRow(400, { name: '叡智の業火', remaining: '残り 80回', cost: '5' }),
      ],
      IMAGE_HEIGHT,
    )
    expect(rows.map((r) => r.name)).toEqual(['叡智の業火'])
  })
})

describe('readOwnedCounts', () => {
  it('見出しの下の数を左から読む', () => {
    const readings = readOwnedCounts([
      box('獲得したイベントアイテム', 100, 100, 400),
      box('214', 760, 150, 60),
      box('469', 160, 150, 60),
      box('288', 460, 150, 60),
      ...shopRow(400, { name: '叡智の業火', remaining: '残り 80回', cost: '5' }),
    ])
    expect(readings.map((r) => r.value)).toEqual([469, 288, 214])
    expect(readings[0].box).toEqual({ x: 160, y: 150, width: 60, height: TEXT_HEIGHT })
  })

  it('見出しと同じ文字の行の右の数も読む', () => {
    const readings = readOwnedCounts([
      box('獲得したイベントアイテム', 100, 100, 400),
      box('×469', 600, 100, 80),
      box('1,288', 800, 100, 80),
    ])
    expect(readings.map((r) => r.value)).toEqual([469, 1288])
  })

  it('見出しから離れた交換所の行の対価の数は読まない', () => {
    const readings = readOwnedCounts([
      box('獲得したイベントアイテム', 100, 100, 400),
      box('469', 160, 150, 60),
      box('100', 1000, 260, 60),
    ])
    expect(readings.map((r) => r.value)).toEqual([469])
  })

  it('見出しが無ければ空', () => {
    expect(readOwnedCounts([box('469', 160, 150, 60)])).toEqual([])
  })
})

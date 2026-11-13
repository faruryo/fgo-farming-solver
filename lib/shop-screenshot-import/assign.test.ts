import { describe, expect, it, vi } from 'vitest'
import type { EventShopItem } from '../master-data/types'
import { assignOwnedCounts, assignShopRows, type OwnedSource, type RowSource } from './assign'
import type { IconDecision, OwnedReading, ShopScreenRow } from './types'

const UDON = 94162303 // 武蔵うどん
const MUSUBI = 94162302 // 江戸むすび
const KAKI = 94162301 // 東干し柿

const item = (name: string, costItemId: number, costAmount: number, limitNum: number): EventShopItem => ({
  itemId: 1,
  qty: 1,
  name,
  costItemId,
  costAmount,
  limitNum,
})

/** 80632 の交換所（ゲーム内の順）から、同じ名前の組と叡智の業火・10,000 QP を抜き出したもの */
const SHOP: EventShopItem[] = [
  item('サーヴァントコイン', UDON, 10, 16), // 0
  item('サーヴァントコイン', MUSUBI, 10, 16), // 1
  item('サーヴァントコイン', KAKI, 10, 16), // 2
  item('月より団子', UDON, 100, 2), // 3
  item('月より団子', MUSUBI, 100, 1), // 4
  item('月より団子', KAKI, 100, 1), // 5
  item('伝承結晶', UDON, 200, 2), // 6
  item('伝承結晶', MUSUBI, 200, 2), // 7
  item('伝承結晶', KAKI, 200, 1), // 8
  item('英霊結晶・流星のフォウくん', UDON, 150, 1), // 9
  item('英霊結晶・流星のフォウくん', KAKI, 150, 1), // 10
  item('英霊結晶・日輪のフォウくん', UDON, 150, 1), // 11
  item('英霊結晶・日輪のフォウくん', MUSUBI, 150, 1), // 12
  item('巡霊の葉', UDON, 10, 25), // 13
  item('巡霊の葉', MUSUBI, 10, 25), // 14
  item('巡霊の葉', KAKI, 10, 25), // 15
  item('コード・リムーバー', UDON, 20, 1), // 16
  item('コード・リムーバー', MUSUBI, 20, 1), // 17
  item('コード・リムーバー', KAKI, 20, 1), // 18
  item('叡智の業火', KAKI, 5, 100), // 19
  item('10,000 QP', UDON, 2, 0), // 20
]
const DANGO = { udon: 3, musubi: 4, kaki: 5 }
const LEAF = { udon: 13, musubi: 14, kaki: 15 }
const EICHI = 19

/** 画像の上から i 番目の行 */
const row = (i: number, name: string, remaining: number | null, cost: number | null): ShopScreenRow => ({
  name,
  nameBox: { x: 200, y: 100 + i * 200, width: 300, height: 30 },
  remaining,
  remainingBox: remaining === null ? null : { x: 700, y: 200 + i * 200, width: 90, height: 30 },
  headingBox: { x: 200, y: 160 + i * 200, width: 240, height: 30 },
  cost,
  costBox: cost === null ? null : { x: 1000, y: 200 + i * 200, width: 40, height: 30 },
  band: { top: 100 + i * 200, bottom: 230 + i * 200 },
  y: 165 + i * 200,
})

const matched = (costItemId: number): IconDecision => ({ kind: 'matched', costItemId, best: 10, second: 40 })

/** 行ごとに決めた照合の結果を返す。決めていない行は呼ばれてはいけない */
const icons = (decisions: Record<string, IconDecision>) =>
  vi.fn((source: RowSource, ...rest: [currencies: number[]]): IconDecision => {
    expect(rest[0].length).toBeGreaterThanOrEqual(2)
    const decision = decisions[`${source.imageIndex}:${source.rowIndex}`]
    if (!decision) throw new Error(`照合しない行です: ${source.imageIndex}:${source.rowIndex}`)
    return decision
  })

const noIcons = () => icons({})

describe('assignShopRows', () => {
  it('名前で1つに決まる: 叡智の業火の行は照合せずに叡智の業火に当てはまる', () => {
    const iconOf = noIcons()
    const results = assignShopRows([[row(0, '叡智の業火', 80, 5)]], SHOP, iconOf)
    expect(results).toEqual([
      { shopIndex: EICHI, candidates: [EICHI], values: [80], review: false, viaIcon: false, sources: [{ imageIndex: 0, rowIndex: 0 }] },
    ])
    expect(iconOf).not.toHaveBeenCalled()
  })

  it('アイコンで決まる: 月より団子の3行が上から武蔵うどん・江戸むすび・東干し柿に当てはまる', () => {
    const iconOf = icons({ '0:0': matched(UDON), '0:1': matched(MUSUBI), '0:2': matched(KAKI) })
    const results = assignShopRows(
      [[row(0, '月より団子', 2, 100), row(1, '月より団子', 1, 100), row(2, '月より団子', 1, 100)]],
      SHOP,
      iconOf,
    )
    expect(results.map((r) => [r.shopIndex, r.values, r.review, r.viaIcon, r.iconCurrency])).toEqual([
      [DANGO.udon, [2], false, true, UDON],
      [DANGO.musubi, [1], false, true, MUSUBI],
      [DANGO.kaki, [1], false, true, KAKI],
    ])
    expect(iconOf).toHaveBeenCalledWith({ imageIndex: 0, rowIndex: 0 }, [UDON, MUSUBI, KAKI])
  })

  it('1行だけでもアイコンで決まる: 巡霊の葉の1行が江戸むすびの巡霊の葉に当てはまる', () => {
    const results = assignShopRows([[row(0, '巡霊の葉', 25, 10)]], SHOP, icons({ '0:0': matched(MUSUBI) }))
    expect(results).toEqual([
      {
        shopIndex: LEAF.musubi,
        candidates: [LEAF.udon, LEAF.musubi, LEAF.kaki],
        values: [25],
        review: false,
        viaIcon: true,
        iconCurrency: MUSUBI,
        sources: [{ imageIndex: 0, rowIndex: 0 }],
      },
    ])
  })

  it('残りが在庫上限を超える: 江戸むすびの月より団子（上限 1）に残り 2 は要確認で、ほかの通貨にも当てない', () => {
    const results = assignShopRows([[row(0, '月より団子', 2, 100)]], SHOP, icons({ '0:0': matched(MUSUBI) }))
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ review: true, reason: 'exceeds-limit', values: [2], viaIcon: true })
    expect(results[0].shopIndex).toBeUndefined()
    expect(results[0].candidates).toEqual([DANGO.udon, DANGO.musubi, DANGO.kaki])
  })

  it('残りが在庫上限ちょうどなら当てはまる', () => {
    const results = assignShopRows([[row(0, '月より団子', 1, 100)]], SHOP, icons({ '0:0': matched(MUSUBI) }))
    expect(results[0]).toMatchObject({ shopIndex: DANGO.musubi, review: false })
  })

  it('アイコンの差が小さい: 照合が要確認なら行も要確認で、候補の品目を返す', () => {
    const results = assignShopRows([[row(0, '巡霊の葉', 25, 10)]], SHOP, icons({ '0:0': { kind: 'review' } }))
    expect(results).toEqual([
      {
        candidates: [LEAF.udon, LEAF.musubi, LEAF.kaki],
        values: [25],
        review: true,
        reason: 'icon-review',
        viaIcon: true,
        sources: [{ imageIndex: 0, rowIndex: 0 }],
      },
    ])
  })

  it('対価が読めなくてもアイコンで決まる: 伝承結晶の売り切れの行は、名前だけで絞ってアイコンで江戸むすびに当てはまる', () => {
    const iconOf = icons({ '0:0': matched(MUSUBI) })
    const results = assignShopRows([[row(0, '伝承結晶', 0, null)]], SHOP, iconOf)
    expect(results).toEqual([
      {
        shopIndex: 7,
        candidates: [6, 7, 8],
        values: [0],
        review: false,
        viaIcon: true,
        iconCurrency: MUSUBI,
        sources: [{ imageIndex: 0, rowIndex: 0 }],
      },
    ])
    expect(iconOf).toHaveBeenCalledWith({ imageIndex: 0, rowIndex: 0 }, [UDON, MUSUBI, KAKI])
  })

  it('売り切れの暗い行でもアイコンで決まる: サーヴァントコインの売り切れの行が武蔵うどんに当てはまる', () => {
    const results = assignShopRows([[row(0, 'サーヴァントコイン', 0, null)]], SHOP, icons({ '0:0': matched(UDON) }))
    expect(results.map((r) => [r.shopIndex, r.values, r.review, r.viaIcon])).toEqual([[0, [0], false, true]])
  })

  it('アイコンが隠れている: 英霊結晶・流星のフォウくんの行は照合が要確認なら要確認', () => {
    const results = assignShopRows(
      [[row(0, '英霊結晶・流星のフォウくん', 0, null)]],
      SHOP,
      icons({ '0:0': { kind: 'review' } }),
    )
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ review: true, reason: 'icon-review', values: [0], candidates: [9, 10] })
    expect(results[0].shopIndex).toBeUndefined()
  })

  it('アイコンを切り出せない: 切り出しが画像の外に出れば要確認', () => {
    const results = assignShopRows([[row(0, '伝承結晶', 1, 200)]], SHOP, icons({ '0:0': { kind: 'no-crop' } }))
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ review: true, reason: 'no-crop', values: [1], candidates: [6, 7, 8] })
    expect(results[0].shopIndex).toBeUndefined()
  })

  it('並びと食い違う: 上の行が東干し柿・下の行が武蔵うどんの月より団子なら、どちらも要確認', () => {
    const results = assignShopRows(
      [[row(0, '月より団子', 1, 100), row(1, '月より団子', 1, 100)]],
      SHOP,
      icons({ '0:0': matched(KAKI), '0:1': matched(UDON) }),
    )
    expect(results.map((r) => [r.shopIndex, r.review, r.reason])).toEqual([
      [undefined, true, 'order'],
      [undefined, true, 'order'],
    ])
  })

  it('並びと食い違っても、名前で決まった行は動かさない', () => {
    // 叡智の業火（19）の下に月より団子（3〜5）は来ないので、アイコンで当てた下の行だけ要確認
    const results = assignShopRows(
      [[row(0, '叡智の業火', 80, 5), row(1, '月より団子', 1, 100)]],
      SHOP,
      icons({ '0:1': matched(KAKI) }),
    )
    expect(results.map((r) => [r.shopIndex, r.review, r.reason])).toEqual([
      [undefined, true, 'order'],
      [EICHI, false, undefined],
    ])
  })

  it('並びの確かめで要確認にした行も、次の組の比べに使う', () => {
    // 上から 東(5)・武蔵(3)・江戸(4)。組 (5,3) で両方、組 (3,4) は順どおりなので3行目は当たる
    const results = assignShopRows(
      [[row(0, '月より団子', 1, 100), row(1, '月より団子', 1, 100), row(2, '月より団子', 1, 100)]],
      SHOP,
      icons({ '0:0': matched(KAKI), '0:1': matched(UDON), '0:2': matched(MUSUBI) }),
    )
    const bySource = (rowIndex: number) => results.find((r) => r.sources[0].rowIndex === rowIndex)
    expect(bySource(0)).toMatchObject({ review: true, reason: 'order' })
    expect(bySource(1)).toMatchObject({ review: true, reason: 'order' })
    expect(bySource(2)).toMatchObject({ shopIndex: DANGO.musubi, review: false })
  })

  it('並びは行の縦の位置で見る（渡された行の順によらない）', () => {
    const results = assignShopRows(
      [[row(1, '月より団子', 1, 100), row(0, '月より団子', 2, 100)]],
      SHOP,
      icons({ '0:0': matched(MUSUBI), '0:1': matched(UDON) }),
    )
    expect(results.map((r) => [r.shopIndex, r.review])).toEqual([
      [DANGO.udon, false],
      [DANGO.musubi, false],
    ])
  })

  it('同じ品目に2回当たる: 上の2行がどちらも武蔵うどんなら2行とも要確認、下の東干し柿の行は当たる', () => {
    const results = assignShopRows(
      [[row(0, '月より団子', 1, 100), row(1, '月より団子', 1, 100), row(2, '月より団子', 1, 100)]],
      SHOP,
      icons({ '0:0': matched(UDON), '0:1': matched(UDON), '0:2': matched(KAKI) }),
    )
    expect(results.map((r) => [r.shopIndex, r.review, r.sources[0].rowIndex])).toEqual([
      [undefined, true, 0],
      [undefined, true, 1],
      [DANGO.kaki, false, 2],
    ])
    expect(results.slice(0, 2).map((r) => r.reason)).toEqual(['duplicate', 'duplicate'])
  })

  it('名前で決まる行が1枚の画像で同じ品目に2回当たれば、どちらも要確認', () => {
    const results = assignShopRows([[row(0, '叡智の業火', 80, 5), row(1, '叡智の業火', 80, 5)]], SHOP, noIcons())
    expect(results.map((r) => [r.shopIndex, r.review, r.reason])).toEqual([
      [undefined, true, 'duplicate'],
      [undefined, true, 'duplicate'],
    ])
  })

  it('名前の近い品目が無い: 要確認で、どの品目にも当てない', () => {
    const iconOf = noIcons()
    const results = assignShopRows([[row(0, 'あいうえおかきくけこ', 3, 7)]], SHOP, iconOf)
    expect(results).toEqual([
      { candidates: [], values: [3], review: true, reason: 'no-name', viaIcon: false, sources: [{ imageIndex: 0, rowIndex: 0 }] },
    ])
    expect(iconOf).not.toHaveBeenCalled()
  })

  it('名前の読めない行は要確認', () => {
    const results = assignShopRows([[row(0, '', 3, 7)]], SHOP, noIcons())
    expect(results).toMatchObject([{ review: true, reason: 'no-name', candidates: [] }])
  })

  it('交換所データに名前が無ければ候補が無く要確認', () => {
    const shop = [{ ...item('叡智の業火', KAKI, 5, 100), name: undefined }]
    const results = assignShopRows([[row(0, '叡智の業火', 80, 5)]], shop, noIcons())
    expect(results).toMatchObject([{ review: true, reason: 'no-name', candidates: [] }])
  })

  it('上限の無い品目の行: 10,000 QP の行は残りが読めたかによらず結果に出ない', () => {
    const results = assignShopRows(
      [[row(0, '10,000 QP', null, 2), row(1, '10,000QP', 5, 2)]],
      SHOP,
      noIcons(),
    )
    expect(results).toEqual([])
  })

  it('上限の無い品目と同じ名前: 上限の無い品目を候補から除き、上限のある品目に当てはまる', () => {
    const C = 1
    const D = 2
    const shop = [item('品目X', C, 10, 0), item('品目X', D, 10, 5)]
    const iconOf = noIcons()
    const results = assignShopRows([[row(0, '品目X', 3, 10)]], shop, iconOf)
    expect(results).toMatchObject([{ shopIndex: 1, candidates: [1], values: [3], review: false, viaIcon: false }])
    expect(iconOf).not.toHaveBeenCalled()
  })

  it('候補の通貨が1種で候補が2つ以上なら照合せずに要確認', () => {
    const shop = [item('品目X', KAKI, 10, 5), item('品目X', KAKI, 10, 3)]
    const iconOf = noIcons()
    const results = assignShopRows([[row(0, '品目X', 3, 10)]], shop, iconOf)
    expect(results).toMatchObject([{ review: true, reason: 'ambiguous', candidates: [0, 1] }])
    expect(iconOf).not.toHaveBeenCalled()
  })

  it('照合で決めた通貨の候補が2つ以上なら要確認', () => {
    const shop = [item('品目X', KAKI, 10, 5), item('品目X', KAKI, 10, 3), item('品目X', UDON, 10, 3)]
    const results = assignShopRows([[row(0, '品目X', 3, 10)]], shop, icons({ '0:0': matched(KAKI) }))
    expect(results).toMatchObject([{ review: true, reason: 'ambiguous', viaIcon: true, iconCurrency: KAKI }])
  })

  it('照合の候補には、その行の候補の品目の通貨だけを渡す', () => {
    const iconOf = icons({ '0:0': matched(KAKI) })
    assignShopRows([[row(0, '英霊結晶・流星のフォウくん', 1, 150)]], SHOP, iconOf)
    expect(iconOf).toHaveBeenCalledWith({ imageIndex: 0, rowIndex: 0 }, [UDON, KAKI])
  })

  it('名前の似た品目は、読めた対価の数で絞る', () => {
    const shop = [item('術の秘石', KAKI, 3, 10), item('術の魔石', KAKI, 6, 10)]
    const results = assignShopRows([[row(0, '術の魔石', 4, 3)]], shop, noIcons())
    expect(results).toMatchObject([{ shopIndex: 0, review: false }])
  })

  it('対価の数で絞ると候補が無くなるときは、名前だけで絞る', () => {
    const results = assignShopRows([[row(0, '叡智の業火', 80, 50)]], SHOP, noIcons())
    expect(results).toMatchObject([{ shopIndex: EICHI, review: false }])
  })

  it('名前の後ろに個数が付いて読まれても当てはまる', () => {
    const results = assignShopRows([[row(0, '巡霊の葉×10', 25, 10)]], SHOP, icons({ '0:0': matched(UDON) }))
    expect(results).toMatchObject([{ shopIndex: LEAF.udon, review: false }])
  })

  it('品目が決まって残りが読めない行は、品目を決めたまま要確認', () => {
    const results = assignShopRows([[row(0, '伝承結晶', null, 200)]], SHOP, icons({ '0:0': matched(MUSUBI) }))
    expect(results).toEqual([
      {
        shopIndex: 7,
        candidates: [6, 7, 8],
        values: [],
        review: true,
        reason: 'no-remaining',
        viaIcon: true,
        iconCurrency: MUSUBI,
        sources: [{ imageIndex: 0, rowIndex: 0 }],
      },
    ])
  })

  it('残りが読めない行も、別の画像で同じ品目の残りが読めればその値でまとめる', () => {
    const results = assignShopRows(
      [[row(0, '伝承結晶', null, 200)], [row(3, '伝承結晶', 2, 200)]],
      SHOP,
      icons({ '0:0': matched(MUSUBI), '1:0': matched(MUSUBI) }),
    )
    expect(results).toMatchObject([{ shopIndex: 7, values: [2], review: false }])
    expect(results[0].sources).toHaveLength(2)
  })

  it('照合の要る行の候補にアイコンを読み込めなかった通貨があれば要確認で、名前で決まる叡智の業火は当たる', () => {
    // 東干し柿のアイコンを読み込めなかったとき、東干し柿が候補に入る行の照合は「要確認」を返す
    const iconOf = icons({ '0:0': { kind: 'review' } })
    const results = assignShopRows([[row(0, '月より団子', 1, 100), row(1, '叡智の業火', 80, 5)]], SHOP, iconOf)
    expect(results.map((r) => [r.shopIndex, r.review, r.reason])).toEqual([
      [undefined, true, 'icon-review'],
      [EICHI, false, undefined],
    ])
    expect(iconOf).toHaveBeenCalledTimes(1)
  })

  it('結果は交換所の順に並べる', () => {
    const results = assignShopRows(
      [[row(0, '叡智の業火', 80, 5)], [row(0, '巡霊の葉', 25, 10)]],
      SHOP,
      icons({ '1:0': matched(KAKI) }),
    )
    expect(results.map((r) => r.shopIndex)).toEqual([LEAF.kaki, EICHI])
  })

  describe('複数の画像で同じ品目に当たる行', () => {
    it('重なって写った行: 1枚目の一番下と2枚目の一番上の叡智の業火・残り 80 を1つにまとめる', () => {
      const results = assignShopRows(
        [
          [row(0, '巡霊の葉', 25, 10), row(4, '叡智の業火', 80, 5)],
          [row(0, '叡智の業火', 80, 5), row(1, 'コード・リムーバー', 0, 20)],
        ],
        SHOP,
        icons({ '0:0': matched(KAKI), '1:1': matched(UDON) }),
      )
      const eichi = results.filter((r) => r.shopIndex === EICHI)
      expect(eichi).toEqual([
        {
          shopIndex: EICHI,
          candidates: [EICHI],
          values: [80],
          review: false,
          viaIcon: false,
          sources: [
            { imageIndex: 0, rowIndex: 1 },
            { imageIndex: 1, rowIndex: 0 },
          ],
        },
      ])
      expect(results).toHaveLength(3)
    })

    it('値が食い違う: 80 と 60 なら要確認で、品目を決めたまま両方の値を返す', () => {
      const results = assignShopRows([[row(0, '叡智の業火', 80, 5)], [row(2, '叡智の業火', 60, 5)]], SHOP, noIcons())
      expect(results).toEqual([
        {
          shopIndex: EICHI,
          candidates: [EICHI],
          values: [80, 60],
          review: true,
          reason: 'conflict',
          viaIcon: false,
          sources: [
            { imageIndex: 0, rowIndex: 0 },
            { imageIndex: 1, rowIndex: 0 },
          ],
        },
      ])
    })

    it('画像の並べ方を変えても同じ品目に当たる', () => {
      const images = [[row(0, '月より団子', 2, 100)], [row(0, '叡智の業火', 80, 5)]]
      const forward = assignShopRows(images, SHOP, icons({ '0:0': matched(UDON) }))
      const reversed = assignShopRows([...images].reverse(), SHOP, icons({ '1:0': matched(UDON) }))
      expect(reversed.map((r) => [r.shopIndex, r.values])).toEqual(forward.map((r) => [r.shopIndex, r.values]))
    })
  })
})

describe('assignOwnedCounts', () => {
  const readings = (...values: number[]): OwnedReading[] =>
    values.map((value, i) => ({ value, box: { x: 100 + i * 300, y: 150, width: 60, height: 30 }, headingHeight: 39 }))

  const currencies = (decisions: Record<string, IconDecision>) =>
    vi.fn((source: OwnedSource): IconDecision => decisions[`${source.imageIndex}:${source.index}`] ?? { kind: 'review' })

  it('アイコンで所持数を当てる: 上の段の 469・288 と下の段の 214 を東干し柿・江戸むすび・武蔵うどんに当てる', () => {
    const results = assignOwnedCounts(
      [readings(469, 288, 214)],
      currencies({ '0:0': matched(KAKI), '0:1': matched(MUSUBI), '0:2': matched(UDON) }),
    )
    expect(results).toEqual([
      { costItemId: KAKI, values: [469], review: false, sources: [{ imageIndex: 0, index: 0 }] },
      { costItemId: MUSUBI, values: [288], review: false, sources: [{ imageIndex: 0, index: 1 }] },
      { costItemId: UDON, values: [214], review: false, sources: [{ imageIndex: 0, index: 2 }] },
    ])
  })

  it('所持数のアイコンの差が小さい: 288 は要確認', () => {
    const results = assignOwnedCounts(
      [readings(469, 288, 214)],
      currencies({ '0:0': matched(KAKI), '0:1': { kind: 'review' }, '0:2': matched(UDON) }),
    )
    expect(results).toEqual([
      { costItemId: KAKI, values: [469], review: false, sources: [{ imageIndex: 0, index: 0 }] },
      { values: [288], review: true, sources: [{ imageIndex: 0, index: 1 }] },
      { costItemId: UDON, values: [214], review: false, sources: [{ imageIndex: 0, index: 2 }] },
    ])
  })

  it('2つの数が同じ通貨に当たる: 469 と 288 がどちらも東干し柿なら、どちらも要確認', () => {
    const results = assignOwnedCounts(
      [readings(469, 288, 214)],
      currencies({ '0:0': matched(KAKI), '0:1': matched(KAKI), '0:2': matched(UDON) }),
    )
    expect(results).toEqual([
      { values: [469], review: true, sources: [{ imageIndex: 0, index: 0 }] },
      { values: [288], review: true, sources: [{ imageIndex: 0, index: 1 }] },
      { costItemId: UDON, values: [214], review: false, sources: [{ imageIndex: 0, index: 2 }] },
    ])
  })

  it('複数の画像で同じ所持数を読む: 5枚とも東干し柿に 469 なら1つにまとめ、要確認にしない', () => {
    const images = Array.from({ length: 5 }, () => readings(469))
    const decisions = Object.fromEntries(images.map((_, i) => [`${i}:0`, matched(KAKI)]))
    const results = assignOwnedCounts(images, currencies(decisions))
    expect(results).toEqual([
      { costItemId: KAKI, values: [469], review: false, sources: images.map((_, i) => ({ imageIndex: i, index: 0 })) },
    ])
  })

  it('画像によって所持数が違う: 469 と 459 なら東干し柿を要確認にして両方の値を返す', () => {
    const results = assignOwnedCounts(
      [readings(469), readings(459)],
      currencies({ '0:0': matched(KAKI), '1:0': matched(KAKI) }),
    )
    expect(results).toEqual([
      {
        costItemId: KAKI,
        values: [469, 459],
        review: true,
        sources: [
          { imageIndex: 0, index: 0 },
          { imageIndex: 1, index: 0 },
        ],
      },
    ])
  })

  it('アイコンを読み込めなかったとき（照合がすべて要確認）は、すべての数が要確認', () => {
    const results = assignOwnedCounts([readings(469, 288, 214)], currencies({}))
    expect(results.map((r) => [r.costItemId, r.review])).toEqual([
      [undefined, true],
      [undefined, true],
      [undefined, true],
    ])
  })

  it('数が無ければ空', () => {
    expect(assignOwnedCounts([[], []], currencies({}))).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import type { EventFarmingNode, EventPlannerEvent, EventRewards, EventShopItem } from './master-data/types'
import {
  attachBonusRarities,
  buildEventRewardsRows,
  compactDrops,
  compactMissions,
  compactPointRewards,
  compactShop,
  decideBonusRarities,
  decideEventImport,
  findPointItemId,
  tryCompact,
} from './refresh-event-data-compact'
import type {
  AtlasEquip,
  AtlasMission,
  AtlasPointReward,
  AtlasShopItem,
  ItemMap,
  SvtMap,
} from './refresh-event-data-compact'

const itemMap: ItemMap = new Map([
  [100, { name: '素材A', icon: 'a.png', type: 'skillLvUp' }],
  [102, { name: '赤銅の果実', icon: 'fruit.png', type: 'qp' }],
  [94001, { name: '武蔵うどん', icon: 'udon.png', type: 'eventItem' }],
  [94160904, { name: 'パンプキン収穫ポイント', icon: 'pt.png', type: 'eventPoint' }],
  [94160905, { name: '別のポイント', icon: 'pt2.png', type: 'eventPoint' }],
])

const atlasShop = (costItemId: number, targetIds = [100]): AtlasShopItem => ({
  purchaseType: 'item',
  payType: 'eventItem',
  targetIds,
  setNum: 2,
  limitNum: 5,
  cost: { item: { id: costItemId }, amount: 30 },
})

const shopItem = (costItemId: number): EventShopItem => ({
  itemId: 100,
  qty: 1,
  costItemId,
  costAmount: 10,
  limitNum: 5,
})

describe('compactShop', () => {
  it('対価の通貨が itemMap にあれば表示名とアイコンを入れる', () => {
    expect(compactShop([atlasShop(94001)], itemMap)).toEqual([
      {
        itemId: 100,
        qty: 2,
        costItemId: 94001,
        costAmount: 30,
        limitNum: 5,
        name: '素材A',
        icon: 'a.png',
        costName: '武蔵うどん',
        costIcon: 'udon.png',
      },
    ])
  })

  it('対価の通貨が itemMap に無ければ通貨の表示名・アイコンを入れない', () => {
    const [entry] = compactShop([atlasShop(99999)], itemMap)
    expect(entry).not.toHaveProperty('costName')
    expect(entry).not.toHaveProperty('costIcon')
    expect(entry?.costItemId).toBe(99999)
  })
})

// nice_event 80632 の交換所の形: 種火・フォウくん・同じ礼装が3つの通貨で在庫上限 2・1・1
const svtMap: SvtMap = new Map([
  [9770500, { name: '叡智の大火', rarity: 5, face: 'https://example.com/f_97705000.png' }],
  [9700300, { name: '星のフォウくん', rarity: 3, face: 'https://example.com/f_97003000.png' }],
  [9306300, { name: '月より団子', rarity: 5, face: 'https://example.com/f_93063000.png' }],
])

const svtShop = (
  targetId: number,
  costItemId: number,
  limitNum: number,
  name: string,
  purchaseType = 'servant',
): AtlasShopItem => ({
  purchaseType,
  payType: 'eventItem',
  targetIds: [targetId],
  setNum: 1,
  limitNum,
  name,
  cost: { item: { id: costItemId }, amount: 100 },
  gifts: [],
})

const atlasShop80632: AtlasShopItem[] = [
  svtShop(9306300, 94001, 2, '月より団子'),
  svtShop(9306300, 94002, 1, '月より団子'),
  svtShop(9306300, 94003, 1, '月より団子'),
  svtShop(9770500, 94001, 100, '叡智の大火'),
  svtShop(9700300, 94002, 40, '星のフォウくん'),
  svtShop(8400990, 94001, 1, 'コマンドコード', 'commandCode'),
  svtShop(9939270, 94001, 1, '霊衣開放権', 'costumeRelease'),
  atlasShop(94002),
]

describe('compactShop（サーヴァント扱いの交換）', () => {
  it('種火・フォウくん・礼装を kind=svt・名前・レア度・アイコン・個数・対価・在庫上限とともに出す', () => {
    const shop = compactShop(atlasShop80632, itemMap, svtMap)
    expect(shop.filter(s => s.kind === 'svt' && s.itemId !== 9306300)).toEqual([
      {
        itemId: 9770500,
        kind: 'svt',
        qty: 1,
        costItemId: 94001,
        costAmount: 100,
        limitNum: 100,
        name: '叡智の大火',
        rarity: 5,
        icon: 'https://example.com/f_97705000.png',
        costName: '武蔵うどん',
        costIcon: 'udon.png',
      },
      {
        itemId: 9700300,
        kind: 'svt',
        qty: 1,
        costItemId: 94002,
        costAmount: 100,
        limitNum: 40,
        name: '星のフォウくん',
        rarity: 3,
        icon: 'https://example.com/f_97003000.png',
      },
    ])
  })

  it('同じ礼装の3つの交換は通貨と在庫上限の違う3つの品目になる', () => {
    const shop = compactShop(atlasShop80632, itemMap, svtMap)
    const ces = shop.filter(s => s.itemId === 9306300)
    expect(ces.map(s => [s.kind, s.costItemId, s.limitNum, s.name, s.rarity, s.icon])).toEqual([
      ['svt', 94001, 2, '月より団子', 5, 'https://example.com/f_93063000.png'],
      ['svt', 94002, 1, '月より団子', 5, 'https://example.com/f_93063000.png'],
      ['svt', 94003, 1, '月より団子', 5, 'https://example.com/f_93063000.png'],
    ])
  })

  it('コマンドコードと霊衣開放権の交換は出さない', () => {
    const ids = compactShop(atlasShop80632, itemMap, svtMap).map(s => s.itemId)
    expect(ids).not.toContain(8400990)
    expect(ids).not.toContain(9939270)
    expect(ids).toHaveLength(6)
  })

  it('対応表に無い番号は見出しを名前にし、アイコンとレア度を付けない', () => {
    const [entry] = compactShop([svtShop(9999999, 94001, 1, '見出しの名前')], itemMap, svtMap)
    expect(entry).toMatchObject({ itemId: 9999999, kind: 'svt', name: '見出しの名前' })
    expect(entry).not.toHaveProperty('icon')
    expect(entry).not.toHaveProperty('rarity')
  })

  it('対応表を渡さないときも見出しを名前にし、アイコンとレア度を付けない', () => {
    const shop = compactShop(atlasShop80632, itemMap)
    const fire = shop.find(s => s.itemId === 9770500)
    expect(fire).toMatchObject({ kind: 'svt', name: '叡智の大火', limitNum: 100 })
    expect(fire).not.toHaveProperty('icon')
    expect(fire).not.toHaveProperty('rarity')
  })

  it('アイテムの品目は今までどおり出て kind を持たない', () => {
    const shop = compactShop(atlasShop80632, itemMap, svtMap)
    const item = shop.find(s => s.itemId === 100)
    expect(item).toEqual({
      itemId: 100,
      qty: 2,
      costItemId: 94002,
      costAmount: 30,
      limitNum: 5,
      name: '素材A',
      icon: 'a.png',
    })
    expect(item).not.toHaveProperty('kind')
  })
})

describe('decideEventImport', () => {
  it('ロトあり: ロト型として取り込む', () => {
    expect(decideEventImport(1, 1, [shopItem(94001)], itemMap)).toEqual({ kind: 'lottery' })
  })

  it('ロト無し・交換所あり: 最初のエントリーの対価の通貨と空のロトで取り込む', () => {
    expect(decideEventImport(0, 0, [shopItem(94001), shopItem(100)], itemMap)).toEqual({
      kind: 'shop',
      currency: { id: 94001, name: '武蔵うどん', icon: 'udon.png' },
      unlimitedBoxes: false,
      lotteries: [],
    })
  })

  it('ロト無し・交換所あり・通貨が itemMap に無い: 名前とアイコンは空文字', () => {
    expect(decideEventImport(0, 0, [shopItem(99999)], itemMap)).toMatchObject({
      kind: 'shop',
      currency: { id: 99999, name: '', icon: '' },
    })
  })

  it('最初が礼装でその後にアイテムの交換があるとき、通貨はアイテムの交換の対価', () => {
    const shop = compactShop([svtShop(9306300, 94001, 2, '月より団子'), atlasShop(94160904)], itemMap, svtMap)
    expect(decideEventImport(0, 0, shop, itemMap)).toMatchObject({
      kind: 'shop',
      currency: { id: 94160904, name: 'パンプキン収穫ポイント', icon: 'pt.png' },
    })
  })

  it('サーヴァント扱いの交換だけの交換所は shop として取り込み、通貨はその最初の対価', () => {
    const shop = compactShop(
      [svtShop(9770500, 94001, 100, '叡智の大火'), svtShop(9700300, 94160904, 40, '星のフォウくん')],
      itemMap,
      svtMap,
    )
    expect(decideEventImport(0, 0, shop, itemMap)).toEqual({
      kind: 'shop',
      currency: { id: 94001, name: '武蔵うどん', icon: 'udon.png' },
      unlimitedBoxes: false,
      lotteries: [],
    })
  })

  it('ロトも交換所も無し: スキップ', () => {
    expect(decideEventImport(0, 0, [], itemMap).kind).toBe('skip')
  })

  it('ロトの検証が全滅: 交換所があってもスキップ', () => {
    expect(decideEventImport(2, 0, [shopItem(94001)], itemMap).kind).toBe('skip')
  })
})

// nice_event 80627 rewards の形（groupId は 0）
const atlasRewards: AtlasPointReward[] = [
  { groupId: 0, point: 5000, gifts: [{ type: 'servant', objectId: 9939270, num: 1 }] },
  { groupId: 0, point: 1000, gifts: [{ type: 'item', objectId: 102, num: 1 }] },
  { groupId: 0, point: 3000, gifts: [{ type: 'commandCode', objectId: 8400990, num: 1 }, { type: 'item', objectId: 99999, num: 2 }] },
]

// nice_event 80632 missions の形
const atlasMissions: AtlasMission[] = [
  {
    id: 8063206,
    dispNo: 6,
    type: 'event',
    name: '特定のクエストを3回クリアせよ',
    gifts: [{ type: 'item', objectId: 100, num: 3 }],
    conds: [
      { missionProgressType: 'open', condType: 'date', targetIds: [], targetNum: 1791968400 },
      {
        missionProgressType: 'clear',
        condType: 'missionConditionDetail',
        targetIds: [80632001],
        targetNum: 3,
        details: [{ missionCondType: 10, targetIds: [94162800, 94162801, 94162802] }],
      },
    ],
  },
  {
    id: 8063201,
    dispNo: 1,
    type: 'event',
    name: 'イベントのクエストを1回クリアせよ',
    gifts: [{ type: 'servant', objectId: 9939280, num: 1 }],
    conds: [
      { missionProgressType: 'start', condType: 'date', targetIds: [], targetNum: 1791968400 },
      { missionProgressType: 'clear', condType: 'eventMissionClear', targetIds: [8063200], targetNum: 1 },
    ],
  },
]

describe('compactPointRewards', () => {
  it('累計ポイントの昇順に並べ、アイテムには名前とアイコンを付け、アイテム以外は種類だけを持つ', () => {
    expect(compactPointRewards(atlasRewards, itemMap)).toEqual([
      { point: 1000, gifts: [{ objType: 'item', itemId: 102, num: 1, name: '赤銅の果実', icon: 'fruit.png' }] },
      {
        point: 3000,
        gifts: [
          { objType: 'commandCode', itemId: 8400990, num: 1 },
          { objType: 'item', itemId: 99999, num: 2, name: '' },
        ],
      },
      { point: 5000, gifts: [{ objType: 'servant', itemId: 9939270, num: 1 }] },
    ])
  })
})

describe('compactMissions', () => {
  it('dispNo の順に並べ、clear の条件だけを残し、details の種類と対象 ID を持つ', () => {
    expect(compactMissions(atlasMissions, itemMap)).toEqual([
      {
        id: 8063201,
        dispNo: 1,
        type: 'event',
        name: 'イベントのクエストを1回クリアせよ',
        gifts: [{ objType: 'servant', itemId: 9939280, num: 1 }],
        conds: [{ condType: 'eventMissionClear', targetIds: [8063200], targetNum: 1 }],
      },
      {
        id: 8063206,
        dispNo: 6,
        type: 'event',
        name: '特定のクエストを3回クリアせよ',
        gifts: [{ objType: 'item', itemId: 100, num: 3, name: '素材A', icon: 'a.png' }],
        conds: [
          {
            condType: 'missionConditionDetail',
            targetIds: [80632001],
            targetNum: 3,
            details: [{ missionCondType: 10, targetIds: [94162800, 94162801, 94162802] }],
          },
        ],
      },
    ])
  })
})

describe('findPointItemId', () => {
  const node = (drops: EventFarmingNode['drops']): EventFarmingNode => ({ questId: 1, name: 'q', ap: 40, drops })

  it('種類が eventPoint の品目が1つならその ID', () => {
    expect(findPointItemId([node([{ itemId: 100, perRun: 3 }, { itemId: 94160904, perRun: 650 }])], itemMap)).toBe(94160904)
  })

  it('複数あれば1周あたりの見込みの合計が最大のもの', () => {
    const nodes = [
      node([{ itemId: 94160904, perRun: 300 }, { itemId: 94160905, perRun: 500 }]),
      node([{ itemId: 94160904, perRun: 300 }]),
    ]
    expect(findPointItemId(nodes, itemMap)).toBe(94160904)
  })

  it('合計が同じなら ID の小さいもの', () => {
    const nodes = [node([{ itemId: 94160905, perRun: 500 }, { itemId: 94160904, perRun: 500 }])]
    expect(findPointItemId(nodes, itemMap)).toBe(94160904)
  })

  it('無ければ undefined', () => {
    expect(findPointItemId([node([{ itemId: 100, perRun: 3 }])], itemMap)).toBeUndefined()
    expect(findPointItemId([], itemMap)).toBeUndefined()
  })
})

describe('tryCompact', () => {
  it('整形できれば結果を返す（空配列も空のまま）', () => {
    expect(tryCompact(atlasRewards, r => compactPointRewards(r, itemMap))).toHaveLength(3)
    expect(tryCompact([] as AtlasMission[], m => compactMissions(m, itemMap))).toEqual([])
  })

  it('整形が例外を投げる入力なら undefined', () => {
    const broken = [{ id: 1, dispNo: 1, type: 'event', name: 'x', gifts: null }] as unknown as AtlasMission[]
    expect(tryCompact(broken, m => compactMissions(m, itemMap))).toBeUndefined()
  })

  it('入力のフィールドが無ければ undefined', () => {
    const event: { missions?: AtlasMission[] } = {}
    expect(tryCompact(event.missions, m => compactMissions(m, itemMap))).toBeUndefined()
  })
})

describe('buildEventRewardsRows', () => {
  it('取れたイベントだけを event_rewards:<id> の行にし、取れなかったイベントは入れない', () => {
    const rows = buildEventRewardsRows(
      [
        { eventId: 80627, pointRewards: compactPointRewards(atlasRewards, itemMap), missions: [], pointItemId: 94160904 },
        { eventId: 80632, pointRewards: [], missions: compactMissions(atlasMissions, itemMap), pointItemId: undefined },
        { eventId: 80700, pointRewards: [], missions: undefined, pointItemId: undefined },
        { eventId: 80701, pointRewards: undefined, missions: [], pointItemId: undefined },
      ],
      1792000000,
    )
    expect(rows.map(r => r.key)).toEqual(['event_rewards:80627', 'event_rewards:80632'])

    const v80627 = JSON.parse(rows[0].value) as EventRewards
    expect(v80627.pointRewards).toHaveLength(3)
    expect(v80627.missions).toEqual([])
    expect(v80627.pointItemId).toBe(94160904)
    expect(v80627.updatedAt).toBe(1792000000)

    const v80632 = JSON.parse(rows[1].value) as EventRewards
    expect(v80632.missions).toHaveLength(2)
    expect(v80632).not.toHaveProperty('pointItemId')
  })
})

describe('compactDrops', () => {
  it('perRun は dropCount / runs × num、countPerRun は dropCount / runs になる', () => {
    expect(compactDrops([{ objectId: 94001, num: 3, runs: 100, dropCount: 500 }], itemMap)).toEqual([
      { itemId: 94001, perRun: 15, countPerRun: 5, name: '武蔵うどん', icon: 'udon.png' },
    ])
  })

  it('4桁に丸める', () => {
    expect(compactDrops([{ objectId: 100, num: 2, runs: 3, dropCount: 1 }], itemMap)).toMatchObject([
      { perRun: 0.6667, countPerRun: 0.3333 },
    ])
  })

  it('runs 0 のドロップと期待値がほぼ 0 のドロップを除く', () => {
    expect(
      compactDrops(
        [
          { objectId: 100, num: 1, runs: 0, dropCount: 0 },
          { objectId: 102, num: 1, runs: 100000, dropCount: 1 },
          { objectId: 94001, num: 1, runs: 10, dropCount: 10 },
        ],
        itemMap,
      ).map(d => d.itemId),
    ).toEqual([94001])
  })

  it('itemMap に無い品目は名前を空にしアイコンを付けない', () => {
    expect(compactDrops([{ objectId: 999, num: 1, runs: 1, dropCount: 1 }], itemMap)).toEqual([
      { itemId: 999, perRun: 1, countPerRun: 1, name: '' },
    ])
  })
})

// ── ボーナス礼装の ☆ と通貨の対応 ─────────────────────────────────────

const EVENT_ID = 80614
const GOLD = 94100001
const SILVER = 94100002
const BRONZE = 94100003
const MORI_A = 94100004
const MORI_B = 94100005
const MORI_C = 94100006
const POINT = 94100007
const OTHER_ITEM = 94100008

const bonusItemMap: ItemMap = new Map([
  [GOLD, { name: '金', icon: 'g.png', type: 'eventItem', individuality: [1001] }],
  [SILVER, { name: '銀', icon: 's.png', type: 'eventItem', individuality: [1002] }],
  [BRONZE, { name: '銅', icon: 'b.png', type: 'eventItem', individuality: [1003] }],
  [MORI_A, { name: '盛りA', icon: 'ma.png', type: 'eventItem', individuality: [1004] }],
  [MORI_B, { name: '盛りB', icon: 'mb.png', type: 'eventItem', individuality: [1005] }],
  [MORI_C, { name: '盛りC', icon: 'mc.png', type: 'eventItem', individuality: [1006] }],
  [POINT, { name: 'ポイント', icon: 'p.png', type: 'eventPoint', individuality: [1007] }],
  [OTHER_ITEM, { name: '交換所に無いアイテム', icon: 'o.png', type: 'eventItem', individuality: [1008] }],
])

const bonusShop = (currencies: number[]): EventShopItem[] =>
  currencies.map(c => ({ itemId: 100, qty: 1, costItemId: c, costAmount: 10, limitNum: 5 }))

/** 無凸（condLimitCount 0）と凸（4）の2つのスキルを持つ礼装。 */
const equip = (
  id: number,
  rarity: number,
  individualities: number[],
  { funcType = 'eventDropUp', eventId = EVENT_ID }: { funcType?: string; eventId?: number } = {},
): AtlasEquip => ({
  id,
  name: `礼装${id}`,
  rarity,
  skills: [0, 4].map(condLimitCount => ({
    condLimitCount,
    functions: individualities.map(ind => ({
      funcType,
      svals: [{ EventId: eventId, Individuality: ind, AddCount: condLimitCount === 0 ? 1 : 2 }],
    })),
  })),
})

/** 指定のイベントの eventDropUp スキル（cond ごとの AddCount）。 */
const dropUpSkills = (eventId: number, individuality: number, adds: [cond: number, add: number][]) =>
  adds.map(([condLimitCount, add]) => ({
    condLimitCount,
    functions: [{ funcType: 'eventDropUp', svals: [{ EventId: eventId, Individuality: individuality, AddCount: add }] }],
  }))

const BONUS = { base: 1, max: 2 }
const ces = (...ids: number[]) => ids.map(id => ({ id, name: `礼装${id}` }))

const goldSilverBronze: AtlasEquip[] = [
  equip(1, 5, [1001]),
  equip(2, 5, [1001]),
  equip(3, 4, [1002]),
  equip(4, 4, [1002]),
  equip(5, 3, [1003]),
  equip(6, 3, [1003]),
]

const allCurrencies = [GOLD, SILVER, BRONZE, MORI_A, MORI_B, MORI_C]

describe('decideBonusRarities', () => {
  it('☆5/☆4/☆3 が金/銀/銅だけを対象にするとき、3つの対応が出る（凸と無凸は1つに数える）', () => {
    expect(decideBonusRarities(goldSilverBronze, EVENT_ID, bonusShop(allCurrencies), bonusItemMap)).toEqual([
      { rarity: 5, itemId: GOLD, craftEssences: ces(1, 2), bonus: BONUS },
      { rarity: 4, itemId: SILVER, craftEssences: ces(3, 4), bonus: BONUS },
      { rarity: 3, itemId: BRONZE, craftEssences: ces(5, 6), bonus: BONUS },
    ])
  })

  it('☆5 の礼装が別の3種類の通貨を同時に対象にしても ☆5 と金は残り、3種類は対応しない', () => {
    const equips = [...goldSilverBronze, equip(7, 5, [1004, 1005, 1006])]
    expect(decideBonusRarities(equips, EVENT_ID, bonusShop(allCurrencies), bonusItemMap)).toEqual([
      { rarity: 5, itemId: GOLD, craftEssences: ces(1, 2), bonus: BONUS },
      { rarity: 4, itemId: SILVER, craftEssences: ces(3, 4), bonus: BONUS },
      { rarity: 3, itemId: BRONZE, craftEssences: ces(5, 6), bonus: BONUS },
    ])
  })

  it('☆5 の単一対象の礼装が別々の2つの通貨に効くとき、☆5 は対応しない', () => {
    const equips = [...goldSilverBronze, equip(7, 5, [1004])]
    expect(decideBonusRarities(equips, EVENT_ID, bonusShop(allCurrencies), bonusItemMap)).toEqual([
      { rarity: 4, itemId: SILVER, craftEssences: ces(3, 4), bonus: BONUS },
      { rarity: 3, itemId: BRONZE, craftEssences: ces(5, 6), bonus: BONUS },
    ])
  })

  it('eventPointUp の礼装とイベントポイントは対応しない', () => {
    const equips = [...goldSilverBronze, equip(7, 5, [1007], { funcType: 'eventPointUp' })]
    expect(
      decideBonusRarities(equips, EVENT_ID, bonusShop([...allCurrencies, POINT]), bonusItemMap),
    ).toEqual([
      { rarity: 5, itemId: GOLD, craftEssences: ces(1, 2), bonus: BONUS },
      { rarity: 4, itemId: SILVER, craftEssences: ces(3, 4), bonus: BONUS },
      { rarity: 3, itemId: BRONZE, craftEssences: ces(5, 6), bonus: BONUS },
    ])
  })

  it('別のイベントの EventId を持つ効果は数えない', () => {
    const equips = [...goldSilverBronze, equip(7, 5, [1004], { eventId: 80627 })]
    expect(decideBonusRarities(equips, EVENT_ID, bonusShop(allCurrencies), bonusItemMap)).toEqual([
      { rarity: 5, itemId: GOLD, craftEssences: ces(1, 2), bonus: BONUS },
      { rarity: 4, itemId: SILVER, craftEssences: ces(3, 4), bonus: BONUS },
      { rarity: 3, itemId: BRONZE, craftEssences: ces(5, 6), bonus: BONUS },
    ])
  })

  it('☆5 の礼装が交換所の通貨でないアイテム1つだけを対象にしても、☆5 と金の対応は残る', () => {
    const equips = [...goldSilverBronze, equip(7, 5, [1008])]
    expect(decideBonusRarities(equips, EVENT_ID, bonusShop(allCurrencies), bonusItemMap)).toEqual([
      { rarity: 5, itemId: GOLD, craftEssences: ces(1, 2), bonus: BONUS },
      { rarity: 4, itemId: SILVER, craftEssences: ces(3, 4), bonus: BONUS },
      { rarity: 3, itemId: BRONZE, craftEssences: ces(5, 6), bonus: BONUS },
    ])
  })

  it('name と face を持つ礼装を入力順に載せ、同じ礼装の別イベントの AddCount は無視して bonus を出す', () => {
    const other = dropUpSkills(80457, 1001, [[0, 5], [4, 9]])
    const own = dropUpSkills(EVENT_ID, 1001, [[0, 1], [4, 2]])
    const ce: AtlasEquip = {
      id: 9407560,
      name: '二天一流の女',
      rarity: 5,
      // 別イベントのスキルが先に並んでいても拾わない
      skills: [...other, ...own],
      extraAssets: { faces: { equip: { '9407560': 'https://example.com/f_94075600.png' } } },
    }
    expect(decideBonusRarities([ce], EVENT_ID, bonusShop(allCurrencies), bonusItemMap)).toEqual([
      {
        rarity: 5,
        itemId: GOLD,
        craftEssences: [{ id: 9407560, name: '二天一流の女', face: 'https://example.com/f_94075600.png' }],
        bonus: { base: 1, max: 2 },
      },
    ])
  })

  it('同じ ☆ の礼装で AddCount が違うと bonus を省き、礼装は両方載せる', () => {
    const diff: AtlasEquip = { id: 2, name: '礼装2', rarity: 5, skills: dropUpSkills(EVENT_ID, 1001, [[0, 1], [4, 3]]) }
    const [entry] = decideBonusRarities([equip(1, 5, [1001]), diff], EVENT_ID, bonusShop(allCurrencies), bonusItemMap)
    expect(entry.craftEssences).toEqual(ces(1, 2))
    expect(entry).not.toHaveProperty('bonus')
  })

  it('凸のスキルが無い礼装があると bonus を省く', () => {
    const noMax: AtlasEquip = { id: 1, name: '礼装1', rarity: 5, skills: dropUpSkills(EVENT_ID, 1001, [[0, 1]]) }
    const [entry] = decideBonusRarities([noMax], EVENT_ID, bonusShop(allCurrencies), bonusItemMap)
    expect(entry).toMatchObject({ rarity: 5, itemId: GOLD, craftEssences: ces(1) })
    expect(entry).not.toHaveProperty('bonus')
  })

  it('face が無ければ face のキーを持たない', () => {
    const [entry] = decideBonusRarities([equip(1, 5, [1001])], EVENT_ID, bonusShop(allCurrencies), bonusItemMap)
    expect(entry.craftEssences[0]).not.toHaveProperty('face')
  })

  it('礼装が1つも無いイベントでは空の配列になる', () => {
    expect(decideBonusRarities([], EVENT_ID, bonusShop(allCurrencies), bonusItemMap)).toEqual([])
  })
})

describe('attachBonusRarities', () => {
  const node: EventFarmingNode = {
    questId: 1,
    name: 'q',
    ap: 40,
    drops: [{ itemId: GOLD, perRun: 10, countPerRun: 5, name: '金' }],
  }
  const shopEvent = (overrides: Partial<EventPlannerEvent> = {}): EventPlannerEvent => ({
    id: EVENT_ID,
    name: 'イベント',
    type: 'eventQuest',
    startedAt: 1,
    endedAt: 2,
    currency: { id: GOLD, name: '金', icon: 'g.png' },
    unlimitedBoxes: false,
    lotteries: [],
    shop: bonusShop([GOLD, SILVER, BRONZE]),
    farmingNodes: [node],
    ...overrides,
  })

  it('礼装のデータがあれば対応を付ける', () => {
    expect(attachBonusRarities(shopEvent(), goldSilverBronze, bonusItemMap, []).bonusRarities).toEqual([
      { rarity: 5, itemId: GOLD, craftEssences: ces(1, 2), bonus: BONUS },
      { rarity: 4, itemId: SILVER, craftEssences: ces(3, 4), bonus: BONUS },
      { rarity: 3, itemId: BRONZE, craftEssences: ces(5, 6), bonus: BONUS },
    ])
  })

  it('礼装のデータが無く前の対応も無いとき、項目を付けず交換所とドロップはそのまま取り込む', () => {
    const event = shopEvent()
    const result = attachBonusRarities(event, undefined, bonusItemMap, [shopEvent({ shop: [], farmingNodes: [] })])
    expect(result).not.toHaveProperty('bonusRarities')
    expect(result.shop).toEqual(event.shop)
    expect(result.farmingNodes).toEqual(event.farmingNodes)
  })

  it('礼装のデータが無く前の対応があるとき、対応を残し交換所とドロップは新しい値になる', () => {
    const previous = shopEvent({
      shop: bonusShop([GOLD]),
      farmingNodes: [],
      bonusRarities: [{ rarity: 5, itemId: GOLD, craftEssences: [] }],
    })
    const event = shopEvent()
    const result = attachBonusRarities(event, undefined, bonusItemMap, [previous])
    expect(result.bonusRarities).toEqual([{ rarity: 5, itemId: GOLD, craftEssences: [] }])
    expect(result.shop).toEqual(event.shop)
    expect(result.farmingNodes).toEqual(event.farmingNodes)
  })
})

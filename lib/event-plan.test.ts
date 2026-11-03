/**
 * lib/event-plan.test.ts
 *
 * Task 14 — 単体テスト（vitest）。
 * mocks/events.json（イベント 80586、11 箱、農場ノード 5 本）を使用する。
 */

import { describe, it, expect } from 'vitest'
import type { EventPlannerEvent, EventShopItem } from './master-data/types'
import type { ChaldeaState } from '../hooks/create-chaldea-state'
import type { MaterialsForServants } from './get-materials'
import {
  calcBoxLayer,
  allocateShop,
  buildEventDrops,
  runEventSolver,
  reverseCalcBoxes,
  computeTotalNeed,
  computeShortfall,
  computeRosterImpact,
  planShopCurrencies,
  splitUnfarmable,
  applyDropBonus,
  compareBonusCraftEssences,
  selectBonusCraftEssenceRow,
  type BonusCraftEssenceRow,
  type BonusRarityInput,
} from './event-plan'
import eventsJson from '../mocks/events.json'

// ─────────────────────────────────────────────────────────────────────────────
// テストフィクスチャ
// ─────────────────────────────────────────────────────────────────────────────

// mocks/events.json からイベント 80586 を取得
const mockEvent = (eventsJson as { events: EventPlannerEvent[] }).events[0]

/** 最終物資補給戦 Ⅲ（AP40、ドロップあり）*/
const nodeWithDrops = mockEvent.farmingNodes.find((n) => n.drops.length > 0)!

// ─────────────────────────────────────────────────────────────────────────────
// Task 9 — calcBoxLayer
// ─────────────────────────────────────────────────────────────────────────────

describe('calcBoxLayer', () => {
  it('0 箱: 通貨ゼロ、報酬ゼロ', () => {
    const result = calcBoxLayer(mockEvent, 0)
    expect(result.totalCurrencyNeeded).toBe(0)
    expect(result.remainingCurrency).toBe(0)
    expect(result.confirmedMaterials.size).toBe(0)
    expect(result.rareNonMaterials).toHaveLength(0)
  })

  it('1 箱: costPerBox=600、所持通貨差し引き', () => {
    const result = calcBoxLayer(mockEvent, 1, 200)
    expect(result.totalCurrencyNeeded).toBe(600)
    expect(result.remainingCurrency).toBe(400)
  })

  it('所持通貨が totalCurrencyNeeded を超えると remainingCurrency=0', () => {
    const result = calcBoxLayer(mockEvent, 1, 1000)
    expect(result.remainingCurrency).toBe(0)
  })

  it('11 箱: 総コスト = 600×11 = 6600', () => {
    const result = calcBoxLayer(mockEvent, 11)
    expect(result.totalCurrencyNeeded).toBe(6600)
    expect(result.remainingCurrency).toBe(6600)
  })

  it('確定素材が累積加算される（boxIndex 0-2 の 3 箱）', () => {
    // boxIndex 0 の contents に itemId=3(鎖の結晶) num=75 が含まれる
    const r3 = calcBoxLayer(mockEvent, 3)
    // 3 箱 × 75 = 225
    expect(r3.confirmedMaterials.get(3)).toBe(225)
  })

  it('boxIndex 6 の rareReward(servant) は rareNonMaterials に入り素材には含まれない', () => {
    // boxIndex 6: rareRewards=[{ itemId: 9570500, objType: "servant" }]
    const result = calcBoxLayer(mockEvent, 7) // 0〜6 の 7 箱
    expect(result.rareNonMaterials.some((r) => r.objType === 'servant')).toBe(true)
    // servant の itemId は confirmedMaterials に含まれない
    expect(result.confirmedMaterials.has(9570500)).toBe(false)
  })

  it('boxIndex 0 の rareReward(item) は素材として confirmedMaterials に入る', () => {
    // boxIndex 0: rareRewards=[{ itemId: 2000, objType: "item" }]
    const result = calcBoxLayer(mockEvent, 1)
    expect(result.confirmedMaterials.has(2000)).toBe(true)
    expect(result.confirmedMaterials.get(2000)).toBe(1)
    expect(result.rareNonMaterials.some((r) => r.itemId === 2000)).toBe(false)
  })

  it('unlimitedBoxes: 箱種類数(11)を超えた分は最終箱を繰り返す', () => {
    // mockEvent は unlimitedBoxes=true・11箱・各 costPerBox=600
    const result = calcBoxLayer(mockEvent, 15)
    // 15 箱ぶん回せる: 600 × 15 = 9000
    expect(result.totalCurrencyNeeded).toBe(9000)
  })

  it('limited(unlimitedBoxes=false): 箱種類数(11)で頭打ち', () => {
    const limited = { ...mockEvent, unlimitedBoxes: false }
    const result = calcBoxLayer(limited, 15)
    // 11 箱で打ち切り: 600 × 11 = 6600
    expect(result.totalCurrencyNeeded).toBe(6600)
  })

  it('openedBoxes: 既開封分はコストから除外し残り箱だけ計算', () => {
    // 目標30箱・既に10箱開封済み → 残り20箱ぶんだけ必要
    const result = calcBoxLayer(mockEvent, 30, 0, 10)
    expect(result.totalCurrencyNeeded).toBe(20 * 600) // 12000
    expect(result.boxesToOpen).toBe(20)
  })

  it('openedBoxes が目標以上なら必要通貨・残り箱は 0', () => {
    const result = calcBoxLayer(mockEvent, 5, 0, 8)
    expect(result.totalCurrencyNeeded).toBe(0)
    expect(result.boxesToOpen).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 10 — allocateShop（limitNum 上限と overflow 警告）
// ─────────────────────────────────────────────────────────────────────────────

describe('allocateShop', () => {
  // mocks/events.json のイベント 80586 は shop=[] なのでインライン fixtures を使う
  const shopItems = [
    { itemId: 6001, qty: 5, costItemId: 94151101, costAmount: 100, limitNum: 20 },
    { itemId: 6101, qty: 3, costItemId: 94151101, costAmount: 200, limitNum: 10 },
  ]

  it('需要 0 のアイテムは allocated=0', () => {
    const result = allocateShop(shopItems, new Map())
    expect(result.allocations.every((a) => a.allocated === 0)).toBe(true)
    expect(result.totalCurrencyUsed).toBe(0)
    expect(result.hasOverflow).toBe(false)
  })

  it('limitNum 以内の需要は正確に配分される', () => {
    const demand = new Map([[6001, 15]])
    const result = allocateShop(shopItems, demand)
    const a = result.allocations.find((x) => x.shopItem.itemId === 6001)!
    // 15 個欲しい / 1回5個 = ceil(15/5)=3 回購入 → 15 個
    expect(a.allocated).toBe(3)
    expect(a.totalQty).toBe(15)
    expect(a.cappedByLimit).toBe(false)
    expect(result.totalCurrencyUsed).toBe(3 * 100)
  })

  it('limitNum を超える需要は limitNum でキャップ + overflow 警告', () => {
    // limitNum=20 → 最大 100 個（20回×5個）。110 個要求 → ceil(110/5)=22回 > 20
    const demand = new Map([[6001, 110]])
    const result = allocateShop(shopItems, demand)
    const a = result.allocations.find((x) => x.shopItem.itemId === 6001)!
    expect(a.allocated).toBe(20) // limitNum でキャップ
    expect(a.cappedByLimit).toBe(true)
    // overflow = (22-20)*5=10 個
    expect(a.overflow).toBe(10)
    expect(result.hasOverflow).toBe(true)
  })

  it('通貨コスト合計が正確に計算される', () => {
    const demand = new Map([
      [6001, 10],   // ceil(10/5)=2回 × 100 = 200
      [6101, 9],    // ceil(9/3)=3回 × 200 = 600
    ])
    const result = allocateShop(shopItems, demand)
    expect(result.totalCurrencyUsed).toBe(200 + 600)
  })
})

describe('サーヴァント扱いの交換所の品目（kind=svt）', () => {
  // 9305420 は礼装とイベントアイテムで番号が同じ
  const svtItem: EventShopItem = {
    itemId: 9305420, kind: 'svt', qty: 1, costItemId: 94151101, costAmount: 50, limitNum: 2, name: '完璧なお正月',
  }
  const item: EventShopItem = {
    itemId: 9305420, qty: 1, costItemId: 94151101, costAmount: 10, limitNum: 10, name: 'お正月のアイテム',
  }

  it('需要のある素材と同じ番号でも交換に選ばれず、アイテムの品目に配分される', () => {
    const result = allocateShop([svtItem, item], new Map([[9305420, 3]]))
    expect(result.allocations.map((a) => a.shopItem)).toEqual([item])
    expect(result.allocations[0]?.allocated).toBe(3)
    expect(result.totalCurrencyUsed).toBe(30)
  })

  it('名前の対応表はアイテムの名前のまま', () => {
    const event: EventPlannerEvent = { ...mockEvent, shop: [item, svtItem] }
    const { drops } = buildEventDrops(event, 0, new Map([[9305420, 1]]))
    expect(drops.items.find((i) => i.id === '9305420')?.name).toBe('お正月のアイテム')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 11 — ソルバーアダプタ
// ─────────────────────────────────────────────────────────────────────────────

describe('buildEventDrops', () => {
  it('ドロップありノードのみ quests に含まれる', () => {
    const { drops } = buildEventDrops(mockEvent, 1000)
    // farmingNodes のうちドロップありは "最終物資補給戦 Ⅲ" だけ
    expect(drops.quests).toHaveLength(1)
    expect(drops.quests[0].name).toBe('最終物資補給戦 Ⅲ')
  })

  it('イベント通貨が items に含まれる（Atlas ID 文字列キー）', () => {
    const { drops } = buildEventDrops(mockEvent, 500)
    const currencyId = String(mockEvent.currency.id) // '94151101'
    expect(drops.items.some((i) => i.id === currencyId)).toBe(true)
  })

  it('params.items にイベント通貨需要が設定される', () => {
    const { params } = buildEventDrops(mockEvent, 1234)
    expect(params.items[String(mockEvent.currency.id)]).toBe(1234)
  })

  it('campaigns は空配列（恒常データと混合しない）', () => {
    const { drops } = buildEventDrops(mockEvent, 100)
    expect(drops.campaigns).toHaveLength(0)
  })

  it('通貨以外のアイテム名もイベントデータから解決される（item_ ハードコードしない）', () => {
    // contents の素材を直接需要に指定 → solver items に登場する
    const sample = mockEvent.lotteries[0].contents.find((c) => c.name)
    expect(sample).toBeDefined()
    const { drops } = buildEventDrops(mockEvent, 0, new Map([[sample!.itemId, 1]]))
    const item = drops.items.find((i) => i.id === String(sample!.itemId))
    expect(item).toBeDefined()
    expect(item!.name).toBe(sample!.name)
    expect(item!.name.startsWith('item_')).toBe(false)
  })

  it('ID は短縮 ID ではなく Atlas 数値 ID の文字列', () => {
    const { drops } = buildEventDrops(mockEvent, 100)
    // イベント通貨 ID = 94151101 → '94151101'（6桁以下の短縮 ID にはならない）
    const currencyItem = drops.items.find((i) => i.id === '94151101')
    expect(currencyItem).toBeDefined()
    // drop_rates も同じ ID 空間
    const currencyDrop = drops.drop_rates.find((dr) => dr.item_id === '94151101')
    expect(currencyDrop).toBeDefined()
    expect(currencyDrop!.drop_rate).toBeGreaterThan(40) // ≈44.85/周
  })
})

describe('runEventSolver', () => {
  it('ドロップありノードを使ってソルバーが実行される（実装可能解）', () => {
    // 最終物資補給戦 Ⅲ: 通貨≈44.85/周。600 通貨（1 箱）には ceil(600/44.85)=14 周程度
    const { result, dropSource } = runEventSolver(mockEvent, 600)
    expect(dropSource).toBe('atlas')
    expect(result.total_lap).toBeGreaterThan(0)
    expect(result.total_ap).toBeGreaterThan(0)
    // 結果クエストは "最終物資補給戦 Ⅲ" のみ（唯一のドロップありノード）
    expect(result.quests).toHaveLength(1)
    expect(result.quests[0].id).toBe(String(nodeWithDrops.questId))
  })

  it('ドロップなしイベントは dropSource=none、空の result を返す', () => {
    const noDropEvent: EventPlannerEvent = {
      ...mockEvent,
      farmingNodes: mockEvent.farmingNodes.map((n) => ({ ...n, drops: [] })),
    }
    const { result, dropSource } = runEventSolver(noDropEvent, 100)
    expect(dropSource).toBe('none')
    // ドロップなし → ソルバーは実行不能（クエストなし） → total_lap=0
    expect(result.total_lap).toBe(0)
  })

  it('currencyDemand=0 はスキップされ total_lap=0', () => {
    const { result } = runEventSolver(mockEvent, 0)
    expect(result.total_lap).toBe(0)
  })

  it('lap モードでもソルバーが動く', () => {
    const { result } = runEventSolver(mockEvent, 600, new Map(), 'lap')
    expect(result.total_lap).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 12 — reverseCalcBoxes
// ─────────────────────────────────────────────────────────────────────────────

describe('reverseCalcBoxes', () => {
  it('需要 0 なら minBoxes=0', () => {
    const { minBoxes } = reverseCalcBoxes(mockEvent, new Map())
    expect(minBoxes).toBe(0)
  })

  it('ボックス報酬だけで充足できる場合の最小箱数', () => {
    // itemId=3(鎖の結晶) は 1 箱あたり 75 個。150 個 = 2 箱
    const demand = new Map([[3, 150]])
    const { minBoxes, boxLayer } = reverseCalcBoxes(mockEvent, demand)
    expect(minBoxes).toBe(2)
    expect(boxLayer.confirmedMaterials.get(3)).toBeGreaterThanOrEqual(150)
  })

  it('全箱でも需要を満たせない場合は maxBoxes を返す', () => {
    // itemId=99999（存在しないアイテム）は報酬にも交換所にもない
    const demand = new Map([[99999, 1]])
    const { minBoxes, residualDemand } = reverseCalcBoxes(mockEvent, demand)
    expect(minBoxes).toBe(mockEvent.lotteries.length)
    expect(residualDemand.get(99999)).toBe(1) // 残需要として残る
  })

  it('交換所で limitNum 超過した場合、残余需要が residualDemand に入る', () => {
    // shop=[] の mockEvent では交換所は何もしない → ボックス報酬以外はすべて residual
    // ボックスで供給できないケースを作る（itemId を存在しないものに）
    const shop2: EventPlannerEvent = {
      ...mockEvent,
      lotteries: mockEvent.lotteries.map((b) => ({
        ...b,
        contents: b.contents.filter((c) => c.itemId !== 98765),
        rareRewards: [],
      })),
      shop: [
        {
          itemId: 98765,
          qty: 1,
          costItemId: mockEvent.currency.id,
          costAmount: 50,
          limitNum: 5,
        },
      ],
    }
    const demand = new Map([[98765, 10]])
    const { shopAllocation, residualDemand } = reverseCalcBoxes(shop2, demand)
    const shopA = shopAllocation.allocations.find((a) => a.shopItem.itemId === 98765)!
    expect(shopA.cappedByLimit).toBe(true)
    expect(shopA.allocated).toBe(5) // limitNum=5
    expect(residualDemand.get(98765)).toBe(5) // 残り5個はフリクエ等で
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 13 — computeRosterImpact
// ─────────────────────────────────────────────────────────────────────────────

/**
 * テスト用のシンプルな ChaldeaState・MaterialsForServants を構築する。
 * サーヴァント ID 1 のみ。ascension ステップ 0→1 で item 6001 × 10 個必要。
 */
const buildTestChaldea = (): {
  chaldeaState: ChaldeaState
  materialsForServants: MaterialsForServants
} => {
  const chaldeaState: ChaldeaState = {
    '1': {
      disabled: false,
      targets: {
        ascension: { disabled: false, ranges: [{ start: 0, end: 1 }] },
        skill: { disabled: true, ranges: [{ start: 1, end: 1 }] },
        appendSkill: { disabled: true, ranges: [{ start: 0, end: 0 }] },
      },
    },
  }

  const materialsForServants: MaterialsForServants = {
    '1': {
      ascensionMaterials: {
        '0': {
          items: [{ item: { id: 6001 }, amount: 10 }],
          qp: 100000,
        },
      },
      skillMaterials: {},
      appendSkillMaterials: {},
    },
  }

  return { chaldeaState, materialsForServants }
}

describe('computeTotalNeed', () => {
  it('素材と QP（atlasId=1）を所持数を引かずに集計する', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    const need = computeTotalNeed(chaldeaState, materialsForServants)
    expect(need.get(6001)).toBe(10)
    expect(need.get(1)).toBe(100000)
  })

  it('disabled サーヴァントは除外される', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    chaldeaState['1'].disabled = true
    expect(computeTotalNeed(chaldeaState, materialsForServants).size).toBe(0)
  })

  it('disabled ターゲットは除外される', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    chaldeaState['1'].targets.ascension.disabled = true
    expect(computeTotalNeed(chaldeaState, materialsForServants).size).toBe(0)
  })

  it("'all' キーは除外される", () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    chaldeaState['all'] = chaldeaState['1']
    materialsForServants['all'] = materialsForServants['1']
    const need = computeTotalNeed(chaldeaState, materialsForServants)
    expect(need.get(6001)).toBe(10)
  })
})

describe('computeShortfall', () => {
  it('必要素材から所持数を差し引いた不足を返す', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    const possession = { '6001': 3 }
    const shortfall = computeShortfall(chaldeaState, materialsForServants, possession)
    expect(shortfall.get(6001)).toBe(7) // 10 - 3 = 7
    expect(shortfall.get(1)).toBe(100000) // QP 不足 (所持なし)
  })

  it('所持が need 以上ならその素材は shortfall に含まれない', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    const possession = { '6001': 10, '1': 200000 }
    const shortfall = computeShortfall(chaldeaState, materialsForServants, possession)
    expect(shortfall.has(6001)).toBe(false)
    expect(shortfall.has(1)).toBe(false)
  })

  it('disabled サーヴァントはスキップされる', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    chaldeaState['1'].disabled = true
    const shortfall = computeShortfall(chaldeaState, materialsForServants, {})
    expect(shortfall.size).toBe(0)
  })
})

describe('computeRosterImpact', () => {
  it('ボックス報酬が不足を充当する（coverage 計算）', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    const possession = { '6001': 0 }

    // 5 箱: 6001 は 2個/箱 → 合計 10個。shortfall=10 → coverage=10
    const boxLayer = calcBoxLayer(mockEvent, 5, 0)
    const shopAllocation = allocateShop(mockEvent.shop, new Map())

    const impact = computeRosterImpact(
      chaldeaState,
      materialsForServants,
      possession,
      boxLayer,
      shopAllocation,
    )

    // 6001 は 5 箱 × 2 = 10個。shortfall=10 → coverage=10, residual=0
    expect(impact.shortfall.get(6001)).toBe(10)
    expect(impact.coverage.get(6001)).toBe(10)
    expect(impact.residualShortfall.has(6001)).toBe(false)
  })

  it('coverageRate は総充当 / 総不足', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    const possession = {}

    // 0 箱: ボックス報酬なし → coverage=0, coverageRate=0
    const boxLayer = calcBoxLayer(mockEvent, 0)
    const shopAllocation = allocateShop(mockEvent.shop, new Map())

    const impact = computeRosterImpact(
      chaldeaState,
      materialsForServants,
      possession,
      boxLayer,
      shopAllocation,
    )

    expect(impact.coverageRate).toBe(0)
  })

  it('不足ゼロなら coverageRate=1.0', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    // 全素材所持済み
    const possession = { '6001': 100, '1': 9999999 }

    const boxLayer = calcBoxLayer(mockEvent, 0)
    const shopAllocation = allocateShop(mockEvent.shop, new Map())

    const impact = computeRosterImpact(
      chaldeaState,
      materialsForServants,
      possession,
      boxLayer,
      shopAllocation,
    )

    expect(impact.shortfall.size).toBe(0)
    expect(impact.coverageRate).toBe(1.0)
  })

  it('solverDemand は residualShortfall と同一オブジェクト', () => {
    const { chaldeaState, materialsForServants } = buildTestChaldea()
    const possession = {}
    const boxLayer = calcBoxLayer(mockEvent, 0)
    const shopAllocation = allocateShop(mockEvent.shop, new Map())

    const impact = computeRosterImpact(
      chaldeaState,
      materialsForServants,
      possession,
      boxLayer,
      shopAllocation,
    )

    expect(impact.solverDemand).toBe(impact.residualShortfall)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 交換所の通貨の周回計画
// ─────────────────────────────────────────────────────────────────────────────

describe('planShopCurrencies', () => {
  const A = 9001
  const B = 9002
  const C = 9003
  const D = 9004
  const shopEvent: EventPlannerEvent = {
    ...mockEvent,
    id: 99999,
    lotteries: [],
    shop: [],
    farmingNodes: [
      {
        questId: 1,
        name: '3種',
        ap: 40,
        drops: [
          { itemId: A, perRun: 10 },
          { itemId: B, perRun: 10 },
          { itemId: C, perRun: 10 },
        ],
      },
      { questId: 2, name: 'A', ap: 40, drops: [{ itemId: A, perRun: 15 }] },
      { questId: 3, name: 'B', ap: 40, drops: [{ itemId: B, perRun: 15 }] },
      { questId: 4, name: 'C', ap: 40, drops: [{ itemId: C, perRun: 15 }] },
    ],
  }
  const need = new Map([
    [A, 300],
    [B, 300],
    [C, 300],
  ])

  const planned = (event: EventPlannerEvent, demand: Map<number, number>) => {
    const plan = planShopCurrencies(event, demand)
    if (plan.status !== 'planned') throw new Error(`unexpected status ${plan.status}`)
    return plan
  }
  const plannedResult = (event: EventPlannerEvent, demand: Map<number, number>) => {
    const { result } = planned(event, demand)
    if (!result) throw new Error('no farming plan')
    return result
  }

  it('3種類の通貨の必要量を1つの LP で同時に満たす', () => {
    expect(planned(shopEvent, need).unfarmable).toEqual([])
    const result = plannedResult(shopEvent, need)
    for (const [id, qty] of need) {
      const got = result.items.find((i) => i.id === String(id))?.count ?? 0
      expect(got).toBeGreaterThanOrEqual(qty)
    }
    expect(result.quests.map((q) => q.id)).toEqual(['1'])
    expect(result.total_lap).toBe(30)
    expect(result.total_ap).toBe(1200)
  })

  it('通貨ごとに別々に解いて足すより合計 AP が小さい', () => {
    const joint = plannedResult(shopEvent, need).total_ap
    const separate = [...need].reduce(
      (acc, [id, qty]) => acc + plannedResult(shopEvent, new Map([[id, qty]])).total_ap,
      0,
    )
    expect(joint).toBeLessThan(separate)
  })

  it('必要量が無ければ計算しない', () => {
    expect(planShopCurrencies(shopEvent, new Map([[A, 0]]))).toEqual({ status: 'none' })
    expect(planShopCurrencies(shopEvent, new Map())).toEqual({ status: 'none' })
  })

  it('ドロップの統計が無いときは計算しない', () => {
    const noDrops: EventPlannerEvent = {
      ...shopEvent,
      farmingNodes: shopEvent.farmingNodes.map((n) => ({ ...n, drops: [] })),
    }
    expect(planShopCurrencies(noDrops, need)).toEqual({ status: 'no-drops' })
  })

  it('1種類がどのクエストにも落ちないときは分けて返し、残りの通貨で周回を出す', () => {
    const demand = new Map([[A, 150], [D, 100]])
    expect(planned(shopEvent, demand).unfarmable).toEqual([D])
    const result = plannedResult(shopEvent, demand)
    expect(result.items.map((i) => i.id)).toEqual([String(A)])
    expect(result.items[0]?.count).toBeGreaterThanOrEqual(150)
    expect(result.total_ap).toBe(400)
  })

  it('すべての通貨がどのクエストにも落ちないときは周回の内訳を出さない', () => {
    const plan = planned(shopEvent, new Map([[D, 100], [D + 1, 5]]))
    expect(plan.result).toBeNull()
    expect(plan.unfarmable).toEqual([D, D + 1])
  })
})

describe('splitUnfarmable', () => {
  it('skipped_items の通貨を見込み獲得量から外す', () => {
    const split = splitUnfarmable({
      params: { objective: 'ap', items: {}, quests: [] },
      quests: [],
      items: [
        { id: '1', category: '', name: 'a', count: 10 },
        { id: '2', category: '', name: 'b', count: 0 },
      ],
      drop_rates: [],
      total_lap: 1,
      total_ap: 40,
      skipped_items: ['2'],
    })
    expect(split.unfarmable).toEqual([2])
    expect(split.result?.items.map((i) => i.id)).toEqual(['1'])
  })
})

describe('applyDropBonus', () => {
  const A = 9001
  const B = 9002
  const bonusEvent: EventPlannerEvent = {
    ...mockEvent,
    id: 99998,
    lotteries: [],
    shop: [],
    farmingNodes: [
      {
        questId: 1,
        name: 'A×2',
        ap: 40,
        drops: [
          { itemId: A, perRun: 15, countPerRun: 5 },
          { itemId: A, perRun: 3, countPerRun: 1 },
          { itemId: B, perRun: 10, countPerRun: 2 },
        ],
      },
      { questId: 2, name: 'old', ap: 40, drops: [{ itemId: B, perRun: 8 }] },
    ],
  }
  const perRuns = (event: EventPlannerEvent) =>
    event.farmingNodes.map((n) => n.drops.map((d) => d.perRun))

  it('perRun + 回数 × N にし、同じクエストの同じ品目のドロップそれぞれに足す', () => {
    const { event, unapplied } = applyDropBonus(bonusEvent, new Map([[A, 2]]))
    expect(perRuns(event)).toEqual([[25, 5, 10], [8]])
    expect(unapplied).toEqual([])
  })

  it('回数を持たないドロップは素の値のままで、その品目を反映できなかった品目として返す', () => {
    const { event, unapplied } = applyDropBonus(bonusEvent, new Map([[A, 0], [B, 1]]))
    expect(perRuns(event)).toEqual([[15, 3, 12], [8]])
    expect(unapplied).toEqual([B])
  })

  it('ボーナスが0の品目は反映できなかった品目に入らない', () => {
    const { unapplied } = applyDropBonus(bonusEvent, new Map([[A, 1], [B, 0]]))
    expect(unapplied).toEqual([])
  })

  it('ボーナスが空か全部0なら入ったイベントをそのまま返し、周回の計算も同じになる', () => {
    const need = new Map([[A, 300], [B, 100]])
    for (const bonus of [new Map<number, number>(), new Map([[A, 0], [B, 0]])]) {
      const { event, unapplied } = applyDropBonus(bonusEvent, bonus)
      expect(event).toBe(bonusEvent)
      expect(unapplied).toEqual([])
      expect(planShopCurrencies(event, need)).toEqual(planShopCurrencies(bonusEvent, need))
    }
  })

  it('ボーナス込みの1周の獲得量で周回数を求める', () => {
    const single: EventPlannerEvent = {
      ...bonusEvent,
      farmingNodes: [{ questId: 1, name: 'A', ap: 40, drops: [{ itemId: A, perRun: 10, countPerRun: 5 }] }],
    }
    const plan = planShopCurrencies(applyDropBonus(single, new Map([[A, 2]])).event, new Map([[A, 300]]))
    if (plan.status !== 'planned' || !plan.result) throw new Error('no farming plan')
    expect(plan.result.quests.map((q) => q.lap)).toEqual([15])
    expect(plan.result.items.find((i) => i.id === String(A))?.count).toBeGreaterThanOrEqual(300)
  })
})

describe('compareBonusCraftEssences', () => {
  const GOLD = 9101
  const SILVER = 9102
  const BRONZE = 9103
  const MORI = 9104
  const goldEvent: EventPlannerEvent = {
    ...mockEvent,
    id: 99997,
    lotteries: [],
    shop: [],
    farmingNodes: [
      { questId: 1, name: '金', ap: 40, drops: [{ itemId: GOLD, perRun: 10, countPerRun: 5 }] },
    ],
  }
  const goldNeed = new Map([[GOLD, 300]])
  const star5 = (overrides: Partial<BonusRarityInput> = {}): BonusRarityInput => ({
    rarity: 5,
    itemId: GOLD,
    maxBonus: 2,
    baseBonus: 1,
    maxOwned: 0,
    baseOwned: 2,
    ...overrides,
  })
  const summary = (rows: BonusCraftEssenceRow[]) =>
    rows.map((r) => ({ total: r.total, counts: r.counts, laps: r.laps, ap: r.ap, apDrop: r.apDrop }))

  it('合計枚数ごとに周回数・AP・1枚少ない行からの AP の減りを並べ、組めない合計枚数の行は出さない', () => {
    const { rows, unfarmable } = compareBonusCraftEssences(goldEvent, goldNeed, new Map(), [star5()], 5)
    expect(unfarmable).toEqual([])
    expect(summary(rows)).toEqual([
      { total: 1, counts: { 3: 0, 4: 0, 5: 1 }, laps: 15, ap: 600, apDrop: undefined },
      { total: 2, counts: { 3: 0, 4: 0, 5: 2 }, laps: 12, ap: 480, apDrop: 120 },
      { total: 3, counts: { 3: 0, 4: 0, 5: 3 }, laps: 10, ap: 400, apDrop: 80 },
    ])
    expect(rows.map((r) => r.bonus.get(GOLD))).toEqual([2, 3, 4])
  })

  it('自分の礼装は凸を先に数える', () => {
    const { rows } = compareBonusCraftEssences(
      goldEvent,
      goldNeed,
      new Map(),
      [star5({ maxOwned: 1, baseOwned: 1 })],
      5,
    )
    const two = rows.find((r) => r.total === 2)
    expect(two?.bonus.get(GOLD)).toBe(4)
    expect(two?.laps).toBe(10)
  })

  it('フレンドの礼装なしなら合計 0 枚の行から始まり、対応のある通貨の +N を 0 で解く', () => {
    const { rows } = compareBonusCraftEssences(goldEvent, goldNeed, new Map(), [star5()], null)
    expect(rows[0]).toMatchObject({ total: 0, laps: 30, ap: 1200 })
    expect(rows[0].bonus.get(GOLD)).toBe(0)
    expect(rows.map((r) => r.total)).toEqual([0, 1, 2])
  })

  it('対応の無い品目には通貨ごとの +N を使い、対応のある通貨は行の編成から求める', () => {
    const event: EventPlannerEvent = {
      ...goldEvent,
      farmingNodes: [
        ...goldEvent.farmingNodes,
        { questId: 2, name: '盛り', ap: 20, drops: [{ itemId: MORI, perRun: 10, countPerRun: 5 }] },
      ],
    }
    const need = new Map([[GOLD, 300], [MORI, 250]])
    const { rows } = compareBonusCraftEssences(event, need, new Map([[MORI, 3], [GOLD, 99]]), [star5()], 5)
    // 盛りは 10 + 5 × 3 = 25 で 10 周（200 AP）、金は各行の編成の +N で解く。
    expect(summary(rows).map((r) => [r.total, r.laps, r.ap])).toEqual([
      [1, 25, 800],
      [2, 22, 680],
      [3, 20, 600],
    ])
    expect(rows.map((r) => [r.bonus.get(GOLD), r.bonus.get(MORI)])).toEqual([
      [2, 3],
      [3, 3],
      [4, 3],
    ])
  })

  it('同じ AP の組み合わせでは ☆5、次に ☆4 の少ないものを選ぶ', () => {
    const inputs: BonusRarityInput[] = [
      { rarity: 5, itemId: SILVER, maxBonus: 2, baseBonus: 1, maxOwned: 1, baseOwned: 1 },
      { rarity: 4, itemId: BRONZE, maxBonus: 2, baseBonus: 1, maxOwned: 1, baseOwned: 1 },
      { rarity: 3, itemId: GOLD, maxBonus: 2, baseBonus: 1, maxOwned: 0, baseOwned: 0 },
    ]
    const { rows } = compareBonusCraftEssences(goldEvent, goldNeed, new Map(), inputs, null)
    expect(rows.find((r) => r.total === 1)?.counts).toEqual({ 3: 0, 4: 1, 5: 0 })
    expect(rows.find((r) => r.total === 2)?.counts).toEqual({ 3: 0, 4: 2, 5: 0 })
  })

  it('同じ AP の組み合わせでは周回の少ないものを ☆ の枚数より先に見る', () => {
    const event: EventPlannerEvent = {
      ...goldEvent,
      farmingNodes: [
        { questId: 1, name: '金', ap: 40, drops: [{ itemId: GOLD, perRun: 10, countPerRun: 1 }] },
        { questId: 2, name: '銀', ap: 20, drops: [{ itemId: SILVER, perRun: 10, countPerRun: 1 }] },
      ],
    }
    const inputs: BonusRarityInput[] = [
      { rarity: 5, itemId: SILVER, maxBonus: 3, baseBonus: 3, maxOwned: 1, baseOwned: 0 },
      { rarity: 4, itemId: GOLD, maxBonus: 2, baseBonus: 2, maxOwned: 1, baseOwned: 0 },
    ]
    const need = new Map([[GOLD, 100], [SILVER, 100]])
    const { rows } = compareBonusCraftEssences(event, need, new Map(), inputs, null)
    // ☆5（銀 8 周）と ☆4（金 9 周）はどちらも 560 AP。周回の少ない ☆5 を選ぶ。
    expect(rows.find((r) => r.total === 1)).toMatchObject({ counts: { 3: 0, 4: 0, 5: 1 }, laps: 18, ap: 560 })
  })

  it('通貨の必要量が無い・ドロップの統計が無い・集められる通貨が無いときは行を返さない', () => {
    expect(compareBonusCraftEssences(goldEvent, new Map(), new Map(), [star5()], 5).rows).toEqual([])
    const noDrops: EventPlannerEvent = { ...goldEvent, farmingNodes: [{ questId: 1, name: 'x', ap: 40, drops: [] }] }
    expect(compareBonusCraftEssences(noDrops, goldNeed, new Map(), [star5()], 5).rows).toEqual([])
    const onlySilver = compareBonusCraftEssences(goldEvent, new Map([[SILVER, 100]]), new Map(), [star5()], 5)
    expect(onlySilver.rows).toEqual([])
    expect(onlySilver.unfarmable).toEqual([SILVER])
  })

  it('周回では集められない通貨があるときは、集められる通貨だけで各行を解き、その通貨を示す', () => {
    const { rows, unfarmable } = compareBonusCraftEssences(
      goldEvent,
      new Map([[GOLD, 300], [SILVER, 100]]),
      new Map(),
      [star5()],
      5,
    )
    expect(unfarmable).toEqual([SILVER])
    expect(summary(rows).map((r) => [r.total, r.laps, r.ap])).toEqual([
      [1, 15, 600],
      [2, 12, 480],
      [3, 10, 400],
    ])
  })

  it('☆ が3つ・所持が十分なら合計 6 枚までの行を返す', () => {
    const event: EventPlannerEvent = {
      ...goldEvent,
      farmingNodes: [
        {
          questId: 1,
          name: '3種',
          ap: 40,
          drops: [
            { itemId: GOLD, perRun: 10, countPerRun: 5 },
            { itemId: SILVER, perRun: 10, countPerRun: 5 },
            { itemId: BRONZE, perRun: 10, countPerRun: 5 },
          ],
        },
        { questId: 2, name: '金', ap: 40, drops: [{ itemId: GOLD, perRun: 15, countPerRun: 3 }] },
        { questId: 3, name: '銀', ap: 40, drops: [{ itemId: SILVER, perRun: 15, countPerRun: 3 }] },
      ],
    }
    const inputs: BonusRarityInput[] = [
      { rarity: 5, itemId: GOLD, maxBonus: 2, baseBonus: 1, maxOwned: 3, baseOwned: 3 },
      { rarity: 4, itemId: SILVER, maxBonus: 3, baseBonus: 2, maxOwned: 3, baseOwned: 3 },
      { rarity: 3, itemId: BRONZE, maxBonus: 4, baseBonus: 3, maxOwned: 3, baseOwned: 3 },
    ]
    const need = new Map([[GOLD, 600], [SILVER, 600], [BRONZE, 600]])
    const { rows } = compareBonusCraftEssences(event, need, new Map(), inputs, null)
    expect(rows.map((r) => r.total)).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const row of rows) {
      expect(row.counts[3] + row.counts[4] + row.counts[5]).toBe(row.total)
      expect(row.ap).toBeGreaterThan(0)
    }
  })
})

describe('selectBonusCraftEssenceRow', () => {
  const row = (total: number, ap: number): BonusCraftEssenceRow => ({
    total,
    counts: { 3: 0, 4: 0, 5: total },
    laps: ap / 40,
    ap,
    bonus: new Map(),
  })
  const rows = [row(1, 600), row(2, 400), row(3, 400)]

  it('未選択なら AP が最も少ない行（同じ AP なら合計枚数の少ない行）', () => {
    expect(selectBonusCraftEssenceRow(rows, undefined)?.total).toBe(2)
  })

  it('選んだ合計枚数の行があればそれ', () => {
    expect(selectBonusCraftEssenceRow(rows, 1)?.total).toBe(1)
  })

  it('選んだ合計枚数の行が無くなっていれば AP が最も少ない行', () => {
    expect(selectBonusCraftEssenceRow(rows, 5)?.total).toBe(2)
  })

  it('行が無ければ undefined', () => {
    expect(selectBonusCraftEssenceRow([], undefined)).toBeUndefined()
  })
})

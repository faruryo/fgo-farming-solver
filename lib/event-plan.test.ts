/**
 * lib/event-plan.test.ts
 *
 * Task 14 — 単体テスト（vitest）。
 * mocks/events.json（イベント 80586、11 箱、農場ノード 5 本）を使用する。
 */

import { describe, it, expect } from 'vitest'
import type { EventPlannerEvent } from './master-data/types'
import type { ChaldeaState } from '../hooks/create-chaldea-state'
import type { MaterialsForServants } from './get-materials'
import {
  calcBoxLayer,
  allocateShop,
  buildEventDrops,
  runEventSolver,
  reverseCalcBoxes,
  computeShortfall,
  computeRosterImpact,
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

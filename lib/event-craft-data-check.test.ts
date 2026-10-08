import { describe, it, expect } from 'vitest'
import type { Drops } from './get-drops'
import {
  auditFarmableCraftGaps,
  findMissingCraftData,
  formatFarmableCraftAudit,
  parseCraftAuditInputs,
  positiveNeedAtlasIds,
} from './event-craft-data-check'
import { DEFAULT_STOCK_BUFFER } from './quest-efficiency'

const atlas = (
  id: number,
  type: string,
  background: string,
  category = '銅素材',
  largeCategory = '強化素材',
  priority = 200,
) => ({ id, type, background, category, largeCategory, priority }) as never

const items = [
  atlas(1, 'qp', 'zero', 'QP', 'QP'),
  atlas(6516, 'skillLvUp', 'bronze'),
  atlas(6517, 'skillLvUp', 'bronze'),
  atlas(6518, 'skillLvUp', 'bronze'),
  atlas(7001, 'tdLvUp', 'silver', 'ピース', 'モニュピ', 300),
  atlas(7002, 'tdLvUp', 'silver', 'ピース', 'モニュピ', 301),
  atlas(6601, 'skillLvUp', 'silver', '銀素材', '強化素材', 230),
  atlas(6602, 'skillLvUp', 'silver', '銀素材', '強化素材', 231),
  atlas(9000, 'tdLvUp', 'gold', '特殊霊基再臨素材', 'イベントアイテム'),
  atlas(6999, 'skillLvUp', 'gold', '金素材', '強化素材', 299),
  atlas(5000, 'skillLvUp', 'gold', '特殊霊基再臨素材', 'イベントアイテム', 1000),
]

const drops = {
  items: [
    { id: '00', atlasId: 1, category: 'QP' },
    { id: '01', atlasId: 6516, category: '銅素材' },
    { id: '02', atlasId: 6517, category: '銅素材' },
    { id: '20', atlasId: 7001, category: 'ピース' },
    { id: '21', atlasId: 7002, category: 'ピース' },
    { id: '30', atlasId: 6601, category: '銀素材' },
    { id: '31', atlasId: 6602, category: '銀素材' },
  ],
  quests: [{ id: 'Q1' }],
  drop_rates: [
    { quest_id: 'Q1', item_id: '01', drop_rate: 0.5 },
    { quest_id: 'Q1', item_id: '02', drop_rate: 0 },
    { quest_id: 'GONE', item_id: '02', drop_rate: 0.5 },
  ],
} as unknown as Drops

describe('findMissingCraftData', () => {
  it.each([
    ['完全（レートあり）', [6516], []],
    ['(a) 対象クラスのカタログ欠落', [6518], [{ atlasId: 6518, reason: 'absent' }]],
    ['(a) 除外: QP はカタログ外でも正当', [1], []],
    ['(a) 除外: tdLvUp は対象クラス外', [9000], []],
    ['(a) 除外: 伝承結晶(priority 299)は周回対象外', [6999], []],
    ['(a) Atlas 一覧にも drops にも無い素材は分類できないので欠落', [6666], [{ atlasId: 6666, reason: 'absent' }]],
    ['(a) 除外: 過去イベントの特殊再臨素材(priority 500 以上)', [5000], []],
    ['(b) 同カテゴリ内の一部欠落（rate 0・未知クエストのみ）', [6517], [{ atlasId: 6517, reason: 'unrated' }]],
    ['(b) 除外: カテゴリ全滅（ピース）', [7001, 7002], []],
    ['(b) 周回対象クラスはカテゴリ全体でレート欠落でも欠落（他カテゴリにはレートあり）', [6601, 6602], [
      { atlasId: 6601, reason: 'unrated' },
      { atlasId: 6602, reason: 'unrated' },
    ]],
    ['複数欠落', [6516, 6517, 6518], [
      { atlasId: 6517, reason: 'unrated' },
      { atlasId: 6518, reason: 'absent' },
    ]],
  ] as const)('%s', (_label, need, expected) => {
    expect(findMissingCraftData(drops, need, items)).toEqual(expected)
  })
})

describe('auditFarmableCraftGaps', () => {
  it('周回対象の穴だけを出し、穴があれば exit 1', () => {
    const report = formatFarmableCraftAudit(auditFarmableCraftGaps(drops, items))
    expect(report.exitCode).toBe(1)
    expect(report.text).toContain('6518\t\tabsent')
    expect(report.text).not.toContain('6999')
    expect(report.text).not.toContain('7001')
  })

  it('周回対象がすべてレートを持てば exit 0', () => {
    const coveredItems = [atlas(6516, 'skillLvUp', 'bronze')]
    const covered = {
      items: [{ id: '01', atlasId: 6516, category: '銅素材' }],
      quests: [{ id: 'Q1' }],
      drop_rates: [{ quest_id: 'Q1', item_id: '01', drop_rate: 0.5 }],
    } as unknown as Drops
    const report = formatFarmableCraftAudit(auditFarmableCraftGaps(covered, coveredItems))
    expect(report).toEqual({ exitCode: 0, text: 'gaps=0' })
  })

  it('Atlas 素材が空なら入力不正で、点検成功にしない', () => {
    const dropsJson = {
      items: [{ id: '01', atlasId: 6516, category: '銅素材', largeCategory: '強化素材' }],
      quests: [{ id: 'Q1' }],
      drop_rates: [{ quest_id: 'Q1', item_id: '01', drop_rate: 0.5 }],
    }
    expect(parseCraftAuditInputs(dropsJson, [])).toBeNull()
  })

  it('type や priority が欠けた Atlas 行は入力不正', () => {
    const dropsJson = {
      items: [{ id: '01', atlasId: 6516, category: '銅素材', largeCategory: '強化素材' }],
      quests: [{ id: 'Q1' }],
      drop_rates: [{ quest_id: 'Q1', item_id: '01', drop_rate: 0.5 }],
    }
    const incomplete = [{ id: 6516, background: 'bronze' }]
    expect(parseCraftAuditInputs(dropsJson, incomplete)).toBeNull()
    const complete = [{ id: 6516, type: 'skillLvUp', background: 'bronze', priority: 200, name: '剣の輝石' }]
    expect(parseCraftAuditInputs(dropsJson, complete)?.items).toEqual([
      {
        id: 6516,
        name: '剣の輝石',
        type: 'skillLvUp',
        background: 'bronze',
        category: '',
        largeCategory: '',
        priority: 200,
      },
    ])
  })
})

describe('positiveNeedAtlasIds', () => {
  it('training: 必要数 − 所持数 > 0 の atlasId（カタログ外も含む）', () => {
    const ids = positiveNeedAtlasIds(items, { 6516: 5, 6517: 3, 6518: 2 }, { 6516: 5, 6517: 1 }, DEFAULT_STOCK_BUFFER, 'training')
    expect(ids).toEqual(new Set([6517, 6518]))
  })

  it('reserve: 所持数キーの無い素材は除外（buildNeedByApiItemId と同じ）', () => {
    const ids = positiveNeedAtlasIds(items, { 6516: 5, 6518: 2 }, { 6516: 0 }, DEFAULT_STOCK_BUFFER, 'reserve')
    expect(ids).toEqual(new Set([6516]))
  })
})

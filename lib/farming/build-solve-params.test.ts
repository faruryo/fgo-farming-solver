import { describe, it, expect } from 'vitest'
import {
  buildQueryItemsA,
  buildQueryItemsB,
  buildSolveParams,
  toStockItemLike,
} from './build-solve-params'
import { EnrichedItem } from '../get-items'
import { StockBuffer } from '../quest-efficiency'

const makeItem = (
  id: number,
  name: string,
  category: string = '金素材',
  largeCategory: string = '強化素材'
): EnrichedItem => ({
  id,
  name,
  type: 'ascension',
  uses: 'ascension',
  detail: '',
  icon: `${id}.png`,
  background: 'gold',
  priority: 200,
  dropPriority: 100,
  category,
  largeCategory,
})

const item1 = makeItem(100, '灯火の焔', '金素材', '強化素材')
const item2 = makeItem(200, '蛮神の心臓', '金素材', '強化素材')
const items = [item1, item2]

const defaultBuffer: StockBuffer = {
  normal: { gold: 0, silver: 0, bronze: 0 },
  skillStone: { gold: 0, silver: 0, bronze: 0 },
  monumentPiece: { gold: 0, silver: 0 },
}

describe('build-solve-params', () => {
  describe('toStockItemLike', () => {
    it('extracts id string, category, and largeCategory', () => {
      expect(toStockItemLike(item1)).toEqual({
        id: '100',
        category: '金素材',
        largeCategory: '強化素材',
      })
    })
  })

  describe('buildQueryItemsA', () => {
    it('computes plain shortage items (amounts - possession)', () => {
      const solverItems = [item1, item2]
      const amounts = { '100': 15, '200': 5 }
      const possession = { '100': 5, '200': 10 } // item1 deficit 10, item2 surplus (0 deficit)

      const result = buildQueryItemsA(solverItems, amounts, possession, items)
      expect(result).toBe('20:10')
    })

    it('returns empty string when all items are satisfied', () => {
      const solverItems = [item1, item2]
      const amounts = { '100': 5, '200': 5 }
      const possession = { '100': 10, '200': 10 }

      const result = buildQueryItemsA(solverItems, amounts, possession, items)
      expect(result).toBe('')
    })
  })

  describe('buildQueryItemsB', () => {
    it('returns empty string if stockEnabled is false', () => {
      const solverItems = [item1]
      const amounts = { '100': 10 }
      const possession = { '100': 0 }

      const result = buildQueryItemsB(
        solverItems,
        amounts,
        possession,
        false,
        { ...defaultBuffer, normal: { ...defaultBuffer.normal, gold: 5 } },
        items
      )
      expect(result).toBe('')
    })

    it('includes buffer amount when stockEnabled is true', () => {
      const solverItems = [item1]
      const amounts = { '100': 10 }
      const possession = { '100': 5 } // deficit = 10 + 5 - 5 = 10

      const result = buildQueryItemsB(
        solverItems,
        amounts,
        possession,
        true,
        { ...defaultBuffer, normal: { ...defaultBuffer.normal, gold: 5 } },
        items
      )
      expect(result).toBe('20:10')
    })
  })

  describe('buildSolveParams', () => {
    it('returns null params when there are no item targets', () => {
      const res = buildSolveParams({
        solverItems: [item1],
        amounts: {},
        possession: {},
        stockEnabled: false,
        resolvedStockBuffer: defaultBuffer,
        items,
        checkedQuests: ['quest-1'],
      })

      expect(res.needsItemTarget).toBe(true)
      expect(res.needsQuestSelection).toBe(false)
      expect(res.params).toBeNull()
    })

    it('returns null params when there are no checked quests', () => {
      const res = buildSolveParams({
        solverItems: [item1],
        amounts: { '100': 10 },
        possession: { '100': 0 },
        stockEnabled: false,
        resolvedStockBuffer: defaultBuffer,
        items,
        checkedQuests: [],
      })

      expect(res.needsItemTarget).toBe(false)
      expect(res.needsQuestSelection).toBe(true)
      expect(res.params).toBeNull()
    })

    it('builds single Goal A query when stock is disabled', () => {
      const res = buildSolveParams({
        solverItems: [item1, item2],
        amounts: { '100': 10, '200': 20 },
        possession: { '100': 2, '200': 10 },
        stockEnabled: false,
        resolvedStockBuffer: defaultBuffer,
        items,
        checkedQuests: ['q1', 'q2'],
      })

      expect(res.needsItemTarget).toBe(false)
      expect(res.needsQuestSelection).toBe(false)
      expect(res.params?.get('items')).toBe('20:8,21:10')
      expect(res.params?.get('itemsStock')).toBeNull()
      expect(res.params?.get('quests')).toBe('q1,q2')
      expect(res.params?.get('fields')).toBe('id')
    })

    it('builds two-goal batch query when Goal B differs from Goal A', () => {
      const res = buildSolveParams({
        solverItems: [item1],
        amounts: { '100': 10 },
        possession: { '100': 2 }, // A = 8, B (with buffer 5) = 13
        stockEnabled: true,
        resolvedStockBuffer: { ...defaultBuffer, normal: { ...defaultBuffer.normal, gold: 5 } },
        items,
        checkedQuests: ['q1'],
      })

      expect(res.params?.get('items')).toBe('20:8')
      expect(res.params?.get('itemsStock')).toBe('20:13')
      expect(res.params?.get('quests')).toBe('q1')
    })

    it('omits itemsStock when Goal B is identical to Goal A (buffer is 0)', () => {
      const res = buildSolveParams({
        solverItems: [item1],
        amounts: { '100': 10 },
        possession: { '100': 2 },
        stockEnabled: true,
        resolvedStockBuffer: defaultBuffer,
        items,
        checkedQuests: ['q1'],
      })

      expect(res.params?.get('items')).toBe('20:8')
      expect(res.params?.get('itemsStock')).toBeNull()
    })

    it('sends Goal B as sole items query when Goal A is satisfied (stock-only)', () => {
      const res = buildSolveParams({
        solverItems: [item1],
        amounts: { '100': 10 },
        possession: { '100': 10 }, // A = 0, B = 5 (due to buffer)
        stockEnabled: true,
        resolvedStockBuffer: { ...defaultBuffer, normal: { ...defaultBuffer.normal, gold: 5 } },
        items,
        checkedQuests: ['q1'],
      })

      expect(res.queryItemsA).toBe('')
      expect(res.queryItemsB).toBe('20:5')
      expect(res.needsItemTarget).toBe(false)
      expect(res.params?.get('items')).toBe('20:5')
      expect(res.params?.get('itemsStock')).toBeNull()
    })

    it('omits unsupported items where toApiItemId returns empty string from query targets', () => {
      const qpItem: EnrichedItem = {
        ...makeItem(1, 'QP', 'その他', 'その他'),
        background: 'zero',
      }
      const res = buildSolveParams({
        solverItems: [qpItem, item1],
        amounts: { '1': 10000000, '100': 10 },
        possession: { '1': 0, '100': 0 },
        stockEnabled: true,
        resolvedStockBuffer: defaultBuffer,
        items: [...items, qpItem],
        checkedQuests: ['q1'],
      })

      expect(res.queryItemsA).toBe('20:10')
      expect(res.queryItemsB).toBe('20:10')
      expect(res.params?.get('items')).toBe('20:10')
    })
  })
})

import { describe, it, expect } from 'vitest'
import { deriveStockMeta, HistoryItem } from './FarmingHistoryChart'

describe('deriveStockMeta', () => {
  it('correctly compares SQLite UTC dates to determine most recent entry', () => {
    const history: HistoryItem[] = [
      {
        id: '1',
        objective: 'ap',
        total_ap: 100,
        total_lap: 10,
        stock_included: 0,
        created_at: '2026-05-24 03:00:00', // older
      },
      {
        id: '2',
        objective: 'ap',
        total_ap: 200,
        total_lap: 20,
        stock_included: 1,
        created_at: '2026-05-24 15:00:00', // newer (stock)
      },
    ]

    const meta = deriveStockMeta(history)
    expect(meta.bothExist).toBe(true)
    expect(meta.defaultFilter).toBe('stock')
  })

  it('correctly handles ISO format dates', () => {
    const history: HistoryItem[] = [
      {
        id: '1',
        objective: 'ap',
        total_ap: 100,
        total_lap: 10,
        stock_included: 1,
        created_at: '2026-05-24T15:00:00Z',
      },
      {
        id: '2',
        objective: 'ap',
        total_ap: 200,
        total_lap: 20,
        stock_included: 0,
        created_at: '2026-05-25T01:00:00Z', // newer (normal)
      },
    ]

    const meta = deriveStockMeta(history)
    expect(meta.bothExist).toBe(true)
    expect(meta.defaultFilter).toBe('normal')
  })
})

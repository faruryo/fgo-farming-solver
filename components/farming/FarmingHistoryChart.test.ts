import { describe, it, expect } from 'vitest'
import { deriveStockMeta, countPointsByPeriod, resolvePeriod, HistoryItem } from './FarmingHistoryChart'

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

describe('countPointsByPeriod / resolvePeriod', () => {
  const now = new Date('2026-11-03T00:00:00Z')
  const item = (id: string, created_at: string, total_ap = 100): HistoryItem => ({
    id, objective: 'ap', total_ap, total_lap: 10, created_at,
  })

  it('直近3ヶ月に記録が無く、1年以内に2点あれば1年を選ぶ', () => {
    const history = [item('1', '2026-02-01T00:00:00Z'), item('2', '2026-06-01T00:00:00Z')]
    const counts = countPointsByPeriod(history, now)
    expect(Object.fromEntries(counts)).toEqual({ '1m': 0, '3m': 0, '6m': 1, '1y': 2, all: 2 })
    expect(resolvePeriod('3m', counts)).toBe('1y')
  })

  it('選んだ期間に2点以上あればそのまま', () => {
    const history = [item('1', '2026-10-20T00:00:00Z'), item('2', '2026-10-30T00:00:00Z')]
    expect(resolvePeriod('6m', countPointsByPeriod(history, now))).toBe('6m')
  })

  it('total_ap が0の履歴は数えない。どの期間も2点未満なら選んだまま', () => {
    const history = [item('1', '2026-10-20T00:00:00Z'), item('2', '2026-10-30T00:00:00Z', 0)]
    const counts = countPointsByPeriod(history, now)
    expect(counts.get('all')).toBe(1)
    expect(resolvePeriod('3m', counts)).toBe('3m')
  })
})

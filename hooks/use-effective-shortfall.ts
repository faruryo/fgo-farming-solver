'use client'

import { useMemo } from 'react'
import { useRosterNeed } from './use-roster-need'
import { countsOrEmpty, useLocalStorage } from './use-local-storage'
import { useStockTarget } from './use-stock-target'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import { computeEffectiveShortfall, type StockItemInfo } from '../lib/effective-shortfall'

/**
 * イベントページの不足。育成計画（サーヴァントとクラススコアの目標）・実所持数・周回目的・在庫基準を読み、
 * 周回目的に従った実効不足を返す。どの保存値にも書き込まない。
 * `items` は在庫基準を決める素材の分類（無ければ在庫基準を使わない）。
 */
export const useEffectiveShortfall = (items?: readonly StockItemInfo[]) => {
  const roster = useRosterNeed()
  // 周回目標（STORAGE_KEYS.ITEMS）ではなく実所持数を使う。
  const [possession, , possessionLoaded] = useLocalStorage<Record<string, number | undefined>>(
    STORAGE_KEYS.POSSESSION,
    {},
    { lazyWrite: true, onGet: countsOrEmpty, repairOnGet: true },
  )
  const { purpose, stockBuffer } = useStockTarget()
  const effective = useMemo(
    () =>
      roster.status === 'ready'
        ? computeEffectiveShortfall(roster.totalNeed, possession, items, stockBuffer, purpose)
        : undefined,
    [roster, possession, items, stockBuffer, purpose],
  )
  return { roster, possessionLoaded, purpose, effective }
}

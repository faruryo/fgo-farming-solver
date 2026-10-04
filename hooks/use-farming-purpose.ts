'use client'

import { useCallback } from 'react'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import {
  isFarmingPurpose,
  migrateFarmingPurpose,
  type FarmingPurpose,
} from '../lib/farming-purpose'
import { useLocalStorage } from './use-local-storage'

export const useFarmingPurpose = () => {
  // 表示だけで書き込まないよう、未保存(null)の端末では旧キーから復元した目的をメモリ上だけで使う。
  const [stored, setStored] = useLocalStorage<FarmingPurpose | null>(
    STORAGE_KEYS.FARMING_PURPOSE,
    null,
    {
      onGet: (value) => (isFarmingPurpose(value) ? value : 'training'),
      lazyWrite: true,
    },
  )
  const [legacyShortageOnly] = useLocalStorage<unknown>(
    STORAGE_KEYS.QUEST_EFFICIENCY_SHORTAGE_ONLY,
    null,
    { lazyWrite: true },
  )
  const [legacyStock] = useLocalStorage<unknown>(
    STORAGE_KEYS.STOCK_ENABLED,
    null,
    { lazyWrite: true },
  )

  const setPurpose = useCallback(
    (next: FarmingPurpose) => setStored(next),
    [setStored],
  )
  const purpose =
    stored ??
    migrateFarmingPurpose(
      null,
      legacyShortageOnly !== null && legacyShortageOnly !== true,
      legacyStock === true,
    )
  return { purpose, setPurpose }
}

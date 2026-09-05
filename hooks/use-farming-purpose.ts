'use client'

import { useCallback, useEffect } from 'react'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import {
  isFarmingPurpose,
  migrateFarmingPurpose,
  type FarmingPurpose,
} from '../lib/farming-purpose'
import { useLocalStorage } from './use-local-storage'

const readBoolean = (key: string, fallback: boolean): boolean => {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw) === true
  } catch {
    return fallback
  }
}

export const useFarmingPurpose = () => {
  const [purpose, setPurpose] = useLocalStorage<FarmingPurpose>(
    STORAGE_KEYS.FARMING_PURPOSE,
    'training',
    { onGet: (value) => (isFarmingPurpose(value) ? value : 'training') },
  )

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEYS.FARMING_PURPOSE) != null) return
    setPurpose(
      migrateFarmingPurpose(
        null,
        !readBoolean(STORAGE_KEYS.QUEST_EFFICIENCY_SHORTAGE_ONLY, true),
        readBoolean(STORAGE_KEYS.STOCK_ENABLED, false),
      ),
    )
  }, [setPurpose])

  const updatePurpose = useCallback(
    (next: FarmingPurpose) => setPurpose(next),
    [setPurpose],
  )
  return { purpose, setPurpose: updatePurpose }
}

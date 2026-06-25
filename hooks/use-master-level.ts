'use client'

import { useMemo } from 'react'
import { useLocalStorage } from './use-local-storage'
import {
  MAX_MASTER_LEVEL,
  maxApForLevel,
} from '../lib/master-profile/max-ap'

/** masterLevel の localStorage キー。use-cloud-sync の KEYS に登録され自動同期される。 */
export const MASTER_LEVEL_KEY = 'masterLevel'

/**
 * マスターレベルを保持し、最大AP を導出する横断プロフィールフック。
 *
 * - localStorage `masterLevel` に永続（`useLocalStorage` 経由 → `ls-sync` 発火）。
 * - `KEYS` に登録済みのためログイン中はクラウド同期される（US-12）。
 * - 未設定時の既定は最大レベル（`MAX_MASTER_LEVEL`）。
 */
export const useMasterLevel = (): {
  level: number
  setLevel: (level: number) => void
  maxAp: number
} => {
  const [level, setLevel] = useLocalStorage<number>(
    MASTER_LEVEL_KEY,
    MAX_MASTER_LEVEL,
  )

  const clamped = useMemo(
    () => Math.max(1, Math.min(MAX_MASTER_LEVEL, Math.floor(level || MAX_MASTER_LEVEL))),
    [level],
  )
  const maxAp = useMemo(() => maxApForLevel(clamped), [clamped])

  return { level: clamped, setLevel, maxAp }
}

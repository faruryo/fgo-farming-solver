'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ChaldeaState } from './create-chaldea-state'
import { useLocalStorage } from './use-local-storage'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import type { MaterialsForServants } from '../lib/get-materials'
import { loadMaterialCatalog } from './use-material-catalog'
import { computeTotalNeed } from '../lib/event-plan'

export type RosterNeed =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      chaldeaState: ChaldeaState
      materialsForServants: MaterialsForServants
      totalNeed: Map<number, number>
    }

type Fetched =
  | { ids: string; status: 'error' }
  | { ids: string; status: 'done'; materials: MaterialsForServants }

/**
 * 永続ロスター(`STORAGE_KEYS.MATERIAL`)から総必要数を出す。localStorage には書き込まない。
 * ドロップデータには依存しない(ボックス計画がドロップ取得の成否に左右されないため)。
 */
export const useRosterNeed = (): RosterNeed => {
  const [chaldeaState] = useLocalStorage<ChaldeaState>(
    STORAGE_KEYS.MATERIAL,
    {},
    { lazyWrite: true },
  )

  const enabledServantIds = useMemo<number[]>(
    () =>
      Object.entries(chaldeaState)
        .filter(([id, s]) => id !== 'all' && !s.disabled)
        .map(([id]) => Number(id))
        .filter(Boolean),
    [chaldeaState],
  )
  const idsKey = enabledServantIds.join(',')

  const [fetched, setFetched] = useState<Fetched | null>(null)

  useEffect(() => {
    if (!idsKey) return
    let cancelled = false
    const ids = idsKey.split(',').map(Number)
    loadMaterialCatalog()
      .then(({ materials: catalog }) => {
        if (cancelled) return
        // カタログに無いサーヴァント（実装直後など）を落としたまま集計すると不足数が過小になる。
        // 全件揃わなければエラーにする。
        const keys = new Set(ids.map(String))
        const materials = Object.fromEntries(Object.entries(catalog).filter(([id]) => keys.has(id)))
        const complete = Object.keys(materials).length === keys.size
        setFetched(
          complete
            ? {
                ids: idsKey,
                status: 'done',
                materials,
              }
            : { ids: idsKey, status: 'error' },
        )
      })
      .catch((e: unknown) => {
        console.error(e)
        if (!cancelled) setFetched({ ids: idsKey, status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [idsKey])

  return useMemo<RosterNeed>(() => {
    if (!idsKey) return { status: 'empty' }
    if (!fetched || fetched.ids !== idsKey) return { status: 'loading' }
    if (fetched.status === 'error') return { status: 'error' }
    return {
      status: 'ready',
      chaldeaState,
      materialsForServants: fetched.materials,
      totalNeed: computeTotalNeed(chaldeaState, fetched.materials),
    }
  }, [idsKey, fetched, chaldeaState])
}

export const toAmounts = (totalNeed: Map<number, number>): Record<string, number> =>
  Object.fromEntries(Array.from(totalNeed, ([id, n]) => [String(id), n]))

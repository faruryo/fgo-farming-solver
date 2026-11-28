'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ChaldeaState } from './create-chaldea-state'
import { useLocalStorage } from './use-local-storage'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import type { MaterialsForServants } from '../lib/get-materials'
import { loadMaterialCatalog } from './use-material-catalog'
import { computeServantResult, resolveRequiredMaterials } from '../lib/required-materials'
import { classScoreStateOrDefault } from '../lib/class-score/read-state'
import { sumClassScoreMaterials } from '../lib/class-score/sum'
import { DEFAULT_CLASS_SCORE_STATE, type ClassScoreState } from '../lib/class-score/types'

export type RosterNeed =
  /** 育成計画・クラススコアの保存値をまだ読んでいない（読む前は保存値が空に見えるので empty と区別する）。 */
  | { status: 'unread' }
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

const NO_MATERIALS: MaterialsForServants = {}

/** クラススコアの保存値を書き込まずに読み、目標があるかを返す。壊れた保存値は既定値（目標なし）として読む。 */
const useClassScoreTarget = () => {
  const [classScoreState, , classScoreLoaded] = useLocalStorage<ClassScoreState>(
    STORAGE_KEYS.CLASS_SCORE,
    DEFAULT_CLASS_SCORE_STATE,
    { lazyWrite: true, onGet: classScoreStateOrDefault },
  )
  const hasClassScore = useMemo(
    () => Object.keys(sumClassScoreMaterials(classScoreState)).length > 0,
    [classScoreState],
  )
  return { classScoreState, classScoreLoaded, hasClassScore }
}

/**
 * 永続ロスター(`STORAGE_KEYS.MATERIAL`)とクラススコアの目標(`STORAGE_KEYS.CLASS_SCORE`)から、
 * 育成計算機と同じ合算で総必要数を出す。localStorage には書き込まない。
 * サーヴァントの育成対象が無くてもクラススコアの目標があれば ready（素材カタログは読まない）。
 * ドロップデータには依存しない(ボックス計画がドロップ取得の成否に左右されないため)。
 */
export const useRosterNeed = (): RosterNeed => {
  const [chaldeaState, , rosterLoaded] = useLocalStorage<ChaldeaState>(
    STORAGE_KEYS.MATERIAL,
    {},
    { lazyWrite: true },
  )
  const { classScoreState, classScoreLoaded, hasClassScore } = useClassScoreTarget()
  const loaded = rosterLoaded && classScoreLoaded

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
    if (!loaded) return { status: 'unread' }
    const ready = (materialsForServants: MaterialsForServants): RosterNeed => ({
      status: 'ready',
      chaldeaState,
      materialsForServants,
      totalNeed: totalNeedOf(chaldeaState, materialsForServants, classScoreState),
    })
    if (!idsKey) return hasClassScore ? ready(NO_MATERIALS) : { status: 'empty' }
    if (!fetched || fetched.ids !== idsKey) return { status: 'loading' }
    if (fetched.status === 'error') return { status: 'error' }
    return ready(fetched.materials)
  }, [loaded, idsKey, fetched, chaldeaState, classScoreState, hasClassScore])
}

/** 育成ぶん（今の状態から求めた値）とクラススコアぶんを、ほかの画面と同じ合算の手順で足す。 */
const totalNeedOf = (
  chaldeaState: ChaldeaState,
  materials: MaterialsForServants,
  classScoreState: ClassScoreState,
): Map<number, number> =>
  toNeedMap(
    resolveRequiredMaterials({
      servantResult: computeServantResult(chaldeaState, materials),
      servantCurrent: true,
      legacyResult: null,
      classScoreState,
    }).total,
  )

const toNeedMap = (amounts: Record<string, number>): Map<number, number> =>
  new Map(
    Object.entries(amounts).flatMap(([id, n]) => {
      const atlasId = Number(id)
      return Number.isFinite(atlasId) && n > 0 ? [[atlasId, n] as const] : []
    }),
  )

export const toAmounts = (totalNeed: Map<number, number>): Record<string, number> =>
  Object.fromEntries(Array.from(totalNeed, ([id, n]) => [String(id), n]))

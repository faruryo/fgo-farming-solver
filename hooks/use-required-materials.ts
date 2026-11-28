'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChaldeaState } from './create-chaldea-state'
import type { MaterialsForServants } from '../lib/get-materials'
import { recordOrEmpty, useLocalStorage } from './use-local-storage'
import { loadMaterialCatalog } from './use-material-catalog'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import { classScoreStateOrDefault } from '../lib/class-score/read-state'
import { DEFAULT_CLASS_SCORE_STATE, type ClassScoreState } from '../lib/class-score/types'
import {
  computeServantResult,
  enabledServantIds,
  hasServantTargets,
  resolveRequiredMaterials,
  type RequiredMaterials,
} from '../lib/required-materials'

type Computed =
  | { material: string; status: 'done'; value: Record<string, number> }
  | { material: string; status: 'error' }

export type RequiredMaterialsState = RequiredMaterials & {
  /** 保存値（サーヴァントの状態・育成ぶん・旧値・クラススコア）を読み終えたか。 */
  loaded: boolean
  /** 今のサーヴァントの状態から求めた育成ぶん。取得中・取得失敗の間は null。 */
  computedServant: Record<string, number> | null
  /** 育成ぶんを今の状態から求められず、必要数が古い可能性がある（素材データの取得に失敗した）。 */
  stale: boolean
  classScoreState: ClassScoreState
}

const readRecord = (item: Record<string, number> | null): Record<string, number> | null =>
  item === null ? null : recordOrEmpty<number>(item)

/** 保存値の文字列から、`useLocalStorage` が読んだ値と比べられる形に直す。 */
const normalizedJson = (raw: string | null): string => {
  if (!raw) return '{}'
  try {
    return JSON.stringify(recordOrEmpty(JSON.parse(raw)))
  } catch {
    return '{}'
  }
}

const writeServantResult = (value: Record<string, number>) => {
  const json = JSON.stringify(value)
  if (localStorage.getItem(STORAGE_KEYS.MATERIAL_SERVANT_RESULT) === json) return
  localStorage.setItem(STORAGE_KEYS.MATERIAL_SERVANT_RESULT, json)
  // 同じ画面の読み手に知らせる。同期の対象外のキーなので、クラウド同期の未保存の変更にはならない。
  window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: STORAGE_KEYS.MATERIAL_SERVANT_RESULT } }))
}

/** 必要数の計算に使う保存値を、書き込まずに読む。 */
const useStoredNeeds = () => {
  const [chaldeaState, , materialLoaded] = useLocalStorage<ChaldeaState>(STORAGE_KEYS.MATERIAL, {}, {
    lazyWrite: true,
    onGet: recordOrEmpty,
  })
  const [storedServant, , servantLoaded] = useLocalStorage<Record<string, number> | null>(
    STORAGE_KEYS.MATERIAL_SERVANT_RESULT,
    null,
    { lazyWrite: true, onGet: readRecord },
  )
  const [legacyResult, , legacyLoaded] = useLocalStorage<Record<string, number> | null>(
    STORAGE_KEYS.MATERIAL_RESULT,
    null,
    { lazyWrite: true, onGet: readRecord },
  )
  const [classScoreState, , classScoreLoaded] = useLocalStorage<ClassScoreState>(
    STORAGE_KEYS.CLASS_SCORE,
    DEFAULT_CLASS_SCORE_STATE,
    { lazyWrite: true, onGet: classScoreStateOrDefault },
  )
  const materialJson = useMemo(() => JSON.stringify(chaldeaState), [chaldeaState])
  return {
    materialJson,
    materialLoaded,
    storedServant,
    legacyResult,
    classScoreState,
    loaded: materialLoaded && servantLoaded && legacyLoaded && classScoreLoaded,
  }
}

/**
 * サーヴァントの状態（`materialJson`）から育成ぶんを求めて保存し、今の状態に対する結果を返す。
 * 状態を読み込む前は何もしない（初期値の `{}` を目標なしと判定しない）。
 */
const useServantResultRecompute = (
  materialLoaded: boolean,
  materialJson: string,
  materials: MaterialsForServants | undefined,
): Computed | null => {
  const [computed, setComputedState] = useState<Computed | null>(null)
  // 同じ結果なら state を変えない（素材データの参照が描画ごとに変わっても描画を繰り返さない）
  const setComputed = useCallback((next: Computed) => {
    setComputedState((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [])
  // 目標が無ければ素材データを取得せずに空で確定する
  const noTargets = useMemo<Computed | null>(
    () =>
      materialLoaded && !hasServantTargets(JSON.parse(materialJson) as ChaldeaState)
        ? { material: materialJson, status: 'done', value: {} }
        : null,
    [materialLoaded, materialJson],
  )

  useEffect(() => {
    if (!materialLoaded) return
    if (noTargets) {
      writeServantResult({})
      return
    }
    let cancelled = false
    const state = JSON.parse(materialJson) as ChaldeaState
    const ids = new Set(enabledServantIds(state))
    const catalogPromise = materials ? Promise.resolve({ materials }) : loadMaterialCatalog()
    catalogPromise
      .then(({ materials: catalog }) => {
        if (cancelled) return
        // 取得中に状態が変わっていたら、古い状態で求めた結果は書かない。
        if (normalizedJson(localStorage.getItem(STORAGE_KEYS.MATERIAL)) !== materialJson) return
        const owned = Object.fromEntries(Object.entries(catalog).filter(([id]) => ids.has(id)))
        const value = computeServantResult(state, owned)
        writeServantResult(value)
        setComputed({ material: materialJson, status: 'done', value })
      })
      .catch((e: unknown) => {
        console.error(e)
        if (!cancelled) setComputed({ material: materialJson, status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [materialLoaded, materialJson, materials, noTargets, setComputed])

  if (noTargets) return noTargets
  return computed && computed.material === materialJson ? computed : null
}

/**
 * 必要数（育成ぶん + クラススコアぶん）を返す。
 * サーヴァントの状態を読み込んだあと、と状態が変わるたびに育成ぶんを求め直し、値が変われば保存する
 * （育成ぶんがまだ無い端末の移行を兼ねる）。目標が無ければ素材データを取得せずに空で確定する。
 * 素材データの取得中と取得失敗の間は、旧値があれば合算済みとして読む。
 * 素材データを読み込み済みの画面（育成計算機）は `materials` を渡し、取得し直さない。
 */
export const useRequiredMaterials = (materials?: MaterialsForServants): RequiredMaterialsState => {
  const { materialJson, materialLoaded, storedServant, legacyResult, classScoreState, loaded } = useStoredNeeds()
  const forCurrent = useServantResultRecompute(materialLoaded, materialJson, materials)

  // 読み込んだときのサーヴァントの状態。これから変わったら、保存済みの育成ぶんを今の値とみなさない。
  const [firstMaterial, setFirstMaterial] = useState<string | null>(null)
  if (materialLoaded && firstMaterial === null) setFirstMaterial(materialJson)
  const unchanged = materialLoaded && (firstMaterial === null || firstMaterial === materialJson)

  return useMemo<RequiredMaterialsState>(() => {
    // 求めた値は保存してあるので、保存値（あとから Calculate などで書かれた値を含む）を優先して読む。
    const computedServant = forCurrent?.status === 'done' ? (storedServant ?? forCurrent.value) : null
    const servantCurrent = computedServant !== null || (storedServant !== null && unchanged)
    const resolved = resolveRequiredMaterials({
      servantResult: computedServant ?? storedServant,
      servantCurrent,
      legacyResult,
      classScoreState,
    })
    return {
      ...resolved,
      loaded,
      computedServant,
      stale: forCurrent?.status === 'error' && !servantCurrent,
      classScoreState,
    }
  }, [forCurrent, unchanged, storedServant, legacyResult, classScoreState, loaded])
}

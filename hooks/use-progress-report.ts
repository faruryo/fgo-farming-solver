'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { PeriodSummary, ProgressResponse } from '../lib/progress/types'
import type { ChaldeaState } from './create-chaldea-state'
import type { Drops } from '../lib/get-drops'
import { computeForwardProgress, computeEffortLaps } from '../lib/progress/lap-value'
import { computeItemThroughput } from '../lib/progress/throughput'
import { finalizeBaselineSummary } from '../lib/progress/finalize-baseline'
import {
  selectBestWindow,
  WINDOW_ORDER,
  type WindowKey,
  type WindowLapValues,
} from '../lib/progress/select-baseline'
import { resolveStockBuffer, type PartialStockBuffer, type SurplusThreshold } from '../lib/quest-efficiency'

const readJson = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const buildCurrentState = (totalAp: number | null) => ({
  chaldea: readJson<ChaldeaState>('material'),
  itemCounts: readJson<Record<string, string | number>>('items'),
  checkedQuests: readJson<string[]>('quests'),
  totalAp,
})

export type UseProgressReport = {
  current: PeriodSummary | null
  loading: boolean
  error: string | null
}

export const useProgressReport = (
  totalAp: number | null,
  drops?: Drops | null
): UseProgressReport => {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (userId == null && process.env.NODE_ENV !== 'development') return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/progress', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ current: buildCurrentState(totalAp) }),
          signal,
        })
        if (!res.ok) throw new Error(`status ${res.status}`)
        setData((await res.json()) as ProgressResponse)
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'unknown')
      } finally {
        setLoading(false)
      }
    },
    [userId, totalAp]
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // 進捗指標をクライアント算出する。比較基準は d30/d60/d90 の3候補それぞれについて
  // forwardLaps/effortLaps を算出したうえで、design.md D2 のアルゴリズム
  // (forwardPerDay 最大 → 無ければ effortPerDay 最大)で1候補を選定する
  // (selectBestWindow、design.md D2b: 選定はここに一本化し、表示側では再選定しない)。
  //   - tier の主指標: forwardLaps(バッファ込み実効不足の周回換算、消費中立)。
  //     drops があれば lap-value.ts の computeForwardProgress で算出する。現在所持を
  //     過去所持で下限クランプしてから合算するため、育成消費が純増分を目減りさせる
  //     ことはなく常に非負(周回獲得のみが計上される、design.md D1)。
  //   - 補完指標: effortLaps(全獲得の周回換算、QP除外)。forwardLaps が無い/0の
  //     とき tier を補完する(design.md D3/D4)。
  //   - itemsFarmed/itemsConsumed(個数集計)は表示専用として維持。
  // pastPosession が無い場合(初期データや dev モック)は元の値を保持。
  const current = useMemo<PeriodSummary | null>(() => {
    if (!data) return null

    const posession = readJson<Record<string, number>>('posession') ?? {}
    const targets = readJson<Record<string, number>>('material/result') ?? {}
    const selectedQuestIds = readJson<string[]>('quests') ?? []
    const stockEnabled = readJson<boolean>('efficiency/stockEnabled') ?? false
    const rawStockBuffer = readJson<PartialStockBuffer>('efficiency/stockBuffer')
    const legacySurplusThreshold = readJson<SurplusThreshold>('efficiency/surplusThreshold')
    const stockBuffer = resolveStockBuffer(rawStockBuffer, legacySurplusThreshold)

    // 各窓(d30/d60/d90)ごとに前進周回・AP相当・労力周回を算出する。drops が無ければ
    // 全窓とも未算出のまま(selectBestWindow が d30 優先のフォールバック選定を行う)。
    const lapValuesByWindow: Partial<Record<WindowKey, WindowLapValues>> = {}
    if (drops && drops.items.length > 0) {
      for (const key of WINDOW_ORDER) {
        const summary = data.periods[key]
        if (!summary || !summary.pastPosession) continue
        const forward = computeForwardProgress({
          drops,
          selectedQuestIds,
          targets,
          currentPosession: posession,
          pastPosession: summary.pastPosession,
          stockBuffer,
          stockEnabled,
        })
        const effortLaps = computeEffortLaps(
          drops,
          selectedQuestIds,
          summary.pastPosession,
          posession
        )
        lapValuesByWindow[key] = {
          forwardLaps: forward?.forwardLaps,
          forwardApEquivalent: forward?.forwardApEquivalent,
          effortLaps,
        }
      }
    }

    const baseline = selectBestWindow(data.periods, lapValuesByWindow)
    if (!baseline || !baseline.pastPosession) return baseline

    const { itemsFarmed, itemsConsumed } = computeItemThroughput(
      baseline.pastPosession,
      posession
    )
    const lv = lapValuesByWindow[baseline.period] ?? {}

    return finalizeBaselineSummary(baseline, {
      itemsFarmed,
      itemsConsumed,
      forwardLaps: lv.forwardLaps,
      forwardApEquivalent: lv.forwardApEquivalent,
      effortLaps: lv.effortLaps,
    })
  }, [data, drops])

  return { current, loading, error }
}

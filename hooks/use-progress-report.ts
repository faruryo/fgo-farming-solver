'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { ProgressResponse } from '../lib/progress/types'
import type { ChaldeaState } from './create-chaldea-state'
import type { Drops } from '../lib/get-drops'
import { computeForwardProgress, computeEffortLaps } from '../lib/progress/lap-value'
import { computeItemThroughput } from '../lib/progress/throughput'
import { finalizeBaselineSummary } from '../lib/progress/finalize-baseline'
import { selectBaseline } from '../lib/progress/select-baseline'
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
  data: ProgressResponse | null
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

  // 進捗指標をクライアント算出する。比較基準は最古の存在スナップショット1つ
  // (selectBaseline)のみ。
  //   - tier の主指標: forwardLaps(バッファ込み実効不足の周回換算、消費中立)。
  //     drops があれば lap-value.ts の computeForwardProgress で算出する。現在所持を
  //     過去所持で下限クランプしてから合算するため、育成消費が純増分を目減りさせる
  //     ことはなく常に非負(周回獲得のみが計上される、design.md D1)。
  //   - 補完指標: effortLaps(全獲得の周回換算、QP除外)。forwardLaps が無い/0の
  //     とき tier を補完する(design.md D3/D4)。
  //   - itemsFarmed/itemsConsumed(個数集計)は表示専用として維持。
  // pastPosession が無い場合(初期データや dev モック)は元の値を保持。
  const enriched = useMemo<ProgressResponse | null>(() => {
    if (!data) return null

    const baseline = selectBaseline(data.periods)
    if (!baseline || !baseline.pastPosession) return data

    const posession = readJson<Record<string, number>>('posession') ?? {}
    const { itemsFarmed, itemsConsumed } = computeItemThroughput(
      baseline.pastPosession,
      posession
    )

    // 前進周回・AP相当・労力周回は drops(ドロップ率)が必要。無ければ未算出のまま。
    let forwardLaps: number | undefined
    let forwardApEquivalent: number | undefined
    let effortLaps: number | undefined
    if (drops && drops.items.length > 0) {
      const targets = readJson<Record<string, number>>('material/result') ?? {}
      const selectedQuestIds = readJson<string[]>('quests') ?? []
      const stockEnabled = readJson<boolean>('efficiency/stockEnabled') ?? false
      const rawStockBuffer = readJson<PartialStockBuffer>('efficiency/stockBuffer')
      const legacySurplusThreshold = readJson<SurplusThreshold>('efficiency/surplusThreshold')
      const stockBuffer = resolveStockBuffer(rawStockBuffer, legacySurplusThreshold)

      const forward = computeForwardProgress({
        drops,
        selectedQuestIds,
        targets,
        currentPosession: posession,
        pastPosession: baseline.pastPosession,
        stockBuffer,
        stockEnabled,
      })
      if (forward) {
        forwardLaps = forward.forwardLaps
        forwardApEquivalent = forward.forwardApEquivalent
      }
      effortLaps = computeEffortLaps(drops, selectedQuestIds, baseline.pastPosession, posession)
    }

    const finalized = finalizeBaselineSummary(baseline, {
      itemsFarmed,
      itemsConsumed,
      forwardLaps,
      forwardApEquivalent,
      effortLaps,
    })

    return {
      ...data,
      periods: { ...data.periods, [baseline.period]: finalized },
    }
  }, [data, drops])

  return { data: enriched, loading, error }
}

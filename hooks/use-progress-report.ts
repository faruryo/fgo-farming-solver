'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { ProgressResponse } from '../lib/progress/types'
import type { ChaldeaState } from './create-chaldea-state'
import type { Drops } from '../lib/get-drops'
import { buildNeedByApiItemId, solveTotals } from '../lib/progress/compute-reduction'
import { computeItemThroughput } from '../lib/progress/throughput'
import { finalizeBaselineSummary } from '../lib/progress/finalize-baseline'
import { selectBaseline } from '../lib/progress/select-baseline'

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
  //   - tier の主指標: 素材スループット(獲得+育成投入の個数, QP除外)。ソルバー不要で
  //     pastPosession と現在 posession から算出。育成に素材を使った日も none にしない。
  //   - 副指標: reducedAp(目標固定の残りAP減少)。drops があれば再ソルブで算出し、>0 の
  //     日のみ表示する参考値(tier は駆動しない)。
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

    // 副指標 reducedAp は drops(ソルバー)が必要。無ければ未算出のまま。
    let reducedAp: number | undefined
    let reducedLap: number | undefined
    if (drops && drops.items.length > 0) {
      const targets = readJson<Record<string, number>>('material/result') ?? {}
      const quests = readJson<string[]>('quests') ?? []
      const now = solveTotals(drops, buildNeedByApiItemId(targets, posession, drops), quests)
      const past = solveTotals(
        drops,
        buildNeedByApiItemId(targets, baseline.pastPosession, drops),
        quests
      )
      reducedAp = past.totalAp - now.totalAp
      reducedLap = past.totalLap - now.totalLap
    }

    const finalized = finalizeBaselineSummary(baseline, {
      itemsFarmed,
      itemsConsumed,
      reducedAp,
      reducedLap,
    })

    return {
      ...data,
      periods: { ...data.periods, [baseline.period]: finalized },
    }
  }, [data, drops])

  return { data: enriched, loading, error }
}

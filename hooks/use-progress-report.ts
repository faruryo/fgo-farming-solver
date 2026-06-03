'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { PeriodSummary, ProgressResponse } from '../lib/progress/types'
import type { ChaldeaState } from './create-chaldea-state'
import type { Drops } from '../lib/get-drops'
import { buildNeedByApiItemId, solveTotals } from '../lib/progress/compute-reduction'
import { classifyTier } from '../lib/progress/tier'

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

const yenFromAp = (ap: number): number => Math.round((ap / 144 / 168) * 10000)

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

  // 「アイテム入手による残りの減少」を方式1(目標を現在で固定して再ソルブ)で
  // クライアント算出し、reducedAp 確定後に tier / zero_progress を再判定する。
  // pastPosession が無い期間(初期データや dev モック)はサーバ/モックの値を保持。
  const enriched = useMemo<ProgressResponse | null>(() => {
    if (!data) return null
    if (!drops || drops.items.length === 0) return data

    const targets = readJson<Record<string, number>>('material/result') ?? {}
    const posession = readJson<Record<string, number>>('posession') ?? {}
    const quests = readJson<string[]>('quests') ?? []
    const now = solveTotals(
      drops,
      buildNeedByApiItemId(targets, posession, drops),
      quests
    )

    const finalize = (p: PeriodSummary | null): PeriodSummary | null => {
      if (!p || !p.pastPosession) return p
      const past = solveTotals(
        drops,
        buildNeedByApiItemId(targets, p.pastPosession, drops),
        quests
      )
      const reducedAp = past.totalAp - now.totalAp
      const reducedLap = past.totalLap - now.totalLap
      const tier = p.fallback ? p.tier : classifyTier(reducedAp, p.elapsedMinutes)
      const fallback =
        p.fallback ??
        (reducedAp <= 0 && p.growthTotal <= 0 && p.newServantCount === 0
          ? 'zero_progress'
          : null)
      return { ...p, reducedAp, reducedLap, reducedYen: yenFromAp(reducedAp), tier, fallback }
    }

    return {
      ...data,
      periods: {
        previous: finalize(data.periods.previous),
        week: finalize(data.periods.week),
        month: finalize(data.periods.month),
      },
    }
  }, [data, drops])

  return { data: enriched, loading, error }
}

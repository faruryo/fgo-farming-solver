import { useCallback, useEffect, useRef, useState } from 'react'
import { Campaign } from '../interfaces/fgodrop'
import { useActiveCampaigns } from './use-active-campaigns'

export type DashboardSortMode = 'laps' | 'ap'

const isSortMode = (v: unknown): v is DashboardSortMode => v === 'laps' || v === 'ap'

/**
 * セクションごとに「周回数優先 / AP優先」のソートモードを保持する hook。
 *
 * - LocalStorage の `storageKey` に保存値があればそれを採用する。
 * - 保存値が無い初回アクセス時のみ、`campaigns` から導出される現在アクティブな AP
 *   キャンペーン数が 1 件以上なら `ap`、無ければ `laps` を一度だけ採用する。
 * - 以降はユーザー操作 (`setMode`) でのみ更新され、その時点で LS に書き込む。
 */
export const useDashboardSortMode = (
  storageKey: string,
  campaigns: Campaign[] | undefined,
): [DashboardSortMode, (next: DashboardSortMode) => void] => {
  const { activeCampaigns } = useActiveCampaigns(campaigns)
  const [mode, setMode] = useState<DashboardSortMode>('laps')
  const [hydrated, setHydrated] = useState(false)
  const [hasStored, setHasStored] = useState(false)
  const autoAppliedRef = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (isSortMode(raw)) {
        setMode(raw)
        setHasStored(true)
      }
    } catch (e) {
      console.error(e)
    }
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated || hasStored || autoAppliedRef.current) return
    if (campaigns === undefined) return
    autoAppliedRef.current = true
    setMode(activeCampaigns.length > 0 ? 'ap' : 'laps')
  }, [hydrated, hasStored, campaigns, activeCampaigns.length])

  const update = useCallback(
    (next: DashboardSortMode) => {
      setMode(next)
      setHasStored(true)
      try {
        localStorage.setItem(storageKey, next)
      } catch (e) {
        console.error(e)
      }
    },
    [storageKey],
  )

  return [mode, update]
}

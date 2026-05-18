import { useEffect, useMemo, useState } from 'react'
import { Campaign } from '../interfaces/fgodrop'
import { filterActiveCampaigns } from '../lib/solver'

const BUCKET_SIZE_MS = 30 * 60 * 1000 // 30-minute time buckets

const floorToBucket = (ms: number) => Math.floor(ms / BUCKET_SIZE_MS) * BUCKET_SIZE_MS

/**
 * 30-minute bucketed "now" timestamp. Re-evaluated on bucket transitions so
 * downstream useMemos that depend on it naturally invalidate when a campaign
 * crosses its `validFrom` or `validTo` boundary.
 */
const useBucketedNowSec = (): number => {
  const [bucketMs, setBucketMs] = useState(() => floorToBucket(Date.now()))

  useEffect(() => {
    const tick = () => {
      const nextBucket = floorToBucket(Date.now())
      setBucketMs((prev) => (prev === nextBucket ? prev : nextBucket))
    }
    // Realign to actual wall-clock minute boundaries (then poll every minute).
    // Polling at 1-minute resolution keeps the wakeup cheap while ensuring
    // a 30-minute bucket transition is observed within ~1 minute of crossing.
    const now = Date.now()
    const msUntilNextMinute = 60_000 - (now % 60_000)
    let intervalId: ReturnType<typeof setInterval> | null = null
    const timeoutId = setTimeout(() => {
      tick()
      intervalId = setInterval(tick, 60_000)
    }, msUntilNextMinute)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  return Math.floor(bucketMs / 1000)
}

export type ActiveCampaignsState = {
  activeCampaigns: Campaign[]
  /** Stable digest reflecting the active campaign set, suitable as a useMemo dep. */
  digest: string
  /** The bucketed "now" used to filter, in Unix seconds. */
  nowSec: number
}

export const useActiveCampaigns = (campaigns: Campaign[] | undefined): ActiveCampaignsState => {
  const nowSec = useBucketedNowSec()

  return useMemo(() => {
    const list = campaigns ?? []
    const active = filterActiveCampaigns(list, nowSec)
    const digest = active
      .map((c) => `${c.id}:${c.calcType}:${c.value}`)
      .sort()
      .join('|')
    return { activeCampaigns: active, digest, nowSec }
  }, [campaigns, nowSec])
}

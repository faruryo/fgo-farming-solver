import { useState, useEffect } from 'react'
import { Drops } from '../lib/get-drops'

// Module-level cache shared across components in the same session.
// Multiple consumers (e.g., NearGoalSection and RecommendedQuest) end up
// calling /api/drops independently; without this they each fire their own
// fetch. We dedupe through a single in-flight promise.
const EMPTY_DROPS: Drops = { items: [], quests: [], drop_rates: [], campaigns: [] }
let cachedPromise: Promise<Drops> | null = null

// Exported for testing — see hooks/use-drops.test.ts.
export const fetchDrops = (): Promise<Drops> => {
  if (cachedPromise) return cachedPromise
  cachedPromise = fetch('/api/drops')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`/api/drops returned ${response.status}`)
      }
      const json = (await response.json()) as Drops
      return {
        items: json.items ?? [],
        quests: json.quests ?? [],
        drop_rates: json.drop_rates ?? [],
        campaigns: json.campaigns ?? [],
      }
    })
    .catch((e) => {
      // Reset so the next caller can try again — caching an error promise
      // would permanently break drops loading for the whole session.
      cachedPromise = null
      throw e
    })
  return cachedPromise
}

// Test/dev helper to reset the module cache. Not exported through the
// component-facing surface to keep the API minimal.
export const __resetDropsCacheForTest = () => {
  cachedPromise = null
}

export const useDrops = () => {
  const [data, setData] = useState<Drops>(EMPTY_DROPS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchDrops()
      .then((drops) => {
        if (!cancelled) setData(drops)
      })
      .catch((e) => {
        console.error(e)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...data, isLoading }
}

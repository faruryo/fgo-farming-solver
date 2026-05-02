import { useState, useEffect } from 'react'
import { DashboardMeta } from '../lib/master-data/types'

export const useDashboardMeta = () => {
  const [data, setData] = useState<DashboardMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/dashboard-meta')
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard meta')
        }
        const json: DashboardMeta = await response.json()
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    void fetchData()
  }, [])

  return { data, isLoading, error }
}

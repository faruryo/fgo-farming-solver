import { useState, useEffect } from 'react'
import { Result, BothResult } from '../interfaces/api'

export function useRecentResult() {
  const [result, setResult] = useState<Result | BothResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecent() {
      try {
        let id = ''
        // Try getting from localStorage
        const url = localStorage.getItem('farming/results')
        if (url && url.startsWith('/farming/results/')) {
          id = url.split('/farming/results/')[1]
        }
        
        // If no local history, try fetching from api
        if (!id) {
          const res = await fetch('/api/farming/history')
          if (res.ok) {
            const json = await res.json()
            const history = json as { id: string }[]
            if (history && Array.isArray(history) && history.length > 0) {
              id = history[0].id
            }
          }
        }

        if (!id) {
          setLoading(false)
          return
        }

        const res = await fetch(`/api/farming/results/${id}`)
        if (res.ok) {
          const dataJson = await res.json()
          const data = dataJson as Result | BothResult
          setResult(data)
        }
      } catch (e) {
        console.error('Failed to fetch recent result', e)
      } finally {
        setLoading(false)
      }
    }
    void fetchRecent()
  }, [])

  return { result, loading }
}

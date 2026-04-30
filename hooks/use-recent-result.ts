import { useState, useEffect } from 'react'
import { Result, BothResult } from '../interfaces/api'

export function useRecentResult() {
  const [result, setResult] = useState<Result | BothResult | null>(null)
  const [historyCount, setHistoryCount] = useState(0)
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
        
        // Fetch history count and first ID
        const resHistory = await fetch('/api/farming/history')
        if (resHistory.ok) {
          const json = await resHistory.json()
          const history = json as { id: string }[]
          setHistoryCount(history.length)
          if (!id && history && history.length > 0) {
            id = history[0].id
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

  return { result, historyCount, loading }
}

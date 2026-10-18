import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Result, BothResult } from '../interfaces/api'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'

/** この端末に記録された直近の結果 URL から結果 ID を取り出す。無ければ空文字。 */
const readStoredResultId = (): string => {
  const url = localStorage.getItem(STORAGE_KEYS.FARMING_RESULTS)
  if (url && url.startsWith('/farming/results/')) {
    return url.split('/farming/results/')[1]
  }
  return ''
}

/** 計算履歴を取得する。失敗時は null。 */
const fetchHistory = async (): Promise<{ id: string }[] | null> => {
  const res = await fetch('/api/farming/history')
  if (!res.ok) return null
  const json: unknown = await res.json()
  return json as { id: string }[]
}

const fetchResult = async (id: string): Promise<Result | BothResult | null> => {
  const res = await fetch(`/api/farming/results/${id}`)
  if (!res.ok) return null
  const json: unknown = await res.json()
  return json as Result | BothResult
}

export function useRecentResult() {
  const { status } = useSession()
  const [result, setResult] = useState<Result | BothResult | null>(null)
  const [historyCount, setHistoryCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ログイン状態の確認中は何も読まない。確認中に読み終えると、件数 0 を前提にした
    // 表示（FarmingWizard など）がログインユーザーにも一瞬出て消えるため。
    if (status === 'loading') return
    // 計算履歴はログインユーザーだけのもの。未ログインでは取得せず、
    // この端末に記録された結果の URL からだけ読む。
    const isAuthenticated = status === 'authenticated'
    let cancelled = false

    async function fetchRecent() {
      // ログインから未ログインに変わったときに履歴由来の結果と件数を残さないよう、毎回捨ててから読み直す。
      setResult(null)
      setHistoryCount(0)
      setLoading(true)
      try {
        let id = readStoredResultId()

        if (isAuthenticated) {
          const history = await fetchHistory()
          if (cancelled) return
          if (history) {
            setHistoryCount(history.length)
            if (!id && history.length > 0) id = history[0].id
          }
        }

        if (!id) return

        const data = await fetchResult(id)
        if (!cancelled && data) setResult(data)
      } catch (e) {
        console.error('Failed to fetch recent result', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchRecent()
    return () => {
      cancelled = true
    }
  }, [status])

  return { result, historyCount, loading: loading || status === 'loading' }
}

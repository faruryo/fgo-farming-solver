import { saveProgressSnapshot } from '../progress/snapshot-client'
import { STORAGE_KEYS } from '../constants/storage-keys'

/**
 * `items=`(または `itemsStock=`)クエリが送信可能な内容を持つか。
 * `/farming` の `inputToQuery` が返す `items` 文字列（空なら全欄未入力）に対して判定する。
 */
export const hasSubmittableItems = (itemsQuery: string): boolean =>
  itemsQuery.trim() !== ''

/** 周回対象クエストが最低1件選択されているか。 */
export const hasSelectedQuests = (checkedQuests: string[]): boolean =>
  checkedQuests.length > 0

const hasId = (arg: unknown): arg is { id: unknown } =>
  typeof arg == 'object' && arg != null && 'id' in arg

/**
 * localStorage に保存された既定公開設定を boolean に正規化してパースする。
 * 未設定（null）、JSON パースエラー、または非 boolean 値（例: 文字列 "false" やオブジェクト）の場合は
 * 既定値 true（公開）を返す。
 */
export const parseStoredDefaultPublic = (stored: string | null): boolean => {
  if (stored === null) return true
  try {
    const parsed: unknown = JSON.parse(stored)
    return typeof parsed === 'boolean' ? parsed : true
  } catch {
    return true
  }
}

/**
 * `/api/solve` へ送信し、成功時は結果を `localStorage['farming/results']` へ記録して
 * 結果ページへ遷移する。`/farming`(手入力)・`/material/result`(直接送信)の両方から
 * 共有される送信 I/O 境界。バリデーション（送信可否の判断）は `hasSubmittableItems` /
 * `hasSelectedQuests` として呼び出し側で行い、ここでは行わない。
 */
export const submitSolve = async (
  params: URLSearchParams,
  router: { push: (url: string) => void }
): Promise<void> => {
  if (!params.has('isPublic')) {
    params.set('isPublic', 'true')
  }
  const url = `/api/solve?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    router.push('/500')
    return
  }
  const result: unknown = await res.json()
  if (hasId(result) && typeof result.id == 'string') {
    const isPublic = (result as { isPublic?: boolean }).isPublic
    if (params.get('isPublic') === 'false' && isPublic === true) {
      router.push('/500')
      return
    }

    const resultUrl = `/farming/results/${result.id}`
    localStorage.setItem(STORAGE_KEYS.FARMING_RESULTS, resultUrl)
    // Notify change tracking (dirty metadata / auto-save) — direct
    // setItem is invisible to the cloud-sync modification listener.
    window.dispatchEvent(
      new CustomEvent('ls-sync', { detail: { key: STORAGE_KEYS.FARMING_RESULTS } })
    )
    // Persist a full-state progress snapshot (incl. material) for this run.
    // Fire-and-forget so it never blocks navigation to the result page.
    void saveProgressSnapshot()
    router.push(resultUrl)
  } else {
    router.push('/500')
  }
}

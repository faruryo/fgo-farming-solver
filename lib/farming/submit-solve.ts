import { saveProgressSnapshot } from '../progress/snapshot-client'

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
 * `/api/solve` へ送信し、成功時は結果を `localStorage['farming/results']` へ記録して
 * 結果ページへ遷移する。`/farming`(手入力)・`/material/result`(直接送信)の両方から
 * 共有される送信 I/O 境界。バリデーション（送信可否の判断）は `hasSubmittableItems` /
 * `hasSelectedQuests` として呼び出し側で行い、ここでは行わない。
 */
export const submitSolve = async (
  params: URLSearchParams,
  router: { push: (url: string) => void }
): Promise<void> => {
  const url = `/api/solve?${params.toString()}`
  const result = await fetch(url).then((res) => res.json() as unknown)
  if (hasId(result) && typeof result.id == 'string') {
    const resultUrl = `/farming/results/${result.id}`
    localStorage.setItem('farming/results', resultUrl)
    // Notify change tracking (dirty metadata / auto-save) — direct
    // setItem is invisible to the cloud-sync modification listener.
    window.dispatchEvent(
      new CustomEvent('ls-sync', { detail: { key: 'farming/results' } })
    )
    // Persist a full-state progress snapshot (incl. material) for this run.
    // Fire-and-forget so it never blocks navigation to the result page.
    void saveProgressSnapshot()
    router.push(resultUrl)
  } else {
    router.push('/500')
  }
}

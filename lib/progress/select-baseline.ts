import type { ProgressResponse, PeriodSummary } from './types'

// 比較基準は「1ヶ月前までで存在する一番古いスナップショット」を1つだけ採用する
// (3期間タブを廃止)。優先順は古い順: 1ヶ月前 → 1週間前 → 前回。
// 実比較できる(fallback の無い)期間を最優先し、無ければ最も古い期間の
// フォールバック(first_time など)を返してメッセージ表示に使う。
const OLDEST_FIRST: Array<keyof ProgressResponse['periods']> = [
  'month',
  'week',
  'previous',
]

export const selectBaseline = (
  periods: ProgressResponse['periods'] | undefined | null
): PeriodSummary | null => {
  if (!periods) return null
  const ordered = OLDEST_FIRST.map((k) => periods[k]).filter(
    (p): p is PeriodSummary => p != null
  )
  return ordered.find((p) => !p.fallback) ?? ordered[0] ?? null
}

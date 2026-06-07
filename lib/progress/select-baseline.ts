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

// 比較に使える中身があるか。reducedAp 用の過去所持(pastPosession)か、material 由来の
// 進捗(育成総量・新規/成長サーヴァント)のいずれかを持てば「実比較できる」。
// material も posession も無い degenerate スナップショット(サーバが fallback 化し損ねた
// 場合の保険)はここで弾く。
const hasComparableContent = (p: PeriodSummary): boolean =>
  p.pastPosession != null ||
  p.growthTotal > 0 ||
  p.newServantCount > 0 ||
  p.servantGrowth.length > 0

// 実際に過去スナップショットと比較できた period か。zero_progress(変化ゼロ)でも
// pastPosession や snapshotCreatedAt は baseline から引き継がれるため真になる。
// no_snapshot_for_period / first_time は比較対象が無いので偽。
const isRealComparison = (p: PeriodSummary): boolean =>
  hasComparableContent(p) || p.snapshotCreatedAt != null

export const selectBaseline = (
  periods: ProgressResponse['periods'] | undefined | null
): PeriodSummary | null => {
  if (!periods) return null
  const ordered = OLDEST_FIRST.map((k) => periods[k]).filter(
    (p): p is PeriodSummary => p != null
  )
  return (
    ordered.find((p) => !p.fallback && hasComparableContent(p)) ??
    ordered.find((p) => !p.fallback) ??
    // fallback 付きでも「実際に比較できた」period(zero_progress 等)を、
    // no_snapshot_for_period / first_time より優先する。enriched が baseline に
    // zero_progress を付けた後、パネルが再度 selectBaseline する際に最古の
    // no_snapshot へ誤って落ちるのを防ぐ。
    ordered.find((p) => isRealComparison(p)) ??
    ordered[0] ??
    null
  )
}

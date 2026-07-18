import type { ProgressResponse, PeriodSummary } from './types'

export type WindowKey = 'd30' | 'd60' | 'd90'

// 短い窓を優先する同値タイブレークのため、比較は必ずこの順で走査する。
export const WINDOW_ORDER: WindowKey[] = ['d30', 'd60', 'd90']

// 各窓について、クライアントが lap-value.ts で算出した前進周回/労力周回の生値。
// drops 未取得時など未算出の場合は undefined のまま渡してよい。
export type WindowLapValues = {
  forwardLaps?: number
  forwardApEquivalent?: number
  effortLaps?: number
}

type Candidate = {
  key: WindowKey
  summary: PeriodSummary
  forwardPerDay?: number
  effortPerDay?: number
}

// design.md D2 準拠の周/日正規化。elapsedMinutes<=0 でも laps===0 なら 0 とみなす
// (経過ゼロで前進も無い = 変化ゼロ)。laps が未算出(undefined)なら常に undefined。
const perDay = (laps: number | undefined, elapsedMinutes: number): number | undefined => {
  if (laps != null && elapsedMinutes > 0) return laps / (elapsedMinutes / 1440)
  return laps === 0 ? 0 : undefined
}

// 比較対象にできるか: pastPosession が無い候補(degenerate/no_snapshot_for_period/
// first_time)は forwardLaps/effortLaps を算出できない(lap-value.ts が null/0 を
// 返すのみ)ため、比較選定から除外する。
const isComparable = (summary: PeriodSummary | null): summary is PeriodSummary =>
  summary != null && summary.pastPosession != null

// 30/60/90日候補のうち、前進周回(forwardLaps)を周/日に正規化した値(forwardPerDay)が
// 最大の候補を採用する。forwardPerDay が正の候補が1つも無ければ、労力周回の
// perDay(effortPerDay)が最大の候補を採用する(design.md D2)。
//   - forward系とeffort系は指標を跨いで比較しない。
//   - 同値タイは短い窓を優先する(d30 > d60 > d90)。
//   - pastPosession が無い候補は選定対象から除外する。全候補が除外対象なら、
//     そのうち1つ(d30優先)をフォールバック表示用にそのまま返す。
export const selectBestWindow = (
  periods: ProgressResponse['periods'] | undefined | null,
  lapValuesByWindow: Partial<Record<WindowKey, WindowLapValues>> = {}
): PeriodSummary | null => {
  if (!periods) return null

  const comparable: Candidate[] = WINDOW_ORDER.filter((key) =>
    isComparable(periods[key])
  ).map((key) => {
    const summary = periods[key] as PeriodSummary
    const lv = lapValuesByWindow[key] ?? {}
    return {
      key,
      summary,
      forwardPerDay: perDay(lv.forwardLaps, summary.elapsedMinutes),
      effortPerDay: perDay(lv.effortLaps, summary.elapsedMinutes),
    }
  })

  if (comparable.length === 0) {
    // 実比較できる候補が無い。d30優先で最初に存在する候補(初回登録等の
    // フォールバック表示用)をそのまま返す。
    for (const key of WINDOW_ORDER) {
      const summary = periods[key]
      if (summary != null) return summary
    }
    return null
  }

  const positiveForward = comparable.filter((c) => (c.forwardPerDay ?? 0) > 0)
  const pool = positiveForward.length > 0 ? positiveForward : comparable
  const metricOf = (c: Candidate): number =>
    positiveForward.length > 0 ? (c.forwardPerDay as number) : (c.effortPerDay ?? -Infinity)

  let best = pool[0]
  for (const c of pool.slice(1)) {
    // WINDOW_ORDER 順に走査しているため、同値(以下)の場合は先勝ち(短い窓優先)。
    if (metricOf(c) > metricOf(best)) best = c
  }

  return best.summary
}

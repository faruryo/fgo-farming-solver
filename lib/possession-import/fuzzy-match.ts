/** 品目名OCR結果を既知アイテム名辞書へファジーマッチするロジック */

const levenshtein = (a: string, b: string): number => {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      prevDiag = tmp
    }
  }
  return dp[n]
}

/** 0(完全不一致)〜1(完全一致)の類似度 */
export const nameSimilarity = (a: string, b: string): number => {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

export type MatchTarget = { atlasId: number; name: string }

export type MatchResult = {
  atlasId: number
  name: string
  score: number
}

/** OCRで読み取った品目名文字列に最も近い既知アイテムを返す */
export const findBestNameMatch = (
  ocrName: string,
  targets: MatchTarget[]
): MatchResult | null => {
  let best: MatchResult | null = null
  for (const target of targets) {
    const score = nameSimilarity(ocrName, target.name)
    if (!best || score > best.score) {
      best = { atlasId: target.atlasId, name: target.name, score }
    }
  }
  return best
}

/** これを下回るマッチは識別失敗として扱う */
export const MIN_ACCEPTABLE_NAME_SCORE = 0.5

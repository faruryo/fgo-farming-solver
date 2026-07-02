const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * 期限までの残り時間を簡易な日本語表記にする（分単位までの精度で十分なため秒は扱わない）。
 */
export const formatCountdown = (deadlineMs: number, nowMs: number): string => {
  const diff = deadlineMs - nowMs
  if (diff <= 0) return '期限切れ'

  const totalMinutes = Math.floor(diff / MINUTE_MS)
  const days = Math.floor(diff / DAY_MS)
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS)
  const minutes = totalMinutes % 60

  if (days > 0) return `残り ${days}日${hours}時間`
  if (hours > 0) return `残り ${hours}時間`
  return `残り ${minutes}分`
}

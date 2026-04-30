export const formatDuration = (targetTimestamp: number): string => {
  const now = Math.floor(Date.now() / 1000)
  const diff = targetTimestamp - now
  
  if (diff <= 0) return '終了'
  
  const days = Math.floor(diff / (24 * 3600))
  const hours = Math.floor((diff % (24 * 3600)) / 3600)
  
  if (days > 0) {
    return `あと ${days}日 ${hours}時間`
  }
  return `あと ${hours}時間`
}

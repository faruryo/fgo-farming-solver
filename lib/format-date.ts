const JST_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const formatDate = (isoStr?: string): string => {
  if (!isoStr) return ''
  try {
    const normalized = isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T')
    const withZ =
      normalized.endsWith('Z') || normalized.includes('+') ? normalized : `${normalized}Z`
    const d = new Date(withZ)
    if (isNaN(d.getTime())) return ''
    // formatToParts で月・日・時・分を個別に取得して整形
    const parts = JST_FORMATTER.formatToParts(d)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('month')}月${get('day')}日 ${get('hour')}:${get('minute')}`
  } catch {
    return ''
  }
}

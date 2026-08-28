const hasTimezone = (str: string): boolean => {
  if (str.endsWith('Z') || str.endsWith('z')) return true
  if (str.length < 13) return false
  const afterHour = str.slice(13)
  return afterHour.includes('+') || afterHour.includes('-')
}

export const parseUtcDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null
  try {
    const trimmed = dateStr.trim()
    if (!trimmed) return null
    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
    const withZ = hasTimezone(normalized) ? normalized : `${normalized}Z`
    const d = new Date(withZ)
    if (isNaN(d.getTime())) return null
    return d
  } catch {
    return null
  }
}

const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const formatDate = (isoStr?: string | null): string => {
  const d = parseUtcDate(isoStr)
  if (!d) return ''
  try {
    // formatToParts で月・日・時・分を個別に取得して整形
    const parts = LOCAL_DATE_FORMATTER.formatToParts(d)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('month')}月${get('day')}日 ${get('hour')}:${get('minute')}`
  } catch {
    return ''
  }
}

export const formatDate = (isoStr?: string): string => {
  if (!isoStr) return ''
  try {
    const normalized = isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T')
    const withZ = normalized.endsWith('Z') || normalized.includes('+') ? normalized : `${normalized}Z`
    const d = new Date(withZ)
    if (isNaN(d.getTime())) return ''
    const m = d.getMonth() + 1
    const day = d.getDate()
    const h = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    return `${m}月${day}日 ${h}:${min}`
  } catch {
    return ''
  }
}

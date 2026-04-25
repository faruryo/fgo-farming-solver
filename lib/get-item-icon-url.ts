export function getItemIconUrl(icon: string | undefined): string {
  if (!icon) return ''
  if (icon.startsWith('http')) return icon
  // fallback base URL
  return `https://static.atlasacademy.io/JP/Items/${icon}.png`
}

import { staticOrigin, region } from '../constants/atlasacademy'

export function getItemIconUrl(icon: string | undefined): string {
  if (!icon) return ''
  if (icon.startsWith('http')) return icon
  return `${staticOrigin}/${region}/Items/${icon}.png`
}

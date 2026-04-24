import { NiceServant } from '../interfaces/atlas-academy'
import { fetchJsonWithCache } from './cache'
import { getUrl } from './get-url'

export const getNiceServants = async (locale?: string, original = false) => {
  const url = getUrl('nice_servant', locale)
  const servants = await fetchJsonWithCache<NiceServant[]>(url)
  const filtered = servants.filter(
    (servant) =>
      ['normal', 'heroine'].includes(servant.type) && servant.collectionNo > 0
  )
  if (original) return filtered
  return filtered.map(({ id, name, className, collectionNo, type, rarity, extraAssets }) => ({
    id,
    name,
    className,
    collectionNo,
    type,
    rarity,
    extraAssets,
  })) as NiceServant[]
}

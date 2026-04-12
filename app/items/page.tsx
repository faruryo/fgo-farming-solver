import { getDrops } from '../../lib/get-drops'
import { getLocalItems } from '../../lib/get-local-items'
import { Index } from '../../components/items'

export const runtime = 'edge'

export default async function ItemsPage() {
  const locale = 'ja'
  const { items } = await getDrops()
  const localItems = await getLocalItems(items, locale)
  
  return <Index items={localItems} />
}

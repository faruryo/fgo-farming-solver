import { getDrops } from '../../../lib/get-drops'
import { getLocalQuests } from '../../../lib/get-local-quests'
import { getLocalItems } from '../../../lib/get-local-items'
import { Page } from '../../../components/items/item'
import { notFound } from 'next/navigation'

export const revalidate = 86400

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = 'ja'
  const { items, quests, drop_rates } = await getDrops()
  
  if (!items.some((item) => item.id == id)) {
    return notFound()
  }

  const [localItems, localQuests] = await Promise.all([
    getLocalItems(items, locale),
    getLocalQuests(quests, locale),
  ])

  return (
    <Page
      id={id}
      items={localItems}
      quests={localQuests}
      dropRates={drop_rates}
    />
  )
}

export const dynamicParams = true

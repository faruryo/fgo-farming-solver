import { getDrops } from '../../lib/get-drops'
import { getLocalQuests } from '../../lib/get-local-quests'
import { getLocalItems } from '../../lib/get-local-items'
import { Index } from '../../components/farming'

export const dynamic = 'force-dynamic'

export default async function FarmingPage() {
  const locale = 'ja' // TODO: locale handling
  const { items, quests } = await getDrops()
  const [localItems, localQuests] = await Promise.all([
    getLocalItems(items, locale),
    getLocalQuests(quests, locale),
  ])

  return (
    <Index
      items={localItems}
      quests={localQuests}
    />
  )
}

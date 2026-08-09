import { getItems } from '../../../lib/get-items'
import { getDrops } from '../../../lib/get-drops'
import { getLocalQuests } from '../../../lib/get-local-quests'
import { Result } from '../../../components/material/result'

export const dynamic = 'force-dynamic'

export default async function MaterialResultPage() {
  const locale = 'ja'
  const [items, drops] = await Promise.all([
    getItems(locale),
    getDrops(),
  ])
  const quests = await getLocalQuests(drops.quests, locale)
  return (
    <Result
      items={items}
      quests={quests}
      locale={locale}
    />
  )
}

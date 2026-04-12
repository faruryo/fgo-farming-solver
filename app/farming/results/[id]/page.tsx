/* eslint-disable */
import { getResult } from '../../../../lib/get-result'
import { getLocalQuests } from '../../../../lib/get-local-quests'
import { getLocalItems } from '../../../../lib/get-local-items'
import { Page } from '../../../../components/farming/result'
import { notFound } from 'next/navigation'
import { DBError } from '../../../../lib/dynamodb'


export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = 'ja' // TODO: locale handling

  try {
    const { items, quests, ...result } = await getResult(id)
    const [localItems, localQuests] = await Promise.all([
      getLocalItems(items, locale),
      getLocalQuests(quests, locale),
    ])

    const props = {
      items: localItems,
      quests: localQuests,
      ...result,
    } as any

    return (
      <Page {...props} />
    )
  } catch (e) {
    if (!(e instanceof DBError)) console.error(e)
    return notFound()
  }
}

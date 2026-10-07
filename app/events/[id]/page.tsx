import { getEventById } from '../../../lib/get-events'
import { getItems } from '../../../lib/get-items'
import { featuresFor, resolveEventSummary } from '../../../lib/event-features'
import { EventHubClient } from '../../../components/events/EventHubClient'
import { EventDataMissing } from '../../../components/events/EventDataMissing'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const eventId = Number(id)

  if (Number.isNaN(eventId)) {
    return <EventDataMissing />
  }

  const kvEvent = await getEventById(eventId)
  const summary = resolveEventSummary(eventId, kvEvent)

  if (!summary) {
    return <EventDataMissing eventId={eventId} />
  }

  const features = featuresFor(eventId, !!kvEvent)
  const items = features.includes('craft') ? await getItems('ja') : undefined

  return (
    <EventHubClient
      summary={summary}
      boxEvent={kvEvent ?? undefined}
      items={items}
      features={features}
    />
  )
}

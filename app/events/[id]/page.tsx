import { getEventById } from '../../../lib/get-events'
import { EventPlannerClient } from '../../../components/events/EventPlannerClient'
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

  const event = await getEventById(eventId)

  if (!event) {
    return <EventDataMissing eventId={eventId} />
  }

  return <EventPlannerClient event={event} />
}

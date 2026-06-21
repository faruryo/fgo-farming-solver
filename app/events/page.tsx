import { getEvents } from '../../lib/get-events'
import { EventListClient } from '../../components/events/EventListClient'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const { events, updatedAt } = await getEvents()

  return <EventListClient events={events} updatedAt={updatedAt} />
}

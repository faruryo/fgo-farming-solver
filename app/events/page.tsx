import { getEvents } from '../../lib/get-events'
import { mergeEventList } from '../../lib/event-features'
import { EventListClient } from '../../components/events/EventListClient'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const { events, updatedAt } = await getEvents()

  return <EventListClient events={mergeEventList(events)} updatedAt={updatedAt} />
}

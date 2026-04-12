import { getServants } from '../../lib/get-servants'
import { Index } from '../../components/servants/index'

export const runtime = 'edge'
export const revalidate = 1800

export default async function ServantsPage() {
  const locale = 'ja'
  const servants = await getServants(locale)

  return <Index servants={servants} locale={locale} />
}

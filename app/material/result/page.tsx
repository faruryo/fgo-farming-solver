import { getItems } from '../../../lib/get-items'
import { Result } from '../../../components/material/result'

export const runtime = 'edge'
export const revalidate = 1800

export default async function MaterialResultPage() {
  const locale = 'ja'
  const items = await getItems(locale)
  return <Result items={items} locale={locale} />
}

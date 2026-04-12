import { getNiceServants } from '../../lib/get-nice-servants'
import { getMaterialsForServants } from '../../lib/get-materials'
import { getItems } from '../../lib/get-items'
import { Index } from '../../components/material/index'

export const runtime = 'edge'
export const revalidate = 1800

export default async function MaterialPage() {
  const locale = 'ja'
  const [servants, materials, items] = await Promise.all([
    getNiceServants(locale),
    getMaterialsForServants(),
    getItems(locale),
  ])

  return (
    <Index
      servants={servants}
      materials={materials}
      items={items}
      locale={locale}
    />
  )
}

import { getNiceServants } from '../../../lib/get-nice-servants'
import { getMaterialsForServants } from '../../../lib/get-materials'
import { Material } from '../../../components/material/material'

export const revalidate = 1800

export default async function MaterialClassPage({
  params,
}: {
  params: Promise<{ className: string }>
}) {
  const { className } = await params
  const locale = 'ja'
  const [servants, materials] = await Promise.all([
    getNiceServants(locale),
    getMaterialsForServants(),
  ])

  return (
    <Material
      servants={servants}
      materials={materials}
      className={className}
      locale={locale}
    />
  )
}

export const dynamicParams = true

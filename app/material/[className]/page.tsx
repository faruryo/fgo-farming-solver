import { notFound } from 'next/navigation'
import { MaterialCatalogLoader } from '../../../components/material/catalog-loader'
import { isMaterialClassName, MATERIAL_CLASS_NAMES } from '../../../lib/material-catalog'

export default async function MaterialClassPage({
  params,
}: {
  params: Promise<{ className: string }>
}) {
  const { className } = await params
  if (!isMaterialClassName(className)) notFound()
  return <MaterialCatalogLoader className={className} />
}

export const dynamicParams = false
export const generateStaticParams = () => MATERIAL_CLASS_NAMES.map(className => ({ className }))

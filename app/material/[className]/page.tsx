import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MaterialCatalogLoader } from '../../../components/material/catalog-loader'
import { getClassName } from '../../../lib/class-names'
import { isMaterialClassName, MATERIAL_CLASS_NAMES } from '../../../lib/material-catalog'

export default async function MaterialClassPage({
  params,
}: Readonly<{
  params: Promise<{ className: string }>
}>) {
  const { className } = await params
  if (!isMaterialClassName(className)) notFound()
  return <MaterialCatalogLoader className={className} />
}

export const dynamicParams = false
export const generateStaticParams = () => MATERIAL_CLASS_NAMES.map(className => ({ className }))

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ className: string }>
}>): Promise<Metadata> {
  const { className } = await params
  if (!isMaterialClassName(className)) return {}
  return { title: `${getClassName(className)} | 育成素材計算機` }
}

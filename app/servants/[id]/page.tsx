import { getNiceServants } from '../../../lib/get-nice-servants'
import { getItems } from '../../../lib/get-items'
import { Page } from '../../../components/servants/servant'
import { notFound } from 'next/navigation'


export default async function ServantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = 'ja'
  const [servant, items] = await Promise.all([
    getNiceServants(locale, true).then((servants) =>
      servants.find(({ id: sid }) => sid.toString() == id)
    ),
    getItems(locale),
  ])

  if (!servant) {
    return notFound()
  }

  return <Page servant={servant} items={items} locale={locale} />
}

export const dynamicParams = true

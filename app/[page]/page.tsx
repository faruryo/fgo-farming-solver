import Page from '../../components/common/doc'
import { notFound } from 'next/navigation'

import readmeEn from '../../docs/readme.md'
import readmeJa from '../../docs/readme-ja.md'
import newsEn from '../../docs/news.md'
import newsJa from '../../docs/news-ja.md'
import contributing from '../../docs/contributing.md'
import license from '../../LICENSE.md.md'


const pages: Record<
  string,
  Record<string, { md: string; title: string }>
> = {
  docs: {
    en: { md: readmeEn, title: 'About' },
    ja: { md: readmeJa, title: 'このサイトについて' },
  },
  news: {
    en: { md: newsEn, title: 'News' },
    ja: { md: newsJa, title: 'お知らせ' },
  },
  contributing: {
    en: { md: contributing, title: 'Contributing' },
    ja: { md: contributing, title: 'Contributing' },
  },
  LICENSE: {
    en: { md: license, title: 'License' },
    ja: { md: license, title: 'License' },
  },
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ page: string }>
}) {
  const { page } = await params
  const locale = 'ja'

  if (!(page in pages)) {
    return notFound()
  }

  const localeToPage = pages[page]
  const { md, title } = localeToPage[locale] || localeToPage['en']

  return <Page title={title} md={md} />
}

export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }))
}


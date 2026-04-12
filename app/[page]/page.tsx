import { getMd } from '../../lib/get-md'
import Page from '../../components/common/doc'
import { notFound } from 'next/navigation'


const pages: Record<
  string,
  Record<string, { path: string; title: string }>
> = {
  docs: {
    en: { path: 'docs/readme.md', title: 'About' },
    ja: { path: 'docs/readme-ja.md', title: 'このサイトについて' },
  },
  news: {
    en: { path: 'docs/news.md', title: 'News' },
    ja: { path: 'docs/news-ja.md', title: 'お知らせ' },
  },
  contributing: {
    en: { path: 'docs/contributing.md', title: 'Contributing' },
    ja: { path: 'docs/contributing.md', title: 'Contributing' },
  },
  LICENSE: {
    en: { path: 'LICENSE', title: 'License' },
    ja: { path: 'LICENSE', title: 'License' },
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
  const { path, title } = localeToPage[locale] || localeToPage['en']
  const md = getMd(path)

  return <Page title={title} md={md} />
}

export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }))
}

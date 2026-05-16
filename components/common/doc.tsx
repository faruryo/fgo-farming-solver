'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Head } from './head'

export type PageProps = {
  title: string
  md: string
}

const h = (n: 1 | 2 | 3 | 4 | 5) => {
  const sizeClass =
    n === 1
      ? 'text-3xl font-bold mt-8 mb-4'
      : n === 2
      ? 'text-2xl font-bold mt-7 mb-3'
      : 'text-xl font-semibold mt-6 mb-2'
  const H = (props: React.HTMLAttributes<HTMLHeadingElement>) => {
    const Tag = `h${n}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5'
    return <Tag className={sizeClass} {...props} />
  }
  return H
}

const replace = (href?: string) => {
  if (href == null) return undefined
  return href.replace(/\.md/, '').replace(/\.\.\//, '')
}

const components = {
  h1: h(1),
  h2: h(2),
  h3: h(3),
  h4: h(4),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-2" {...props} />
  ),
  a: ({ href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={replace(href)} {...rest} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-inside my-4 space-y-2" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside my-4 space-y-2" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li {...props} />,
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="bg-muted px-1 rounded text-sm" {...props} />
  ),
}

const Page = ({ title, md }: PageProps) => (
  <div className="c-page">
    <div className="c-page-inner">
      <div className="c-page-header">
        <div>
          <div className="c-page-en">DOCUMENTATION</div>
          <h1 className="c-page-title">{title}</h1>
        </div>
      </div>
      <div className="c-card p-10" style={{ background: 'var(--panel2)' }}>
        <Head title={title} />
        <div className="markdown-body">
          <ReactMarkdown components={components}>{md}</ReactMarkdown>
        </div>
      </div>
    </div>
  </div>
)

export default Page

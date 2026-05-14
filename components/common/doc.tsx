 
'use client'

import {
  Code,
  Heading,
  HeadingProps,
  Link,
  LinkProps,
  ListItem,
  ListProps,
  OrderedList,
  Text,
  TextProps,
  UnorderedList,
} from '@chakra-ui/react'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Head } from './head'

export type PageProps = {
  title: string
  md: string
}

const h = (n: 1 | 2 | 3 | 4 | 5) => {
  const H = (props: HeadingProps) => (
    <Heading
      {...props}
      as={`h${n}`}
      size={n == 1 ? 'xl' : n == 2 ? 'lg' : 'md'}
      mt={10 - n}
      mb={5 - n}
    />
  )
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
  p: (props: TextProps) => <Text {...props} my={2} />,
  a: ({ href, ...rest }: LinkProps) => <Link href={replace(href)} {...rest} />,
  ul: (props: ListProps) => <UnorderedList {...props} spacing={2} my={4} />,
  ol: (props: ListProps) => <OrderedList {...props} spacing={2} my={4} />,
  li: ListItem,
  code: Code,
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
      <div className="c-card" style={{ padding: '40px', background: 'var(--panel2)' }}>
        <Head title={title} />
        <div className="markdown-body">
          <ReactMarkdown components={components}>{md}</ReactMarkdown>
        </div>
      </div>
    </div>
  </div>
)

export default Page

import { BreadcrumbLink as UiBreadcrumbLink } from '@/components/ui/breadcrumb'
import NextLink from 'next/link'
import React from 'react'

export const BreadcrumbLink = ({
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<'a'> & { href?: string }) => (
  <UiBreadcrumbLink render={<NextLink href={href ?? '#'} {...props} />}>
    {children}
  </UiBreadcrumbLink>
)

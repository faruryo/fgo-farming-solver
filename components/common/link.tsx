import NextLink from 'next/link'
import React, { CSSProperties, ComponentPropsWithoutRef } from 'react'

type LinkExtraProps = {
  color?: CSSProperties['color']
  _hover?: Record<string, unknown>
}

type LinkProps = ComponentPropsWithoutRef<typeof NextLink> & LinkExtraProps

export const Link = ({ children, color, _hover, style, ...props }: LinkProps) => (
  <NextLink style={{ color, ...style }} {...props}>
    {children}
  </NextLink>
)

export const ExternalLink = ({ children, color, _hover, style, href, ...props }: Omit<LinkProps, 'href'> & { href: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color, ...style }} {...(props as React.HTMLAttributes<HTMLAnchorElement>)}>
    {children}
  </a>
)

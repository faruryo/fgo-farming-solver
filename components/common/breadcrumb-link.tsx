 
import {
  BreadcrumbLink as ChakraBreadcrumbLink,
  BreadcrumbLinkProps,
  ComponentWithAs,
} from '@chakra-ui/react'
import NextLink from 'next/link'

export const BreadcrumbLink: ComponentWithAs<'a', BreadcrumbLinkProps> = ({
  children,
  ...props
}) => (
  <ChakraBreadcrumbLink
    color={props.isCurrentPage ? 'inherit' : 'blue.500'}
    {...props}
    as={NextLink}
  >
    {children}
  </ChakraBreadcrumbLink>
)

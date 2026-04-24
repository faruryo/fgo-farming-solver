'use client'

import { Box, Container, Spacer, VStack } from '@chakra-ui/react'
import React, { ReactNode } from 'react'
import { Footer } from './footer'
import { Header } from './header'

const HEADER_HEIGHT = '56px'

export const Layout = ({ children }: { children: ReactNode }) => (
  <>
    <Header />
    <main>{children}</main>
  </>
)

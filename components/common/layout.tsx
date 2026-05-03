import React, { ReactNode } from 'react'
import { Header } from './header'


export const Layout = ({ children }: { children: ReactNode }) => (
  <>
    <Header />
    <main>{children}</main>
  </>
)

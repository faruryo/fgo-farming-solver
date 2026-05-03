'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Nav } from './nav'


export const Header = () => {
  return (
    <header className="c-header" suppressHydrationWarning>
      <div className="c-header-left" />
      <Link href="/" className="c-logo">
        <div className="c-logo-emblem">
          <Image src="/icon-192.png" alt="FGO周回ソルバー" width={36} height={36} />
        </div>
        <div>
          <div className="c-logo-main">CHALDEA</div>
          <div className="c-logo-sub">FGO周回ソルバー</div>
        </div>
      </Link>
      <div className="c-header-right">
        <Nav />
      </div>
    </header>
  )
}

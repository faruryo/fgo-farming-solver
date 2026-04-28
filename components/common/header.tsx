'use client'

import Link from 'next/link'
import { Nav } from './nav'

export const Header = () => {
  return (
    <header className="c-header">
      <div className="c-header-left" />
      <Link href="/" className="c-logo">
        <div className="c-logo-emblem">
          <svg viewBox="0 0 24 24" fill="none" stroke="#c09030" strokeWidth="1.5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2 C8 6 4 6 2 12 C4 18 8 18 12 22 C16 18 20 18 22 12 C20 6 16 6 12 2Z" strokeLinejoin="round" />
          </svg>
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

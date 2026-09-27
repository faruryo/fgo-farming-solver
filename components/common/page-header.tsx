import React from 'react'
import { FaChevronLeft } from 'react-icons/fa'
import { Link } from './link'

export function PageHeader({
  backLabel,
  en,
  title,
  children,
}: Readonly<{
  backLabel: React.ReactNode
  en: string
  title: React.ReactNode
  children?: React.ReactNode
}>) {
  return (
    <div className="c-page-header">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--text3)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          <FaChevronLeft size={11} /> {backLabel}
        </Link>
        <div className="flex flex-col">
          <div className="c-page-en">{en}</div>
          <h1 className="c-page-title">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

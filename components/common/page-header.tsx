import React from 'react'
import { FaChevronLeft } from 'react-icons/fa'
import { Link } from './link'

export function PageHeader({
  backLabel,
  backHref = '/',
  en,
  title,
  aside,
  className,
  children,
}: Readonly<{
  backLabel?: React.ReactNode
  backHref?: string
  en: string
  title: React.ReactNode
  aside?: React.ReactNode
  className?: string
  children?: React.ReactNode
}>) {
  return (
    <div className={className ? `c-page-header ${className}` : 'c-page-header'}>
      <div className="flex flex-col gap-2">
        {backLabel !== undefined && (
          <Link
            href={backHref}
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
        )}
        <div className="flex flex-col">
          <div className="c-page-en">{en}</div>
          <h1 className="c-page-title">{title}</h1>
        </div>
        {children}
      </div>
      {aside}
    </div>
  )
}

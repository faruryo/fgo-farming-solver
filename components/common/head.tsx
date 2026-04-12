/* eslint-disable */
'use client'

import React from 'react'

export const Head = ({
  title,
  children,
}: {
  title?: string
  children?: React.ReactNode
}) => {
  // In App Router, metadata should be handled in layout.tsx or page.tsx.
  // This component is kept to avoid build errors if imported, but it is effectively a no-op.
  return (
    <>
      <title>{title}</title>
      {children}
    </>
  )
}

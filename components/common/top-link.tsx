import { Link } from './link'
import React from 'react'

export const TopLink = () => {
  const locale = 'ja' as string
  const label = locale == 'en' ? 'Return to Top Page' : 'トップページに戻る'
  return (
    <div className="flex justify-center">
      <Link
        href="/"
        aria-label={locale == 'en' ? 'Farming Solver' : '周回ソルバー'}
      >
        {label}
      </Link>
    </div>
  )
}
